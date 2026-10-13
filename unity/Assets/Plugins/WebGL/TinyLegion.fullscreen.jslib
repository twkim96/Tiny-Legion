// Generated from dist/src/fullscreen.js; export-platform.mjs lowers syntax for Unity.
mergeInto(LibraryManager.library, {
  $TL_EnterLandscapeFullscreen: async function(doc = document, orientation = ((_a) => (_a = globalThis.screen) == null ? void 0 : _a.orientation)()) {
    var _a2;
    if (!doc.fullscreenElement) {
      if (!doc.documentElement.requestFullscreen || doc.fullscreenEnabled === false)
        return { fullscreen: false, landscapeLocked: false, message: "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C\uB294 \uC804\uCCB4 \uD654\uBA74\uC744 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC544\uC694. \uAE30\uAE30\uB97C \uAC00\uB85C\uB85C \uB3CC\uB824\uC8FC\uC138\uC694." };
      try {
        await doc.documentElement.requestFullscreen({ navigationUI: "hide" });
      } catch (e) {
        return { fullscreen: false, landscapeLocked: false, message: "\uC804\uCCB4 \uD654\uBA74\uC73C\uB85C \uC804\uD658\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \uAE30\uAE30\uB97C \uAC00\uB85C\uB85C \uB3CC\uB824\uC8FC\uC138\uC694." };
      }
    }
    if (typeof (orientation == null ? void 0 : orientation.lock) === "function") {
      try {
        await orientation.lock("landscape");
        if (!doc.fullscreenElement) {
          try {
            (_a2 = orientation.unlock) == null ? void 0 : _a2.call(orientation);
          } catch (e) {
          }
          return { fullscreen: false, landscapeLocked: false, message: "\uC804\uCCB4 \uD654\uBA74\uC774 \uC885\uB8CC\uB410\uC5B4\uC694. \uB2E4\uC2DC \uB20C\uB7EC\uC8FC\uC138\uC694." };
        }
        return { fullscreen: true, landscapeLocked: true, message: "" };
      } catch (e) {
      }
    }
    return { fullscreen: true, landscapeLocked: false, message: "\uAE30\uAE30\uB97C \uAC00\uB85C\uB85C \uB3CC\uB824\uC8FC\uC138\uC694. \uD654\uBA74\uC774 \uB3CC\uC544\uAC00\uC9C0 \uC54A\uC73C\uBA74 \uD68C\uC804 \uC7A0\uAE08\uC744 \uD574\uC81C\uD574 \uC8FC\uC138\uC694." };
  },
  $TL_FullscreenHooks: {
    installed: false,
    unlock: function() {
      var _a, _b, _c;
      try {
        (_c = (_b = (_a = globalThis.screen) == null ? void 0 : _a.orientation) == null ? void 0 : _b.unlock) == null ? void 0 : _c.call(_b);
      } catch (e) {
      }
    },
    install: function() {
      if (this.installed) return;
      this.installed = true;
      document.addEventListener("fullscreenchange", function() {
        if (!document.fullscreenElement) TL_FullscreenHooks.unlock();
      });
    }
  },
  TL_Fullscreen__deps: ["$TL_EnterLandscapeFullscreen", "$TL_FullscreenHooks"],
  TL_Fullscreen: function() {
    TL_FullscreenHooks.install();
    if (document.fullscreenElement) {
      Promise.resolve().then(function() {
        return document.exitFullscreen();
      }).then(function() {
        TL_FullscreenHooks.unlock();
      }).catch(function() {
        alert("\uC804\uCCB4 \uD654\uBA74\uC744 \uC885\uB8CC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uBE0C\uB77C\uC6B0\uC800\uC758 \uC804\uCCB4\uD654\uBA74 \uC885\uB8CC \uBC84\uD2BC\uC744 \uC0AC\uC6A9\uD574 \uC8FC\uC138\uC694.");
      });
      return;
    }
    TL_EnterLandscapeFullscreen().then(function(result) {
      if (result.message) alert(result.message);
    }).catch(function() {
      alert("\uC804\uCCB4\uD654\uBA74\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uAE30\uAE30\uB97C \uAC00\uB85C\uB85C \uB3CC\uB824 \uC8FC\uC138\uC694.");
    });
  }
});
