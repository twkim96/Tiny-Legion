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
