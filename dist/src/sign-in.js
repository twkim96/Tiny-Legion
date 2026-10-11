// Sites owns authentication. These links must navigate the top-level page.
export function signInPath(action = "account") {
  const returnTo = action === "link" ? "/?login=link" : "/?login=account";
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
}

export function signInIntent(url) {
  const intent = new URL(url).searchParams.get("login");
  return ["account", "link"].includes(intent) ? intent : null;
}

export function entryPanel() {
  return `<div class="account-entry"><h1>Tiny Legion</h1><a class="primary-button" id="entry-account" href="${signInPath()}" target="_top">계정 로그인</a><button class="secondary-button" id="entry-guest">게스트로 시작</button><p>ChatGPT 계정</p></div>`;
}

const escapeText = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

export function accountIdentityPanel(identity) {
  if (identity?.kind !== "account") return '<div class="account-identity"><strong>게스트</strong><span>로그인 안 됨</span></div>';
  const name = identity.displayName || identity.email || "ChatGPT 계정";
  return `<div class="account-identity"><strong>로그인됨 · ChatGPT</strong><span>${escapeText(name)}</span>${identity.email && identity.email !== name ? `<span>${escapeText(identity.email)}</span>` : ""}</div>`;
}
