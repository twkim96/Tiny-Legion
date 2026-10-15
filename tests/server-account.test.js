import { idleFullReward, ECONOMY_VERSION } from "../dist/src/economy.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleGameRequest } from '../server/api.js';
import { createBattle, stepBattle, summonUnit, fireCannon } from '../dist/src/engine.js';
import { BALANCE_VERSION, UNITS } from '../dist/src/data.js';
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

test('mission mail grants are claimed atomically and same request retries return one receipt', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  h.seed({
    onboarding: { phase: 'complete' },
    earlyGuide: { phase: 'complete', legacy: true },
    highestCleared: 3,
    missions: { idleCompleted: true, claimed: ['idle-intro', 'challenge-2'] },
  });
  const mission = await h.command(b, 'mission.claim', {}, 'fox-mission');
  assert.equal(mission.result.id, 'challenge-3');
  assert.equal(mission.account.owned.fox, false);
  assert.deepEqual(mission.account.mailbox, [
    { id: 'mission:challenge-3:fox', unitId: 'fox', claimed: false },
  ]);

  const args = { id: 'mission:challenge-3:fox' };
  const first = await h.command(b, 'mail.claim', args, 'fox-mail');
  const retry = await h.command(b, 'mail.claim', args, 'fox-mail');
  assert.equal(first.status, 200);
  assert.deepEqual(retry.result, first.result);
  assert.equal(first.result.unit.id, 'fox');
  assert.equal(first.account.owned.fox, true);
  assert.equal(first.account.mailbox[0].claimed, true);
  const duplicate = await h.command(b, 'mail.claim', args, 'fox-mail-again');
  assert.equal(duplicate.error, 'action_unavailable');
  assert.equal((await h.command(b, 'settle')).account.marks.wild, 0);
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
  const endStep = Math.round(state.time * 30);
  assert.equal((await h.command(b, 'battle.finish', { battleId: run.battleId, endStep, actions, result: { won: true, reward: 999999 } })).error, 'battle_too_early');
  h.advance(90000);
  assert.equal((await h.command(b, 'battle.finish', { battleId: run.battleId, endStep, actions: [{ step: 0, type: 'summon', id: 'whale' }] })).error, 'invalid_summon');
  const finish = await h.command(b, 'battle.finish', { battleId: run.battleId, endStep, actions, result: { won: false, reward: 999999 } }, 'finish-request');
  assert.equal(finish.status, 200); assert.equal(finish.account.onboarding.phase, 'first-battle'); assert.equal(finish.account.gold, 600);
  assert.equal((await h.command(b, 'battle.finish', { battleId: run.battleId, endStep, actions }, 'other-finish')).error, 'battle_not_found');
  h.seed({ onboarding: { phase: 'complete' }, records: { 1: { gold: 90, diamonds: .1, productionSeconds: 90 } } });
  h.advance(90000);
  const income = await h.command(b, 'settle', {}, 'income-request');
  assert.equal(income.result.gold, 90); assert.equal(income.account.gold, 690);
  assert.equal((await h.command(b, 'settle', {}, 'income-request')).account.gold, 690);
  assert.equal((await h.command(b, 'settle')).result.gold, 0);
});

test('stored server accounts reprice old idle records before settlement and retry only pays once', async () => {
  const h=harness(), b=h.browser(); await h.call(b,'session/start');
  h.seed({economyVersion:'region-one-tactics-21',gold:600,onboarding:{phase:'complete'},highestCleared:11,idleStage:11,
    records:{11:{gold:3262,diamonds:.163,productionSeconds:90,survival:90,hpRatio:1,
      snapshot:{stageId:11,balanceVersion:'region-one-tactics-21',gemEffects:{acorn:1}}}}});
  h.advance(8*3600000);
  const first=await h.command(b,'settle',{},'economic-settle');
  assert.equal(first.status,200);
  assert.ok(Math.abs(first.result.gold-idleFullReward(11)*320)<1e-6);
  assert.ok(first.account.gold<11000);
  assert.equal(first.account.economyVersion,ECONOMY_VERSION);
  assert.equal(first.account.records[11].economyVersion,ECONOMY_VERSION);
  const again=await h.command(b,'settle',{},'economic-settle');
  assert.deepEqual(again.result,first.result);
  assert.equal(again.account.gold,first.account.gold);
  assert.equal((await h.command(b,'settle')).result.gold,0);
});

