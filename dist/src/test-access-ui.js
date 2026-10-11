export function testLoginPanel() {
  return `<form id="test-login-form" class="test-login-form"><label for="test-username">아이디</label><input id="test-username" name="username" autocomplete="username" maxlength="32" required><label for="test-password">비밀번호</label><input id="test-password" name="password" type="password" autocomplete="current-password" maxlength="128" required><p id="test-login-error" role="alert"></p><div class="modal-message-actions"><button type="button" class="secondary-button" id="cancel-test-login">취소</button><button type="submit" class="primary-button" id="submit-test-login">로그인</button></div></form>`;
}

export function bindTestLogin(root, client, { onSuccess, onCancel }) {
  root.querySelector('#cancel-test-login').onclick = onCancel;
  root.querySelector('#test-login-form').onsubmit = async event => {
    event.preventDefault();
    const button = root.querySelector('#submit-test-login');
    if (button.disabled) return;
    const username = root.querySelector('#test-username').value.trim();
    const password = root.querySelector('#test-password').value;
    root.querySelector('#test-password').value = '';
    const errorLabel = root.querySelector('#test-login-error');
    errorLabel.textContent = '';
    button.disabled = true;
    try {
      const envelope = await client.startTestSession(username, password);
      onSuccess(envelope);
    } catch (error) {
      errorLabel.textContent = error?.payload?.error === 'invalid_credentials' ? '아이디 또는 비밀번호를 확인해 주세요.'
        : error?.status === 429 ? '잠시 후 다시 로그인해 주세요.'
        : error?.payload?.error === 'test_login_disabled' ? '테스트 로그인이 닫혔습니다.'
        : '로그인하지 못했습니다. 다시 시도해 주세요.';
      button.disabled = false;
    }
  };
}

export function adminPanel(account, fmt, icon) {
  return `<div class="admin-currency-grid">${[['gold', '도토리', 'acorn'], ['diamonds', '다이아', 'gem']].map(([currency, name, glyph]) => `<section class="admin-currency"><h3>${icon(glyph)}${name}</h3><strong>${fmt(account[currency])}</strong><div>${[1000, 10000].map(amount => `<button class="primary-button" data-admin-grant="${currency}" data-amount="${amount}">+${fmt(amount)}</button>`).join('')}</div></section>`).join('')}</div>`;
}
