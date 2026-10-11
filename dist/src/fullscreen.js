// Call from a click handler so the browser still has user activation.
export async function enterLandscapeFullscreen(doc = document, orientation = globalThis.screen?.orientation) {
  if (!doc.fullscreenElement) {
    if (!doc.documentElement.requestFullscreen || doc.fullscreenEnabled === false)
      return { fullscreen: false, landscapeLocked: false, message: "이 브라우저에서는 전체 화면을 지원하지 않아요. 기기를 가로로 돌려주세요." };
    try {
      await doc.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      return { fullscreen: false, landscapeLocked: false, message: "전체 화면으로 전환하지 못했어요. 다시 누르거나 기기를 가로로 돌려주세요." };
    }
  }
  if (typeof orientation?.lock === "function") {
    try {
      await orientation.lock("landscape");
      if (!doc.fullscreenElement) {
        try { orientation.unlock?.(); } catch { /* The browser may already have released the lock. */ }
        return { fullscreen: false, landscapeLocked: false, message: "전체 화면이 종료됐어요. 다시 눌러주세요." };
      }
      return { fullscreen: true, landscapeLocked: true, message: "" };
    } catch {
      // Fullscreen remains usable even when orientation locking is unavailable.
    }
  }
  return { fullscreen: true, landscapeLocked: false, message: "기기를 가로로 돌려주세요. 화면이 돌아가지 않으면 회전 잠금을 해제해 주세요." };
}

export function bindRotationPrompt(doc = document, orientation = globalThis.screen?.orientation) {
  const button = doc.getElementById("rotate-fullscreen");
  const status = doc.getElementById("rotate-status");
  if (!button || !status) return;
  button.onclick = async () => {
    button.disabled = true;
    status.textContent = "";
    try {
      const result = await enterLandscapeFullscreen(doc, orientation);
      status.textContent = result.message;
    } finally {
      button.disabled = false;
    }
  };
  doc.addEventListener("fullscreenchange", () => {
    button.textContent = doc.fullscreenElement ? "가로 화면" : "전체 화면";
    if (!doc.fullscreenElement) {
      try { orientation?.unlock?.(); } catch { /* Unsupported browsers need no cleanup. */ }
      status.textContent = "";
    }
  });
}
