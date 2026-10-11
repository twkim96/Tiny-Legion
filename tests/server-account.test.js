import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleGameRequest } from '../server/api.js';
import { createBattle, stepBattle, summonUnit } from '../dist/src/engine.js';
import { passwordHash } from '../server/test-access.js';

const rootSalt = 'a'.repeat(32), playerSalt = 'b'.repeat(32);
const testConfig = {
  root: { salt: rootSalt, hash: await passwordHash('12345', rootSalt), iterations: 100000, role: 'admin' },
  player: { salt: playerSalt, hash: await passwordHash('test-player', playerSalt), iterations: 100000, role: 'player' },
};
const testingEnv = () => ({ TEST_LOGIN_ENABLED: 'true', TEST_LOGIN_ACCOUNTS: JSON.stringify(testConfig) });

function harness(overrides = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_lonely_power_man.sql', import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', ''));
  const db = { prepare(sql) {
    const statement = { values: [], bind(...values) { this.values = values; return this; },
      async first() { return sqlite.prepare(sql).get(...this.values) ?? null; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...this.values).changes) } }; } };
    return statement;
  }, async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  let now = 1800000000000;
  const env = { DB: db, ...overrides };
  const browser = () => ({ cookie: '', token: '', owner: null });
  async function call(b, path, body = {}, origin = 'https://game.test') {
    const headers = { 'Content-Type': 'application/json', Origin: origin };
    if (b.cookie) headers.Cookie = b.cookie;
    if (b.token) headers['X-Game-Session'] = b.token;
    if (b.owner) headers['oai-authenticated-user-id'] = b.owner;
    if (b.email) headers['oai-authenticated-user-email'] = b.email;
    if (b.name) {
      headers['oai-authenticated-user-full-name'] = encodeURIComponent(b.name);
      headers['oai-authenticated-user-full-name-encoding'] = 'percent-encoded-utf-8';
    }
    const response = await handleGameRequest(new Request(`https://game.test/api/game/${path}`, { method: 'POST', headers, body: JSON.stringify(body) }), env, { now });
    const setCookie = response.headers.get('Set-Cookie');
    if (setCookie) b.cookie = setCookie.split(';')[0];
    const data = await response.json();
    if (data.session) b.token = data.session;
    return { status: response.status, ...data };
  }
  let serial = 0;
  const command = (b, type, args = {}, requestId = `command-${++serial}`) => call(b, 'command', { requestId, type, args });
  const seed = patch => {
    const row = sqlite.prepare('SELECT * FROM game_accounts LIMIT 1').get();
    const account = JSON.parse(row.account_json);
    Object.assign(account, patch);
    sqlite.prepare('UPDATE game_accounts SET account_json = ? WHERE account_id = ?').run(JSON.stringify(account), row.account_id);
  };
  return { sqlite, browser, call, command, seed, env, advance: ms => now += ms };
}

test('test login is disabled by default and never accepts a supplied admin role', async () => {
  const disabled = harness(), anonymous = disabled.browser();
  assert.equal((await disabled.call(anonymous, 'test/login', { username: 'root', password: '12345' })).error, 'test_login_disabled');
  const h = harness(testingEnv()), b = h.browser();
  assert.equal((await h.call(b, 'test/login', { username: 'root', password: 'wrong', isAdmin: true })).error, 'invalid_credentials');
  assert.equal((await h.call(b, 'test/login', { username: 'constructor', password: '12345' })).error, 'invalid_credentials');
  await h.call(b, 'session/start', { identity: 'guest', username: 'root', isAdmin: true });
  assert.equal((await h.command(b, 'admin.grant', { currency: 'gold', amount: 10000, isAdmin: true })).status, 403);
  b.owner = 'normal-user'; await h.call(b, 'session/start', { identity: 'account' });
  assert.equal((await h.command(b, 'admin.grant', { currency: 'diamonds', amount: 1000 })).error, 'forbidden');
  const player = await h.call(b, 'test/login', { username: 'player', password: 'test-player', role: 'admin' });
  assert.equal(player.identity.isAdmin, false);
  assert.equal((await h.command(b, 'admin.grant', { currency: 'gold', amount: 1000 })).error, 'forbidden');
});

