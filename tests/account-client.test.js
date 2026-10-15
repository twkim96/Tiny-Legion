import test from "node:test";
import assert from "node:assert/strict";
import { AccountClient, SessionReplacedError, bootstrapAccount } from "../dist/src/account-client.js";

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function sessionEnvelope({ session = "session-a", account = { gold: 5 }, created = false } = {}) {
  return { account, session, revision: 1, serverNow: Date.now(), returnIncome: null, created };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('definitive command conflicts reject once with the original code and do not retry or block later commands', async () => {
  for (const code of ['battle_not_found', 'battle_version_mismatch', 'battle_too_early', 'request_id_reused', 'command_expired', 'state_changed']) {
    const calls = [];
    const client = new AccountClient({ sessionStorage: null, fetchImpl: async (path, init) => {
      const body = JSON.parse(init.body);
      calls.push({ path, body });
      if (path.endsWith('/start')) return response(sessionEnvelope());
      if (body.type === 'battle.finish') return response({ error: code }, 409);
      return response({ account: { gold: 5 }, revision: 2, serverNow: Date.now(), result: true });
    } });
    await client.startNewSession();
    const rejected = assert.rejects(client.command('battle.finish', { battleId: 'old', actions: [] }), error =>
      error.status === 409 && error.payload.error === code);
    const next = client.command('settings', { speed: 1 });
    await rejected;
    assert.equal((await next).result, true);
    assert.deepEqual(calls.map(call => call.path), ['/api/game/session/start', '/api/game/command', '/api/game/command']);
    assert.equal(await client.retry(), false);
    assert.equal(client.status, 'connected');
  }
});

test("a revoked resume stops and only an explicit start creates a replacement session", async () => {
  const calls = [];
  const client = new AccountClient({
    sessionStorage: {
      getItem: () => "revoked-token",
      setItem() {},
    },
    fetchImpl: async (path, init) => {
      calls.push({ path, init });
      if (path.endsWith("/resume")) return response({ error: "session_replaced" }, 409);
      return response(sessionEnvelope({ session: "new-token" }));
    },
  });

  await assert.rejects(client.bootstrap(), SessionReplacedError);
  assert.equal(client.status, "replaced");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/game/session/resume");

  const envelope = await client.startNewSession();
  assert.equal(envelope.session, "new-token");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].path, "/api/game/session/start");
  assert.equal(calls[1].init.headers["X-Game-Session"], undefined);
});

test("an explicit guest session start sends the requested identity", async () => {
  let startRequest;
  const client = new AccountClient({
    fetchImpl: async (path, init) => {
      if (path.endsWith("/start")) {
        startRequest = { path, body: JSON.parse(init.body), headers: init.headers };
        return response(sessionEnvelope({ session: "guest-token" }));
      }
      throw new Error(`unexpected ${path}`);
    },
  });

  await client.startNewSession("guest");
  assert.deepEqual(startRequest.body, { identity: "guest" });
  assert.equal(startRequest.headers["X-Game-Session"], undefined);
});

test("test login replaces the game session without storing the password or retrying rejected credentials", async () => {
  const stored = new Map();
  const calls = [];
  let rejectLogin = false;
  const client = new AccountClient({
    sessionStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
    fetchImpl: async (path, init) => {
      calls.push({path, body: JSON.parse(init.body), headers: init.headers});
      if (rejectLogin) return response({error:'invalid_credentials'}, 401);
      return response({...sessionEnvelope({session:'test-token'}), identity:{kind:'test',displayName:'root',isAdmin:true}});
    },
  });
  await client.startTestSession('root', '12345');
  assert.equal(calls[0].path, '/api/game/test/login');
  assert.deepEqual(calls[0].body, {username:'root',password:'12345'});
  assert.equal(calls[0].headers['X-Game-Session'], undefined);
  assert.equal(client.identity.isAdmin, true);
  assert.deepEqual([...stored.values()], ['test-token']);
  rejectLogin = true;
  await assert.rejects(client.startTestSession('root','wrong'), error => error.status === 401);
  assert.equal(client.status,'connected');
  assert.equal(client.token,'test-token');
  assert.equal(client.retryAction,null);
});

