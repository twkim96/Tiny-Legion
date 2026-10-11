const SESSION_STORAGE_KEY = "tiny-legion.game-session";

export class SessionReplacedError extends Error {
  constructor() {
    super("session_replaced");
    this.name = "SessionReplacedError";
    this.code = "session_replaced";
  }
}

export class AccountClientError extends Error {
  constructor(message, { status = 0, payload = null } = {}) {
    super(message);
    this.name = "AccountClientError";
    this.status = status;
    this.payload = payload;
  }
}

function defaultUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.random() * 256;
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeSessionStorage(explicit) {
  if (explicit !== undefined) return explicit;
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function serverTimeValue(value) {
  if (typeof value === "number" && Number.isFinite(value))
    return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function bootstrapAccount({ hosted, envelope, loadLocal }) {
  if (hosted) {
    if (!envelope?.account) throw new AccountClientError("hosted account bootstrap is unavailable");
    return { account: envelope.account, error: null };
  }
  return loadLocal();
}

export class AccountClient {
  constructor({
    fetchImpl = globalThis.fetch?.bind(globalThis),
    sessionStorage,
    requestId = defaultUuid,
    onState = () => {},
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.storage = safeSessionStorage(sessionStorage);
    this.requestId = requestId;
    this.onState = onState;
    this.accountTarget = null;
    this.identity = null;
    this.token = this.#readToken();
    this.status = "idle";
    this.epoch = 0;
    this.queue = [];
    this.running = false;
    this.blocked = false;
    this.retryAction = null;
    this.serverTime = null;
    this.serverTimeReceivedAt = 0;
    this.revision = null;
  }

  setAccountTarget(account) {
    this.accountTarget = account;
  }

  #readToken() {
    try {
      return this.storage?.getItem(SESSION_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }

  now() {
    return this.serverTime === null
      ? Date.now()
      : this.serverTime + (Date.now() - this.serverTimeReceivedAt);
  }

  async bootstrap() {
    const epoch = ++this.epoch;
    const token = this.token;
    const endpoint = token
      ? "/api/game/session/resume"
      : "/api/game/session/start";
    this.#setState("connecting", token ? "resume" : "start");
    try {
      const envelope = await this.#post(endpoint, {}, token);
      if (epoch !== this.epoch) throw new SessionReplacedError();
      this.#acceptSession(envelope, epoch);
      return envelope;
    } catch (error) {
      if (error instanceof SessionReplacedError) {
        this.#replaceSession();
        throw error;
      }
      this.retryAction = () => this.bootstrap();
      this.#setState("offline", token ? "resume" : "start", error);
      throw error;
    }
  }

  async startNewSession(identity = undefined) {
    const epoch = ++this.epoch;
    this.#rejectQueue(new SessionReplacedError());
    this.blocked = false;
    this.retryAction = null;
    this.#setState("connecting", "start");
    try {
      const body = identity ? { identity } : {};
      const envelope = await this.#post("/api/game/session/start", body, null);
      if (epoch !== this.epoch) throw new SessionReplacedError();
      this.#acceptSession(envelope, epoch);
      return envelope;
    } catch (error) {
      if (error instanceof SessionReplacedError) {
        this.#replaceSession();
        throw error;
      }
      this.retryAction = () => this.startNewSession(identity);
      this.#setState("offline", "start", error);
      throw error;
    }
  }

  resumeSession() {
    if (this.status !== "connected" || !this.token)
      return Promise.reject(new AccountClientError("account session is unavailable"));
    const item = {
      epoch: this.epoch,
      requestId: null,
      type: null,
      args: {},
      path: "/api/game/session/resume",
      resolve: null,
      reject: null,
      promise: null,
    };
    item.promise = new Promise((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });
    this.queue.push(item);
    this.#pump();
    return item.promise;
  }

  command(type, args = {}) {
    if (this.status !== "connected")
      return Promise.reject(new AccountClientError("account session is unavailable"));
    const item = {
      epoch: this.epoch,
      requestId: this.requestId(),
      type,
      args,
      path: "/api/game/command",
      resolve: null,
      reject: null,
      promise: null,
    };
    item.promise = new Promise((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });
    this.queue.push(item);
    this.#pump();
    return item.promise;
  }

  linkAccount() {
    if (this.status !== "connected")
      return Promise.reject(new AccountClientError("account session is unavailable"));
    const item = {
      epoch: this.epoch,
      requestId: null,
      type: null,
      args: {},
      path: "/api/game/account/link",
      resolve: null,
      reject: null,
      promise: null,
    };
    item.promise = new Promise((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });
    this.queue.push(item);
    this.#pump();
    return item.promise;
  }

  retry() {
    if (this.status !== "offline") return Promise.resolve(false);
    if (this.retryAction) {
      const action = this.retryAction;
      this.retryAction = null;
      return action();
    }
    if (!this.queue.length) return Promise.resolve(false);
    this.blocked = false;
    this.#setState("retrying", "command");
    this.#pump();
    return this.queue[0]?.promise ?? Promise.resolve(true);
  }

  async #post(path, body, token) {
    if (typeof this.fetchImpl !== "function")
      throw new AccountClientError("fetch is unavailable");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["X-Game-Session"] = token;
    let response;
    try {
      response = await this.fetchImpl(path, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (cause) {
      const error = new AccountClientError("network request failed", { payload: cause });
      error.network = true;
      throw error;
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.status === 409 && payload?.error === "session_replaced")
      throw new SessionReplacedError();
    if (!response.ok) {
      const error = new AccountClientError(payload?.error ?? `request failed (${response.status})`, {
        status: response.status,
        payload,
      });
      if (response.status >= 500) error.network = true;
      throw error;
    }
    return payload;
  }

  #acceptSession(envelope, epoch) {
    if (epoch !== this.epoch) throw new SessionReplacedError();
    if (!envelope || typeof envelope.session !== "string" || !envelope.account)
      throw new AccountClientError("invalid game session response");
    this.token = envelope.session;
    try {
      this.storage?.setItem(SESSION_STORAGE_KEY, this.token);
    } catch {}
    this.#acceptEnvelope(envelope);
    this.#setState("connected", "session");
  }

  #acceptEnvelope(envelope) {
    if (envelope.account && this.accountTarget) {
      for (const key of Object.keys(this.accountTarget))
        if (!Object.prototype.hasOwnProperty.call(envelope.account, key))
          delete this.accountTarget[key];
      Object.assign(this.accountTarget, envelope.account);
    }
    if (envelope.revision !== undefined) this.revision = envelope.revision;
    if (envelope.identity) this.identity = envelope.identity;
    const serverTime = serverTimeValue(envelope.serverNow);
    if (serverTime !== null) {
      this.serverTime = serverTime;
      this.serverTimeReceivedAt = Date.now();
    }
  }

  #replaceSession() {
    this.epoch++;
    this.blocked = false;
    this.retryAction = null;
    this.#rejectQueue(new SessionReplacedError());
    this.#setState("replaced", "session");
  }

  #rejectQueue(error) {
    for (const item of this.queue.splice(0)) item.reject(error);
  }

  #setState(status, operation, error = null) {
    this.status = status;
    this.onState({ status, operation, error });
  }

  async #pump() {
    if (this.running || this.blocked || !this.queue.length) return;
    if (this.status !== "connected" && this.status !== "retrying") return;
    this.running = true;
    const item = this.queue[0];
    const epoch = this.epoch;
    try {
      const body = item.path.endsWith("/command")
        ? { requestId: item.requestId, type: item.type, args: item.args }
        : item.args;
      const envelope = await this.#post(item.path, body, this.token);
      if (epoch !== this.epoch || item.epoch !== this.epoch) return;
      this.#acceptEnvelope(envelope);
      this.queue.shift();
      item.resolve(envelope);
      this.retryAction = null;
      this.#setState("connected", "command");
    } catch (error) {
      if (epoch !== this.epoch || item.epoch !== this.epoch) return;
      if (error instanceof SessionReplacedError) {
        this.#replaceSession();
      } else if (error.status === 409 && error.payload?.error === "account_exists") {
        this.queue.shift();
        item.reject(error);
        this.#setState("connected", "account-exists", error);
      } else if (error.network) {
        this.blocked = true;
        this.retryAction = null;
        this.#setState("offline", "command", error);
      } else {
        this.queue.shift();
        item.reject(error);
        this.#setState("connected", "command-error", error);
      }
    } finally {
      this.running = false;
      if (!this.blocked && this.status === "connected") this.#pump();
    }
  }
}
