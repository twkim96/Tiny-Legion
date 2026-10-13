// Generated from dist/src/fullscreen.js by scripts/unity/export-platform.mjs.
// Edit the maintained browser function, then export; do not maintain a second copy.
mergeInto(LibraryManager.library, {
  $TL_EnterLandscapeFullscreen: async function(doc = document, orientation = globalThis.screen?.orientation) {
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
},
  $TL_FullscreenHooks: {
    installed: false,
    unlock: function() { try { globalThis.screen?.orientation?.unlock?.(); } catch {} },
    install: function() {
      if (this.installed) return;
      this.installed = true;
      document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement) TL_FullscreenHooks.unlock();
      });
    }
  },
  TL_Fullscreen__deps: ['$TL_EnterLandscapeFullscreen', '$TL_FullscreenHooks'],
  TL_Fullscreen: function() {
    TL_FullscreenHooks.install();
    if (document.fullscreenElement) {
      Promise.resolve().then(function() { return document.exitFullscreen(); })
        .then(function() { TL_FullscreenHooks.unlock(); })
        .catch(function() { alert('전체 화면을 종료하지 못했습니다. 브라우저의 전체화면 종료 버튼을 사용해 주세요.'); });
      return;
    }
    // The maintained async function requests fullscreen during user activation.
    TL_EnterLandscapeFullscreen().then(function(result) {
      if (result.message) alert(result.message);
    }).catch(function() { alert('전체화면을 사용할 수 없습니다. 기기를 가로로 돌려 주세요.'); });
  }
});