test("commands serialize in submission order", async () => {
  const firstReply = deferred();
  const secondReply = deferred();
  const calls = [];
  const client = new AccountClient({
    requestId: (() => { let id = 0; return () => `request-${++id}`; })(),
    fetchImpl: async (path, init) => {
      if (path.endsWith("/start")) return response(sessionEnvelope());
      calls.push(JSON.parse(init.body));
      return calls.length === 1 ? firstReply.promise : secondReply.promise;
    },
  });
  await client.bootstrap();
  const first = client.command("grow", { id: "sheep" });
  const second = client.command("ability", { id: "sheep", abilityId: "guard" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.map((item) => item.type), ["grow"]);
  firstReply.resolve(response({ account: { gold: 4 }, result: true, revision: 2 }));
  await first;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.map((item) => item.type), ["grow", "ability"]);
  secondReply.resolve(response({ account: { gold: 3 }, result: true, revision: 3 }));
  await second;
});

test("failed commands retain their request ID and block later commands until retry", async () => {
  const calls = [];
  let failNextCommand = true;
  let nextId = 1;
  const account = { gold: 4, obsolete: true };
  const client = new AccountClient({
    requestId: () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
    fetchImpl: async (path, init) => {
      const body = JSON.parse(init.body);
      calls.push({ path, body });
      if (path.endsWith("/start")) return response(sessionEnvelope({ account: { gold: 4 } }));
      if (failNextCommand) {
        failNextCommand = false;
        throw new Error("connection lost");
      }
      return response({ account: { gold: 7 }, revision: 2, serverNow: Date.now(), result: ["pull"] });
    },
  });
  await client.bootstrap();
  client.setAccountTarget(account);

  const command = client.command("recruit", { count: 1, free: true, banner: "forest" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.status, "offline");
  assert.equal(calls.length, 2);
  assert.equal(account.gold, 4);
  assert.equal(account.obsolete, true);
  await assert.rejects(client.command("reset", {}), /session is unavailable/);

  const retry = client.retry();
  const envelope = await command;
  await retry;
  assert.deepEqual(calls.slice(1).map(({ body }) => body.requestId), [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000001",
  ]);
  assert.deepEqual(envelope.result, ["pull"]);
  assert.equal(account.gold, 7);
  assert.equal("obsolete" in account, false);
});

test("a late command reply cannot overwrite the account after explicit session replacement", async () => {
  const commandReply = deferred();
  const account = { gold: 1 };
  let commandStarted;
  const started = new Promise((resolve) => { commandStarted = resolve; });
  let starts = 0;
  const client = new AccountClient({
    fetchImpl: async (path) => {
      if (path.endsWith("/start")) {
        starts++;
        return response(sessionEnvelope({ session: `session-${starts}`, account: { gold: starts * 10 } }));
      }
      if (path.endsWith("/command")) {
        commandStarted();
        return commandReply.promise;
      }
      throw new Error(`unexpected ${path}`);
    },
  });
  await client.bootstrap();
  client.setAccountTarget(account);
  const stale = client.command("settle", {}).catch((error) => error);
  await started;
  await client.startNewSession();
  assert.equal(account.gold, 20);

  commandReply.resolve(response({ account: { gold: 999 }, revision: 99, result: true }));
  assert.ok(await stale instanceof SessionReplacedError);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(account.gold, 20);
});

test("hosted bootstrap never invokes the local account loader", () => {
  let localLoads = 0;
  const account = { gold: 12 };
  assert.deepEqual(bootstrapAccount({ hosted: true, envelope: { account }, loadLocal: () => { localLoads++; } }), { account, error: null });
  assert.equal(localLoads, 0);
  assert.deepEqual(bootstrapAccount({ hosted: false, loadLocal: () => { localLoads++; return { account: { gold: 4 }, error: false }; } }), { account: { gold: 4 }, error: false });
  assert.equal(localLoads, 1);
});

test("lost or malformed successful replies retain the command ID and block subsequent spending", async () => {
  const invalidReplies = [
    { ok: true, status: 200, json: async () => { throw new TypeError("body lost"); } },
    response(null), response({ result: true }),
    response({ account: [], revision: 2, result: true }),
    response({ account: { gold: 90 }, revision: 2 }),
  ];
  for (const invalid of invalidReplies) {
    const receipt = new Map(), calls = [];
    let balance = 100, id = 0, lost = true;
    const account = { gold: 100 };
    const client = new AccountClient({
      sessionStorage: null, requestId: () => `request-${++id}`,
      fetchImpl: async (path, init) => {
        if (path.endsWith("/start")) return response(sessionEnvelope({ account }));
        const body = JSON.parse(init.body);
        calls.push(body.requestId);
        if (!receipt.has(body.requestId)) {
          balance -= 10;
          receipt.set(body.requestId, { account: { gold: balance }, revision: receipt.size + 2, result: true });
        }
        if (lost) { lost = false; return invalid; }
        return response(receipt.get(body.requestId));
      },
    });
    await client.bootstrap(); client.setAccountTarget(account);
    const first = client.command("recruit.units", { count: 1 });
    const second = client.command("unit.grow", { id: "sheep" });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(client.status, "offline");
    assert.equal(client.queue.length, 2);
    assert.equal(account.gold, 100);
    assert.deepEqual(calls, ["request-1"]);
    await assert.rejects(client.command("recruit.units", { count: 1 }));
    await client.retry(); await first; await second;
    assert.deepEqual(calls, ["request-1", "request-1", "request-2"]);
    assert.equal(balance, 80); assert.equal(account.gold, 80);
    assert.equal(receipt.size, 2);
  }
});

test("timeouts cover fetch and response-body receipt; a late reply cannot apply or spend twice", async () => {
  for (const phase of ["fetch", "body"]) {
    const late = deferred(), calls = [];
    let attempts = 0, signal;
    const account = { gold: 100 };
    const confirmed = { account: { gold: 90 }, revision: 2, result: true };
    const client = new AccountClient({
      requestTimeoutMs: 15, sessionStorage: null, requestId: () => "one-purchase",
      fetchImpl: async (path, init) => {
        if (path.endsWith("/start")) return response(sessionEnvelope({ account }));
        calls.push(JSON.parse(init.body).requestId); signal = init.signal;
        if (++attempts === 1)
          return phase === "fetch" ? late.promise : { ok: true, status: 200, json: () => late.promise };
        return response(confirmed);
      },
    });
    const stopped = deferred();
    client.onState = state => { if (state.status === "offline") stopped.resolve(); };
    await client.bootstrap(); client.setAccountTarget(account);
    const purchase = client.command("recruit.units", {});
    await stopped.promise;
    assert.equal(signal.aborted, true);
    assert.equal(client.queue.length, 1);
    await client.retry(); await purchase;
    assert.equal(account.gold, 90);
    late.resolve(phase === "fetch" ? response({ account: { gold: 1 }, revision: 99, result: true }) : { account: { gold: 1 }, revision: 99, result: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(account.gold, 90);
    assert.deepEqual(calls, ["one-purchase", "one-purchase"]);
    assert.equal(client.status, "connected");
  }
});

test("expired account and disabled test authentication stop queued commands until explicit login", async () => {
  for (const [code, status] of [["login_required", 401], ["test_login_disabled", 403]]) {
    const calls = [], states = [];
    let authenticated = false;
    const client = new AccountClient({
      sessionStorage: null, onState: state => states.push(state.status),
      fetchImpl: async (path) => {
        if (path.endsWith("/start")) return response(sessionEnvelope());
        if (path.endsWith("/test/login")) { authenticated = true; return response(sessionEnvelope()); }
        calls.push(path);
        return authenticated ? response({ account: { gold: 4 }, revision: 2, result: true }) : response({ error: code }, status);
      },
    });
    await client.bootstrap();
    const first = client.command("unit.grow", {}).catch(error => error);
    const second = client.command("recruit.units", {}).catch(error => error);
    assert.equal((await first).payload.error, code);
    assert.equal((await second).payload.error, code);
    assert.equal(client.status, "auth-required");
    assert.equal(calls.length, 1);
    assert.equal(await client.retry(), false);
    await assert.rejects(client.command("settle", {}));
    await client.startTestSession("player", "password");
    await client.command("settle", {});
    assert.equal(client.status, "connected");
    assert.ok(states.includes("auth-required"));
  }
});

test("authentication expiry on resume is distinct from a guest link requesting login", async () => {
  const client = new AccountClient({ sessionStorage: null, fetchImpl: async path =>
    path.endsWith("/start") ? response(sessionEnvelope()) : response({ error: "login_required" }, 401) });
  await client.bootstrap();
  await assert.rejects(client.linkAccount(), error => error.payload.error === "login_required");
  assert.equal(client.status, "connected");
  await assert.rejects(client.resumeSession(), error => error.payload.error === "login_required");
  assert.equal(client.status, "auth-required");
});

test("bootstrap authentication failure does not offer a network retry", async () => {
  const client = new AccountClient({ sessionStorage: { getItem: () => "expired" },
    fetchImpl: async () => response({ error: "login_required" }, 401) });
  await assert.rejects(client.bootstrap());
  assert.equal(client.status, "auth-required");
  assert.equal(await client.retry(), false);
});