test('root grants are saved, repeated deliberately, and idempotent on retries', async () => {
  const h = harness(testingEnv()), b = h.browser();
  const login = await h.call(b, 'test/login', { username: 'root', password: '12345', account: { gold: 1e12 } });
  assert.equal(login.identity.kind, 'test'); assert.equal(login.identity.displayName, 'root');
  assert.equal(login.identity.isAdmin, true); assert.equal(login.account.gold, 600);
  const args = { currency: 'gold', amount: 10000 };
  const [first, retry] = await Promise.all([h.command(b, 'admin.grant', args, 'grant-one'), h.command(b, 'admin.grant', args, 'grant-one')]);
  assert.equal(first.status, 200); assert.equal(retry.status, 200);
  assert.equal(first.account.gold, 10600); assert.equal(retry.account.gold, 10600);
  assert.equal((await h.command(b, 'admin.grant', args)).account.gold, 20600);
  assert.equal((await h.command(b, 'admin.grant', { currency: 'gold', amount: 1000 })).account.gold, 21600);
  assert.equal((await h.command(b, 'admin.grant', { currency: 'diamonds', amount: 1000 })).account.diamonds, 1060);
  assert.equal((await h.command(b, 'admin.grant', { currency: 'diamonds', amount: 10000 })).account.diamonds, 11060);
  assert.equal((await h.call(b, 'session/resume')).account.gold, 21600);
  for (const invalid of [{currency:'gold',amount:-1000},{currency:'gold',amount:9999},{currency:'tickets',amount:1000}])
    assert.equal((await h.command(b, 'admin.grant', invalid)).error, 'invalid_grant');
  assert.equal((await h.call(b, 'session/resume')).account.gold, 21600);
});

test('test sessions revoke older logins, cannot link to real accounts, and stop when disabled or changed', async () => {
  const h = harness(testingEnv()), b = h.browser(), other = h.browser();
  await h.call(b, 'test/login', { username: 'root', password: '12345' });
  await h.command(b, 'admin.grant', {currency:'gold',amount:1000});
  const again = await h.call(other, 'test/login', { username: 'root', password: '12345' });
  assert.equal(again.account.gold, 1600);
  assert.equal((await h.command(b, 'admin.grant', {currency:'gold',amount:1000})).error, 'session_replaced');
  other.owner = 'real-user';
  assert.equal((await h.call(other, 'account/link')).error, 'test_account_link_forbidden');
  assert.equal((await h.call(other, 'session/start', {identity:'account'})).account.gold, 600);
  await h.call(other, 'test/login', {username:'root',password:'12345'});
  h.env.TEST_LOGIN_ENABLED = 'false';
  assert.equal((await h.call(other, 'session/resume')).error, 'test_login_disabled');
  h.env.TEST_LOGIN_ENABLED = 'true';
  h.env.TEST_LOGIN_ACCOUNTS = JSON.stringify({...testConfig, root: {...testConfig.root, hash: '0'.repeat(64)}});
  assert.equal((await h.command(other, 'admin.grant', {currency:'gold',amount:1000})).error, 'test_login_disabled');
});

test('guest uses secret cookie and session; import and forged balances cannot enter server account or link', async () => {
  const h = harness(), guest = h.browser();
  const first = await h.call(guest, 'session/start', { account: { gold: 1e12, highestCleared: 20 } });
  assert.equal(first.status, 200); assert.equal(first.identity.kind, 'guest'); assert.equal(first.account.gold, 600);
  assert.match(guest.cookie, /^__Host-tiny-legion-guest=[a-f0-9]{64}$/);
  const forged = h.browser(); forged.token = guest.token;
  assert.equal((await h.command(forged, 'settle')).error, 'session_replaced');
  assert.equal((await h.command(guest, 'account.import', { gold: 1e12 })).error, 'unknown_command');
  assert.equal((await h.command(guest, 'unit.grow', { id: 'sheep' })).error, 'action_unavailable');
  const linkedNoLogin = await h.call(guest, 'account/link'); assert.equal(linkedNoLogin.status, 401);
  guest.owner = 'user-a';
  const linked = await h.call(guest, 'account/link', { account: { gold: 1e12 } });
  assert.equal(linked.identity.kind, 'account'); assert.equal(linked.account.gold, 600);
  const device2 = h.browser(); device2.owner = 'user-a';
  const saved = await h.call(device2, 'session/start');
  assert.equal(saved.account.gold, 600); assert.equal(saved.account.highestCleared, 0);
  assert.equal((await h.command(guest, 'settle')).error, 'session_replaced');
});

