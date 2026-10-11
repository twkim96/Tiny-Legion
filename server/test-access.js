import { GameError } from './battle.js';

// Removable test access: no credentials or privileges live in game save data.
const PREFIX = 'test-login:';
const attempts = new Map();
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(value);

function accounts(env) {
  if (env.TEST_LOGIN_ENABLED !== 'true') return {};
  try {
    const configured = JSON.parse(env.TEST_LOGIN_ACCOUNTS || '{}');
    if (!configured || typeof configured !== 'object' || Array.isArray(configured)) return {};
    return Object.fromEntries(Object.entries(configured).filter(([id, value]) => validId(id)
      && value && /^[a-f0-9]{32}$/.test(value.salt) && /^[a-f0-9]{64}$/.test(value.hash)
      && value.iterations === 100000 && ['admin', 'player'].includes(value.role)));
  } catch { return {}; }
}

export const testLoginEnabled = env => Object.keys(accounts(env)).length > 0;
export const isTestOwner = ownerId => typeof ownerId === 'string' && ownerId.startsWith(PREFIX);
export const testOwner = username => `${PREFIX}${username}`;
function credentialFor(username, env) {
  const configured = accounts(env);
  return Object.hasOwn(configured, username) ? configured[username] : null;
}
export const testCredential = (ownerId, env) => isTestOwner(ownerId) ? credentialFor(ownerId.slice(PREFIX.length), env) : null;

export function testIdentity(ownerId, env) {
  const credential = testCredential(ownerId, env);
  return credential ? { kind: 'test', canLink: false, provider: '테스트',
    displayName: ownerId.slice(PREFIX.length), isAdmin: credential.role === 'admin' } : null;
}

export async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 100000,
    salt: Uint8Array.from(salt.match(/../g), byte => parseInt(byte, 16)) }, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function authenticateTestLogin(env, body, request, now) {
  if (!testLoginEnabled(env)) throw new GameError('test_login_disabled', 403);
  const { username, password } = body;
  if (!validId(username) || typeof password !== 'string' || password.length < 1 || password.length > 128)
    throw new GameError('invalid_credentials', 401);
  // Bounded per-Worker attempt window; private Sites access remains in force.
  const attemptKey = `${request.headers.get('CF-Connecting-IP') || 'local'}:${username}`;
  let attempt = attempts.get(attemptKey);
  if (!attempt || now >= attempt.until) {
    if (attempts.size >= 512) attempts.delete(attempts.keys().next().value);
    attempt = { count: 0, until: now + 60000 };
    attempts.set(attemptKey, attempt);
  }
  if (attempt.count >= 5) throw new GameError('login_rate_limited', 429);
  attempt.count++;
  const credential = credentialFor(username, env);
  if (!credential) throw new GameError('invalid_credentials', 401);
  const actual = await passwordHash(password, credential.salt);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ credential.hash.charCodeAt(i);
  if (difference) throw new GameError('invalid_credentials', 401);
  attempts.delete(attemptKey);
  return testOwner(username);
}

export function requireTestAdmin(row, env) {
  if (!testIdentity(row.owner_id, env)?.isAdmin) throw new GameError('forbidden', 403);
}

export function grantTestCurrency(account, args) {
  if (!['gold', 'diamonds'].includes(args.currency) || ![1000, 10000].includes(args.amount))
    throw new GameError('invalid_grant');
  if (!Number.isFinite(account[args.currency] + args.amount) || account[args.currency] + args.amount > Number.MAX_SAFE_INTEGER)
    throw new GameError('balance_limit');
  account[args.currency] += args.amount;
  return { currency: args.currency, amount: args.amount };
}