test('server settlement enforces a twelve-hour absence limit without duplicate payouts', async () => {
  const h=harness(), b=h.browser(); await h.call(b,'session/start');
  h.seed({onboarding:{phase:'complete'},highestCleared:11,idleStage:11,
    records:{11:{gold:idleFullReward(11),diamonds:.065,productionSeconds:90,economyVersion:ECONOMY_VERSION}}});
  h.advance(24*3600000);
  const first=await h.command(b,'settle',{},'twelve-hour-cap');
  assert.equal(first.result.seconds,43200);
  assert.ok(Math.abs(first.result.gold-idleFullReward(11)*480)<1e-6);
  assert.deepEqual((await h.command(b,'settle',{},'twelve-hour-cap')).result,first.result);
  assert.equal((await h.command(b,'settle')).result.gold,0);
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
  assert.equal(run.snapshot.balanceVersion, BALANCE_VERSION);
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

test('battle replay rejects missing or outdated balance snapshots without changing account state', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  h.seed({ onboarding: { phase: 'complete' }, highestCleared: 1 });
  const started = await h.command(b, 'battle.start', { mode: 'idle', stageId: 1 });
  assert.equal(started.status, 200);
  assert.equal(started.result.snapshot.balanceVersion, BALANCE_VERSION);
  const row = h.sqlite.prepare('SELECT * FROM game_accounts LIMIT 1').get();
  const accountBefore = row.account_json;
  const battle = JSON.parse(row.battle_json);

  battle.snapshot.balanceVersion = 'outdated-version';
  h.sqlite.prepare('UPDATE game_accounts SET battle_json = ? WHERE account_id = ?').run(JSON.stringify(battle), row.account_id);
  h.advance(90000);
  const outdated = await h.command(b, 'battle.finish', { battleId: started.result.battleId, actions: [] });
  assert.equal(outdated.status, 409);
  assert.equal(outdated.error, 'battle_version_mismatch');
  assert.equal(h.sqlite.prepare('SELECT account_json FROM game_accounts LIMIT 1').get().account_json, accountBefore);

  delete battle.snapshot.balanceVersion;
  h.sqlite.prepare('UPDATE game_accounts SET battle_json = ? WHERE account_id = ?').run(JSON.stringify(battle), row.account_id);
  const missing = await h.command(b, 'battle.finish', { battleId: started.result.battleId, actions: [] });
  assert.equal(missing.status, 409);
  assert.equal(missing.error, 'battle_version_mismatch');
  assert.equal(h.sqlite.prepare('SELECT account_json FROM game_accounts LIMIT 1').get().account_json, accountBefore);

  const replacement = await h.command(b, 'battle.start', { mode: 'idle', stageId: 1 });
  assert.equal(replacement.status, 200);
  assert.notEqual(replacement.result.battleId, started.result.battleId);
  assert.equal(replacement.result.snapshot.balanceVersion, BALANCE_VERSION);
  assert.equal((await h.command(b, 'battle.finish', { battleId: started.result.battleId, actions: [] })).error, 'battle_not_found');
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
  for (const [highestCleared, nextStage, allowed] of [[1, 2, false], [2, 3, false], [9, 10, false], [10, 11, true], [11, 12, false], [19, 20, false]]) {
    h.seed({ highestCleared });
    const selected = await h.command(b, 'idle.select', { stageId: nextStage });
    const started = await h.command(b, 'battle.start', { mode: 'idle', stageId: nextStage });
    assert.equal(selected.status === 200, allowed);
    assert.equal(started.status === 200, allowed);
  }
  h.sqlite.close();
});

test('a level refund invalidates the old battle before it can restore production from refunded growth', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  h.seed({ onboarding: { phase: 'complete' }, earlyGuide: { phase: 'complete' },
    highestCleared: 2, levels: { sheep: 2 }, levelSpent: { sheep: 100 }, gold: 1000 });
  const started = await h.command(b, 'battle.start', { mode: 'idle', stageId: 1 });
  assert.equal(started.status, 200);
  assert.equal(started.result.options.levels.sheep, 2);
  const originalBattle = h.sqlite.prepare('SELECT battle_json FROM game_accounts').get().battle_json;
  const noRefund = await h.command(b, 'unit.refund', { id: 'squirrel' });
  assert.equal(noRefund.result, 0);
  assert.equal(h.sqlite.prepare('SELECT battle_json FROM game_accounts').get().battle_json, originalBattle);
  const refunded = await h.command(b, 'unit.refund', { id: 'sheep' }, 'refund-once');
  assert.equal(refunded.result, 100);
  assert.equal(refunded.account.levels.sheep, 1);
  assert.deepEqual(refunded.account.records, {});
  h.advance(90000);
  const stale = await h.command(b, 'battle.finish', { battleId: started.result.battleId, actions: [] });
  assert.equal(stale.error, 'battle_not_found');
  const fresh = await h.command(b, 'battle.start', { mode: 'idle', stageId: 1 });
  assert.equal(fresh.result.options.levels.sheep, 1);
  const retry = await h.command(b, 'unit.refund', { id: 'sheep' }, 'refund-once');
  assert.equal(retry.result, 100);
  assert.equal(retry.account.gold, refunded.account.gold);
  h.advance(90000);
  const finished = await h.command(b, 'battle.finish', { battleId: fresh.result.battleId, actions: [] });
  assert.equal(finished.status, 200);
  assert.equal(finished.account.records[1].snapshot.levels.sheep, 1);
  h.sqlite.close();
});

