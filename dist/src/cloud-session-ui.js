import { authenticationRequired, SessionReplacedError } from "./account-client.js";
import { signInPath } from "./sign-in.js";

// Owns the connection overlay and its gameplay pause across server requests.
export class CloudSessionUI {
  constructor({ client, hooks, isReady, getIdentity, testLoginEnabled,
    document = globalThis.document, location = globalThis.location }) {
    Object.assign(this, { client, hooks, isReady, getIdentity, testLoginEnabled, document, location });
    this.root = null;
    this.state = null;
    this.paused = false;
  }

  ensureRoot() {
    if (this.root) return this.root;
    const root = this.document.createElement("section");
    root.setAttribute("role", "alertdialog");
    root.setAttribute("aria-live", "assertive");
    Object.assign(root.style, {
      position: "fixed", inset: "0", zIndex: "10000", display: "none",
      placeItems: "center", padding: "20px", background: "#171a15eF",
      color: "#f4f1e7", font: "600 16px system-ui, sans-serif", textAlign: "center",
    });
    this.document.body.append(root);
    this.root = root;
    return root;
  }

  show(state = this.state) {
    if (!state) return;
    this.state = state;
    const root = this.ensureRoot();
    const replaced = state.status === "replaced";
    const offline = ["offline", "connecting", "retrying"].includes(state.status);
    const loginRequired = state.status === "auth-required" || authenticationRequired(state.error);
    const testSession = loginRequired && (state.error?.payload?.error === "test_login_disabled" || this.client.identity?.kind === "test");
    if (replaced && this.isReady()) this.hooks.halt();
    if ((offline || loginRequired) && this.isReady() && !this.paused) {
      this.paused = true;
      this.hooks.pause();
    }
    if (!offline && !replaced && !loginRequired && this.isReady() && this.paused) {
      this.paused = false;
      this.hooks.resume();
    }
    if (!replaced && !offline && !loginRequired) {
      root.hidden = true;
      root.style.display = "none";
      return;
    }
    root.hidden = false;
    root.style.display = "grid";
    const connecting = ["connecting", "retrying"].includes(state.status);
    const useAccountChoice = state.error?.payload?.error === "account_exists";
    const heading = useAccountChoice ? "이미 연결된 계정이 있습니다" : replaced ? "다른 기기에서 접속했습니다" : testSession ? "테스트 계정 인증이 만료되었습니다" : loginRequired ? "ChatGPT 로그인이 필요합니다" : connecting ? "연결 중" : "서버에 연결할 수 없습니다";
    const action = replaced ? "여기서 계속하기" : testSession ? "테스트 로그인" : loginRequired ? "ChatGPT로 로그인" : useAccountChoice ? "기존 계정으로" : connecting ? "연결 중" : "다시 연결";
    const testDisabled = state.error?.payload?.error === "test_login_disabled";
    root.innerHTML = `<div style="max-width:320px"><strong style="display:block;margin-bottom:16px">${heading}</strong>${loginRequired ? `<a class="primary-button" href="${testSession ? '/?testLogin=1' : signInPath()}" target="_top">${action}</a>${testDisabled ? '<p>테스트 계정이 비활성화되었다면 운영자가 다시 활성화해야 합니다.</p>' : ''}` : `<button id="cloud-gate-action" style="padding:10px 18px;border:0;border-radius:10px;background:#e8d89a;color:#26271f;font:inherit">${action}</button>`}${this.testLoginEnabled && !connecting && !testSession ? '<a class="secondary-button" style="margin-top:12px" href="/?testLogin=1">테스트 로그인</a>' : ''}</div>`;
    if (loginRequired) return;
    const button = root.querySelector("#cloud-gate-action");
    button.disabled = connecting;
    button.onclick = async () => {
      button.disabled = true;
      try {
        if (useAccountChoice) {
          await this.client.startNewSession("account");
          this.location.reload();
        } else if (replaced) {
          if (this.getIdentity()?.kind === "test") { this.location.assign("/?testLogin=1"); return; }
          await this.client.startNewSession();
          this.location.reload();
        } else {
          await this.client.retry();
          if (state.operation !== "command") this.location.reload();
        }
      } catch (error) {
        this.show({ status: error instanceof SessionReplacedError ? "replaced" : authenticationRequired(error) ? "auth-required" : "offline", operation: state.operation, error });
      }
    };
  }
}
