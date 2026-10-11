import { newAccount, accrue, collectReturnIncome } from '../dist/src/account.js';
import { applyCommand } from './commands.js';
import { GameError } from './battle.js';
import { isTestOwner, testCredential, testIdentity, authenticateTestLogin, requireTestAdmin, grantTestCurrency } from './test-access.js';

const COOKIE = '__Host-tiny-legion-guest';
const opaque = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
export const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
function identity(row, request, env) {
  if (isTestOwner(row.owner_id)) return testIdentity(row.owner_id, env);
  if (!row.owner_id) return { kind: 'guest', canLink: true };
  const email = request.headers.get('oai-authenticated-user-email') || null;
  let displayName = request.headers.get('oai-authenticated-user-full-name') || null;
  if (displayName && request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { displayName = decodeURIComponent(displayName); } catch { displayName = null; }
  }
  return { kind: 'account', canLink: false, provider: 'ChatGPT', email, displayName: displayName || email };
}
const envelope = (row, account, now, request, extra = {}, env = {}) => ({ account, revision: row.version, serverNow: now, identity: identity(row, request, env), ...extra });
const get = (db, query, ...values) => db.prepare(query).bind(...values).first();
async function boundedBody(request) {
  const limit = 524288;
  if (Number(request.headers.get('Content-Length')) > limit) throw new GameError('request_too_large', 413);
  if (!request.body) return '';
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new GameError('request_too_large', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
function guestCookie(request) {
  const value = request.headers.get('Cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value ?? '') ? value : null;
}
async function activeRow(db, request, ownerId, env) {
  const token = request.headers.get('X-Game-Session');
  if (!/^[a-f0-9]{64}$/.test(token ?? '')) throw new GameError('session_replaced', 409);
  const row = await get(db, 'SELECT * FROM game_accounts WHERE session_hash = ?', await hash(token));
  if (!row) throw new GameError('session_replaced', 409);
  if (isTestOwner(row.owner_id)) {
    const credential = testCredential(row.owner_id, env);
    if (!credential || credential.hash !== row.guest_hash) throw new GameError('test_login_disabled', 403);
  } else if (row.owner_id) { if (!ownerId || row.owner_id !== ownerId) throw new GameError('login_required', 401); }
  else if (!guestCookie(request) || await hash(guestCookie(request)) !== row.guest_hash) throw new GameError('session_replaced', 409);
  return row;
}
async function startSession(db, request, ownerId, body, now, env) {
  if (body.identity !== undefined && !['guest', 'account'].includes(body.identity)) throw new GameError('invalid_identity');
  let secret = guestCookie(request), guestHash = secret ? await hash(secret) : null;
  let row = guestHash ? await get(db, 'SELECT * FROM game_accounts WHERE guest_hash = ? AND owner_id IS NULL', guestHash) : null;
  if (body.identity === 'account' || (!row && ownerId && body.identity !== 'guest')) {
    if (!ownerId) throw new GameError('login_required', 401);
    row = await get(db, 'SELECT * FROM game_accounts WHERE owner_id = ?', ownerId);
    guestHash = isTestOwner(ownerId) ? testCredential(ownerId, env)?.hash : null;
  } else ownerId = null;
  const created = !row;
  const token = opaque(), sessionHash = await hash(token), commit = crypto.randomUUID();
  let returnIncome = null, a;
  if (row) {
    a = JSON.parse(row.account_json); returnIncome = collectReturnIncome(a, now);
    const update = await db.prepare('UPDATE game_accounts SET session_hash = ?, guest_hash = ?, generation = generation + 1, version = version + 1, commit_id = ?, account_json = ?, battle_json = NULL, updated_at = ? WHERE account_id = ? AND version = ?')
      .bind(sessionHash, guestHash, commit, JSON.stringify(a), now, row.account_id, row.version).run();
    if (!update.meta.changes) throw new GameError('state_changed', 409);
    row = { ...row, guest_hash: guestHash, session_hash: sessionHash, version: row.version + 1 };
  } else {
    if (!ownerId) { secret = opaque(); guestHash = await hash(secret); }
    a = newAccount(now);
    row = { account_id: crypto.randomUUID(), owner_id: ownerId, guest_hash: guestHash, session_hash: sessionHash, version: 1 };
    try {
      await db.prepare('INSERT INTO game_accounts (account_id, owner_id, guest_hash, session_hash, generation, version, commit_id, account_json, updated_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?)')
        .bind(row.account_id, ownerId, guestHash, sessionHash, commit, JSON.stringify(a), now).run();
    } catch (error) { if (String(error).includes('UNIQUE')) throw new GameError('state_changed', 409); throw error; }
  }
  const headers = !row.owner_id ? { 'Set-Cookie': `${COOKIE}=${secret}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000` } : {};
  return json(envelope(row, a, now, request, { session: token, returnIncome, created }, env), 200, headers);
}

async function mutate(db, request, ownerId, body, now, resume = false, env = {}) {
  if (!resume && (!/^[a-zA-Z0-9_-]{1,128}$/.test(body.requestId ?? '') || typeof body.type !== 'string' || !body.args || typeof body.args !== 'object' || Array.isArray(body.args))) throw new GameError('invalid_command');
  const payloadHash = resume ? null : await hash(JSON.stringify({ type: body.type, args: body.args }));
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await activeRow(db, request, ownerId, env);
    if (body.type === 'admin.grant') requireTestAdmin(row, env);
    const a = JSON.parse(row.account_json);
    if (!resume) {
      const receipt = await get(db, 'SELECT * FROM game_commands WHERE account_id = ? AND request_id = ?', row.account_id, body.requestId);
      if (receipt) {
        if (receipt.payload_hash !== payloadHash) throw new GameError('request_id_reused', 409);
        const current = await activeRow(db, request, ownerId, env);
        return json(envelope(current, JSON.parse(current.account_json), now, request, JSON.parse(receipt.receipt_json), env));
      }
    }
    const income = resume ? collectReturnIncome(a, now) : accrue(a, now);
    const battle = row.battle_json ? JSON.parse(row.battle_json) : null;
    const outcome = resume ? { result: null, battle } : body.type === 'admin.grant'
      ? { result: grantTestCurrency(a, body.args), battle }
      : applyCommand(a, battle, body.type, body.args, now);
    // Settle returns the amount accrued before the command, once.
    if (body.type === 'settle') outcome.result = income;
    if (body.type === 'battle.finish') outcome.result.income = income;
    const commit = crypto.randomUUID();
    const update = db.prepare('UPDATE game_accounts SET account_json = ?, battle_json = ?, version = version + 1, commit_id = ?, updated_at = ? WHERE account_id = ? AND version = ? AND session_hash = ?')
      .bind(JSON.stringify(a), outcome.battle ? JSON.stringify(outcome.battle) : null, commit, now, row.account_id, row.version, row.session_hash);
    const receiptData = resume ? { returnIncome: income } : { result: outcome.result };
    const statements = [update];
    if (!resume) statements.push(db.prepare('INSERT INTO game_commands (account_id, request_id, payload_hash, receipt_json, created_at) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM game_accounts WHERE account_id = ? AND commit_id = ?)')
      .bind(row.account_id, body.requestId, payloadHash, JSON.stringify(receiptData), now, row.account_id, commit));
    let results;
    try { results = await db.batch(statements); }
    catch (error) { if (String(error).includes('UNIQUE') && attempt < 3) continue; throw error; }
    if (!results[0].meta.changes) continue;
    return json(envelope({ ...row, version: row.version + 1 }, a, now, request, resume ? { ...receiptData, session: request.headers.get('X-Game-Session') } : receiptData, env));
  }
  throw new GameError('state_changed', 409);
}

async function link(db, request, ownerId, now, env) {
  if (!ownerId) throw new GameError('login_required', 401);
  const row = await activeRow(db, request, ownerId, env);
  if (isTestOwner(row.owner_id)) throw new GameError('test_account_link_forbidden', 403);
  if (row.owner_id === ownerId) return json(envelope(row, JSON.parse(row.account_json), now, request, {}, env));
  if (await get(db, 'SELECT account_id FROM game_accounts WHERE owner_id = ?', ownerId)) throw new GameError('account_exists', 409);
  try {
    const update = await db.prepare('UPDATE game_accounts SET owner_id = ?, guest_hash = NULL, version = version + 1, updated_at = ? WHERE account_id = ? AND owner_id IS NULL AND session_hash = ? AND version = ?')
      .bind(ownerId, now, row.account_id, row.session_hash, row.version).run();
    if (!update.meta.changes) throw new GameError('state_changed', 409);
  } catch (error) { if (String(error).includes('UNIQUE')) throw new GameError('account_exists', 409); throw error; }
  return json(envelope({ ...row, owner_id: ownerId, version: row.version + 1 }, JSON.parse(row.account_json), now, request, {}, env), 200,
    { 'Set-Cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0` });
}

export async function handleGameRequest(request, env, { now = Date.now() } = {}) {
  try {
    if (request.method !== 'POST') throw new GameError('method_not_allowed', 405);
    const url = new URL(request.url), origin = request.headers.get('Origin');
    if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new GameError('invalid_origin', 403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new GameError('invalid_content_type', 415);
    const text = await boundedBody(request);
    let body;
    try { body = JSON.parse(text); } catch { throw new GameError('invalid_json'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GameError('invalid_json');
    if (!env.DB) throw new GameError('database_unavailable', 503);
    // Sites dispatch owns authentication and strips visitor-supplied identity headers.
    const sitesOwnerId = request.headers.get('oai-authenticated-user-id') || null;
    const ownerId = isTestOwner(sitesOwnerId) ? null : sitesOwnerId;
    switch (url.pathname) {
      case '/api/game/session/start': return await startSession(env.DB, request, ownerId, body, now, env);
      case '/api/game/session/resume': return await mutate(env.DB, request, ownerId, body, now, true, env);
      case '/api/game/command': return await mutate(env.DB, request, ownerId, body, now, false, env);
      case '/api/game/account/link': return await link(env.DB, request, ownerId, now, env);
      case '/api/game/test/login': {
        const testOwnerId = await authenticateTestLogin(env, body, request, now);
        return await startSession(env.DB, request, testOwnerId, { identity: 'account' }, now, env);
      }
      default: throw new GameError('not_found', 404);
    }
  } catch (error) {
    if (error instanceof GameError) return json({ error: error.message }, error.status);
    console.error('Game API failed', error.message);
    return json({ error: 'server_error' }, 500);
  }
}