test('server preferences accept presentation fields without granting arbitrary account changes', async () => {
  const h = harness(), b = h.browser(); await h.call(b, 'session/start');
  const changed = await h.command(b, 'settings', { audio: { musicEnabled: false, musicVolume: 0.25 }, speed: 2, hiddenIdleResults: [1, 1], gold: 1e12 });
  assert.equal(changed.status, 200); assert.equal(changed.account.gold, 600);
  assert.deepEqual(changed.account.settings, { audio: { musicEnabled: false, sfxEnabled: true, musicVolume: 0.25, sfxVolume: 0.6 }, speed: 2, hiddenIdleResults: [1] });
  assert.equal((await h.command(b, 'settings', { speed: 100 })).error, 'invalid_preference');
  assert.equal((await h.command(b, 'settings', { audio: { musicVolume: 2 } })).error, 'invalid_preference');
  assert.equal((await h.command(b, 'settings', { audio: { sfxEnabled: 1 } })).error, 'invalid_preference');
  assert.equal((await h.command(b, 'settings', { audio: { gold: 1000 } })).error, 'invalid_preference');
  assert.equal((await h.command(b, 'settings', { hiddenIdleResults: [999] })).error, 'invalid_preference');
});

test('server verifies speedrun stage progression and replays reward claim receipts once', async () => {
  const h = harness(), b = h.browser();
  await h.call(b, 'session/start');
  h.seed({
    onboarding: { phase: 'complete' },
    earlyGuide: { phase: 'complete', legacy: false },
    highestCleared: 11,
    speedrunUnlocked: 1,
    owned: Object.fromEntries(UNITS.map(unit => [unit.id, true])),
    levels: Object.fromEntries(UNITS.map(unit => [unit.id, 100])),
  });
  const started = await h.command(b, 'battle.start', { mode: 'speedrun', stageId: 1 });
  assert.equal(started.status, 200);
  const run = started.result;
  const state = createBattle(run.options), actions = [];
  const order = [...UNITS].sort((a, c) => c.attack / c.cost - a.attack / a.cost).map(unit => unit.id);
  let cannon = -750;
  for (let step = 0; step <= Math.ceil(state.duration * 30) && !state.finished; step++) {
    for (const id of order) if (summonUnit(state, id)) { actions.push({ step, type: 'summon', id }); break; }
    if (step - cannon >= 750 && state.units.some(unit => unit.team === 'enemy' && !unit.dead) && fireCannon(state)) {
      actions.push({ step, type: 'cannon' }); cannon = step;
    }
    stepBattle(state, 1 / 30);
  }
  assert.equal(state.result.won, true);
  assert.ok(state.result.time <= 60);
  h.advance(Math.ceil(state.result.time * 1000));
  const finished = await h.command(b, 'battle.finish', { battleId: run.battleId, actions }, 'speedrun-finish');
  assert.equal(finished.status, 200);
  assert.equal(finished.result.battleResult.won, true);
  assert.equal(finished.account.speedrunUnlocked, 2);
  assert.equal(finished.account.daily.stages[1].best, finished.result.battleResult.time);
  assert.equal((await h.command(b, 'battle.start', { mode: 'speedrun', stageId: 2 })).status, 200);
  assert.equal((await h.command(b, 'battle.start', { mode: 'speedrun', stageId: 3 })).error, 'battle_locked');

  const [claim, retry] = await Promise.all([
    h.command(b, 'speedrun.claim', { stageId: 1 }, 'speedrun-claim'),
    h.command(b, 'speedrun.claim', { stageId: 1 }, 'speedrun-claim'),
  ]);
  assert.equal(claim.status, 200);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.result, claim.result);
  assert.equal(claim.account.tickets, 10);
  assert.equal(retry.account.tickets, 10);
  assert.equal((await h.command(b, 'speedrun.claim', { stageId: 1 })).error, 'action_unavailable');
});


