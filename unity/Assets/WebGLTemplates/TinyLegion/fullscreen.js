// Generated from dist/src/fullscreen.js; do not edit.
var TinyLegionFullscreen = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var stdin_exports = {};
  __export(stdin_exports, {
    bindRotationPrompt: () => bindRotationPrompt,
    enterLandscapeFullscreen: () => enterLandscapeFullscreen
  });
  async function enterLandscapeFullscreen(doc = document, orientation = ((_a) => (_a = globalThis.screen) == null ? void 0 : _a.orientation)()) {
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
  }
  function bindRotationPrompt(doc = document, orientation = ((_a) => (_a = globalThis.screen) == null ? void 0 : _a.orientation)()) {
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
      var _a2;
      button.textContent = doc.fullscreenElement ? "\uAC00\uB85C \uD654\uBA74" : "\uC804\uCCB4 \uD654\uBA74";
      if (!doc.fullscreenElement) {
        try {
          (_a2 = orientation == null ? void 0 : orientation.unlock) == null ? void 0 : _a2.call(orientation);
        } catch (e) {
        }
        status.textContent = "";
      }
    });
  }
  return __toCommonJS(stdin_exports);
})();