test('account login requires Sites identity and reopens that account across browsers', async () => {
  const h = harness(), b = h.browser();
  assert.equal((await h.call(b, 'session/start', { identity: 'account' })).error, 'login_required');
  b.owner = 'signed-in-user';
  b.email = 'player@test.invalid'; b.name = '숲속 친구';
  const account = await h.call(b, 'session/start', { identity: 'account', email: 'forged@test.invalid' });
  assert.equal(account.identity.kind, 'account');
  assert.equal(account.identity.email, b.email);
  assert.equal(account.identity.displayName, b.name);
  assert.equal((await h.command(b, 'settle')).identity.email, b.email);
  h.seed({ gold: 1250 });
  const guest = await h.call(b, 'session/start', { identity: 'guest' });
  assert.equal(guest.identity.kind, 'guest');
  assert.equal(guest.identity.email, undefined);
  assert.equal(guest.account.gold, 600);
  const reopened = await h.call(b, 'session/start', { identity: 'account' });
  assert.equal(reopened.account.gold, 1250);
  const anotherDevice = h.browser(); anotherDevice.owner = b.owner;
  assert.equal((await h.call(anotherDevice, 'session/start', { identity: 'account' })).account.gold, 1250);
  assert.equal((await h.command(b, 'settle')).error, 'session_replaced');
});

test('anonymous sessions stay distinct; claiming same request twice returns one atomic reward receipt', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  h.seed({ onboarding: { phase: 'complete' }, missions: { idleCompleted: true, claimed: [] } });
  const before = (await h.command(b, 'settle')).account.gold;
  const [one, two] = await Promise.all([h.command(b, 'mission.claim', {}, 'same-request'), h.command(b, 'mission.claim', {}, 'same-request')]);
  assert.equal(one.status, 200); assert.equal(two.status, 200);
  assert.equal(one.account.gold, before + 120); assert.equal(two.account.gold, before + 120);
  assert.deepEqual(one.result, two.result);
  assert.equal((await h.command(b, 'settle', {}, 'same-request')).error, 'request_id_reused');
  assert.equal((await h.command(b, 'mission.claim')).error, 'action_unavailable');
  const another = h.browser(); assert.equal((await h.call(another, 'session/start')).account.gold, 600);
  assert.notEqual(another.cookie, b.cookie);
  const newTab = { ...b, token: '' }; await h.call(newTab, 'session/start');
  assert.equal((await h.call(b, 'session/resume')).error, 'session_replaced');
});

test('random draws are server controlled, receipts survive retries, linking cannot merge existing accounts', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  h.seed({ onboarding: { phase: 'complete' }, earlyGuide: { phase: 'complete' }, highestCleared: 2 });
  const args = { count: 10, free: true, banner: 'forest', results: [{ unit: { id: 'whale' } }] };
  const one = await h.command(b, 'recruit.units', args, 'draw-request');
  assert.equal(one.status, 200); assert.equal(one.result.length, 10);
  const two = await h.command(b, 'recruit.units', args, 'draw-request');
  assert.deepEqual(two.result, one.result); assert.equal(two.account.recruitment.total, 10);
  assert.equal((await h.command(b, 'recruit.units', args)).error, 'action_unavailable');
  const signed = h.browser(); signed.owner = 'already-owned'; await h.call(signed, 'session/start');
  b.owner = 'already-owned';
  assert.equal((await h.call(b, 'account/link')).error, 'account_exists');
  assert.equal((await h.command(b, 'settle')).identity.kind, 'guest');
  assert.equal((await h.call(b, 'session/start', { identity: 'account' })).account.recruitment.total, 0);
});