test('server caps selected gem options, replaces selected types atomically and snapshots owned basics', async () => {
  const h=harness(), b=h.browser(); await h.call(b,'session/start');
  h.seed({onboarding:{phase:'complete'},earlyGuide:{phase:'complete'},highestCleared:11,
    gemItems:[
      {uid:'income',type:'income',level:1,optionTier:'normal',options:[]},
      {uid:'capacity',type:'capacity',level:1,optionTier:'normal',options:[]},
      {uid:'harvest',type:'harvest',level:1,optionTier:'normal',options:[{id:'acorn',value:.02}]},
      {uid:'bounty',type:'bounty',level:1,optionTier:'normal',options:[{id:'wildAttack',value:.05}]},
      {uid:'better',type:'income',level:4,optionTier:'normal',options:[{id:'attack',value:.03}]},
    ],
    gemEquipment:{},gold:10000});
  for(const uid of ['income','capacity','harvest']) {
    const response=await h.command(b,'gem.equip',{uid});assert.equal(response.status,200);
  }
  const selected={income:'income',capacity:'capacity',harvest:'harvest'};
  const storedBeforeRejections=h.sqlite.prepare('SELECT account_json FROM game_accounts LIMIT 1').get().account_json;
  const rejected=await h.command(b,'gem.equip',{uid:'bounty'},'over-cap');
  assert.equal(rejected.error,'action_unavailable');
  assert.equal(h.sqlite.prepare('SELECT account_json FROM game_accounts LIMIT 1').get().account_json,storedBeforeRejections);
  const invalidReplacement=await h.command(b,'gem.equip',{uid:'bounty',replaceType:'attack'},'invalid-replacement');
  assert.equal(invalidReplacement.error,'action_unavailable');
  assert.equal(h.sqlite.prepare('SELECT account_json FROM game_accounts LIMIT 1').get().account_json,storedBeforeRejections);
  assert.deepEqual(JSON.parse(storedBeforeRejections).gemEquipment,selected);
  const replaced=await h.command(b,'gem.equip',{uid:'better'},'replace-income');
  assert.equal(replaced.status,200);
  assert.deepEqual(replaced.account.gemEquipment,{income:'better',capacity:'capacity',harvest:'harvest'});
  const retry=await h.command(b,'gem.equip',{uid:'better'},'replace-income');
  assert.deepEqual(retry.account.gemEquipment,replaced.account.gemEquipment);
  assert.deepEqual(retry.result,replaced.result);
  const swapped=await h.command(b,'gem.equip',{uid:'bounty',replaceType:'capacity'},'replace-capacity');
  assert.equal(swapped.status,200);
  assert.deepEqual(swapped.account.gemEquipment,{income:'better',harvest:'harvest',bounty:'bounty'});
  const swappedRetry=await h.command(b,'gem.equip',{uid:'bounty',replaceType:'capacity'},'replace-capacity');
  assert.deepEqual(swappedRetry.account.gemEquipment,swapped.account.gemEquipment);
  assert.deepEqual(swappedRetry.result,swapped.result);
  assert.equal((await h.command(b,'gem.equip',{uid:'capacity'})).error,'action_unavailable');
  assert.equal((await h.command(b,'gem.equip',{uid:'missing'})).error,'action_unavailable');
  const started=await h.command(b,'battle.start',{mode:'speedrun',stageId:1});
  assert.equal(started.status,200);
  assert.equal(started.result.options.modifiers.goldIncome,1.175);
  assert.equal(started.result.options.modifiers.goldCapacity,1.15);
  assert.equal(started.result.options.modifiers.killGold,1.2);
  assert.equal(started.result.options.modifiers.acorn,1.17);
  assert.equal(started.result.options.modifiers.attack,1.03);
  assert.equal(started.result.options.modifiers.attributeBonuses.wild.attack,.05);
  assert.deepEqual(started.result.snapshot.gemEquipment,{income:'better',harvest:'harvest',bounty:'bounty'});
  const unequipped=await h.command(b,'gem.unequip',{type:'income'});
  assert.equal(unequipped.status,200);
  assert.deepEqual(unequipped.account.gemEquipment,{harvest:'harvest',bounty:'bounty'});
  assert.equal(unequipped.account.gemItems.find(g=>g.uid==='better').level,4);
  assert.equal((await h.command(b,'gem.unequip',{type:'income'})).error,'action_unavailable');
  const row=h.sqlite.prepare('SELECT battle_json FROM game_accounts LIMIT 1').get();
  const active=JSON.parse(row.battle_json);
  assert.equal(active.options.modifiers.goldIncome,1.175);
  assert.equal(active.options.modifiers.attack,1.03);
  assert.equal(active.snapshot.gemEquipment.income,'better');
});

test('server reroll retries return one saved gem mutation and charge once', async () => {
  const h=harness(), b=h.browser(); await h.call(b,'session/start');
  h.seed({onboarding:{phase:'complete'},earlyGuide:{phase:'complete'},highestCleared:11,gold:1000,
    gemItems:[{uid:'reroll-me',type:'income',level:2,optionTier:'normal',options:[{id:'hp',value:.02}]}],gemEquipment:{}});
  const [first,retry]=await Promise.all([
    h.command(b,'gem.reroll',{uid:'reroll-me'},'reroll-once'),
    h.command(b,'gem.reroll',{uid:'reroll-me'},'reroll-once'),
  ]);
  assert.equal(first.status,200);
  assert.equal(retry.status,200);
  assert.deepEqual(retry.result,first.result);
  assert.equal(first.account.gold,900);
  assert.equal(retry.account.gold,900);
  assert.deepEqual(first.account.gemItems.find(g=>g.uid==='reroll-me').options,first.result.options);
  assert.equal((await h.command(b,'gem.reroll',{uid:'missing'},'reroll-once')).error,'request_id_reused');
  assert.equal((await h.command(b,'settle')).account.gold,900);
});

test('server gem upgrade success and paid failure are saved once and ignore supplied client outcomes', async t => {
  let rolls=0, roll=.99;
  t.mock.method(globalThis.crypto,'getRandomValues',array=>{
    rolls++;array.fill(Math.floor(roll*4294967296));return array;
  });
  for(const success of [false,true]) {
    roll=success?0:.99;
    const h=harness(),b=h.browser();await h.call(b,'session/start');
    const target={uid:'target',type:'income',level:5,optionTier:'normal',options:[{id:'attack',value:.02}]};
    h.seed({onboarding:{phase:'complete'},earlyGuide:{phase:'complete'},highestCleared:11,gold:10000,
      gemItems:[target,...Array.from({length:5},(_,i)=>({uid:`mat${i}`,type:'income',level:1,optionTier:'normal',options:[]}))],
      gemEquipment:{income:'target'}});
    const args={uid:'target',materialUids:['mat0','mat1','mat2','mat3','mat4'],success:!success,random:success?.99:0};
    const beforeRolls=rolls;
    const [first,retry]=await Promise.all([
      h.command(b,'gem.upgrade',args,'upgrade-once'),h.command(b,'gem.upgrade',args,'upgrade-once')]);
    assert.equal(first.status,200);assert.equal(retry.status,200);
    assert.deepEqual(first.result,{success,level:success?6:5});
    assert.deepEqual(retry.result,first.result);
    assert.equal(first.account.gold,2500);assert.equal(retry.account.gold,2500);
    assert.deepEqual(first.account.gemItems,[{...target,level:success?6:5}]);
    assert.equal(first.account.gemEquipment.income,'target');
    const savedRolls=rolls;assert.equal(savedRolls-beforeRolls,1);
    assert.deepEqual((await h.command(b,'gem.upgrade',args,'upgrade-once')).result,first.result);
    assert.equal(rolls,savedRolls);
    assert.equal((await h.command(b,'settle')).account.gold,2500);
  }
});