test('server time accrues idle income once; replay rejects fake result, future completion, and illegal summons', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  const started = await h.command(b, 'battle.start', { mode: 'challenge', stageId: 0 });
  const run = started.result, state = createBattle(run.options), actions = [];
  for (let step = 0; !state.finished && step < 3000; step++) {
    if (summonUnit(state, 'sheep')) actions.push({ step, type: 'summon', id: 'sheep' });
    stepBattle(state, 1 / 30);
  }
  assert.equal(state.result.won, true);
  assert.equal((await h.command(b, 'battle.finish', { battleId: run.battleId, actions, result: { won: true, reward: 999999 } })).error, 'battle_too_early');
  h.advance(90000);
  assert.equal((await h.command(b, 'battle.finish', { battleId: run.battleId, actions: [{ step: 0, type: 'summon', id: 'whale' }] })).error, 'invalid_summon');
  const finish = await h.command(b, 'battle.finish', { battleId: run.battleId, actions, result: { won: false, reward: 999999 } }, 'finish-request');
  assert.equal(finish.status, 200); assert.equal(finish.account.onboarding.phase, 'first-battle'); assert.equal(finish.account.gold, 600);
  assert.equal((await h.command(b, 'battle.finish', { battleId: run.battleId, actions }, 'other-finish')).error, 'battle_not_found');
  h.seed({ onboarding: { phase: 'complete' }, records: { 1: { gold: 90, diamonds: .1, productionSeconds: 90 } } });
  h.advance(90000);
  const income = await h.command(b, 'settle', {}, 'income-request');
  assert.equal(income.result.gold, 90); assert.equal(income.account.gold, 690);
  assert.equal((await h.command(b, 'settle', {}, 'income-request')).account.gold, 690);
  assert.equal((await h.command(b, 'settle')).result.gold, 0);
});

test('cross-origin writes and missing sessions are rejected', async () => {
  const h = harness(), b = h.browser();
  assert.equal((await h.call(b, 'session/start', {}, 'https://evil.test')).status, 403);
  assert.equal((await h.command(b, 'settle')).status, 409);
  h.sqlite.close();
});

test('idle replay keeps server production snapshot and cannot skip the tutorial mission', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  h.seed({ onboarding: { phase: 'complete' }, highestCleared: 1,
    owned: { sheep: true, squirrel: true }, sequence: ['sheep', 'squirrel', ...Array(8).fill(null)] });
  assert.equal((await h.command(b, 'battle.start', { mode: 'challenge', stageId: 2 })).error, 'battle_locked');
  const started = await h.command(b, 'battle.start', { mode: 'idle', stageId: 1 });
  assert.equal(started.status, 200);
  const run = started.result, state = createBattle(run.options);
  stepBattle(state, 90);
  h.advance(90000);
  const finished = await h.command(b, 'battle.finish', { battleId: run.battleId, actions: [] });
  assert.equal(finished.status, 200);
  assert.deepEqual(finished.result.battleResult, state.result);
  assert.deepEqual(finished.account.records[1].snapshot, run.snapshot);
  assert.equal(finished.account.missions.idleCompleted, true);
  assert.equal((await h.command(b, 'battle.start', { mode: 'challenge', stageId: 2 })).error, 'battle_locked');
  assert.equal((await h.command(b, 'mission.claim')).status, 200);
  assert.equal((await h.command(b, 'battle.start', { mode: 'challenge', stageId: 2 })).status, 200);
});

test('simultaneous distinct claims cannot both grant the same mission', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  h.seed({ onboarding: { phase: 'complete' }, missions: { idleCompleted: true, claimed: [] } });
  const results = await Promise.all([h.command(b, 'mission.claim', {}, 'claim-a'), h.command(b, 'mission.claim', {}, 'claim-b')]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  const current = await h.command(b, 'settle');
  assert.equal(current.account.gold, 720); assert.deepEqual(current.account.missions.claimed, ['idle-intro']);
});

test('clearing a regional finale opens its next idle stage without allowing arbitrary stages', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  h.seed({ onboarding: { phase: 'complete' }, highestCleared: 10, earlyGuide: { phase: 'complete' }, missions: { idleCompleted: true, claimed: ['idle-intro'] } });
  assert.equal((await h.command(b, 'idle.select', { stageId: 12 })).error, 'stage_locked');
  assert.equal((await h.command(b, 'idle.select', { stageId: 11 })).status, 200);
  assert.equal((await h.command(b, 'battle.start', { mode: 'idle', stageId: 11 })).status, 200);
});

test('server preferences accept presentation fields without granting arbitrary account changes', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  const changed = await h.command(b, 'settings', { sound: true, speed: 2, hiddenIdleResults: [1, 1], gold: 1e12 });
  assert.equal(changed.status, 200); assert.equal(changed.account.gold, 600);
  assert.deepEqual(changed.account.settings, { sound: true, speed: 2, hiddenIdleResults: [1] });
  assert.equal((await h.command(b, 'settings', { speed: 100 })).error, 'invalid_preference');
  assert.equal((await h.command(b, 'settings', { hiddenIdleResults: [999] })).error, 'invalid_preference');
});
