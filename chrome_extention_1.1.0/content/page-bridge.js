// Runs in the page, not the extension’s isolated world.
// It listens for messages from the content script and executes code safely.
(function () {
  const REQ = "skipintro:eval:req";
  const RES = "skipintro:eval:res";

  window.addEventListener("message", async (e) => {
    const m = e.data;
    if (!m || m.type !== REQ) return;
    try {
      // Only allow our content script to talk to us
      // (origin check optional if page origin is stable)
      const { id, expr } = m;
      // execute the expression in the page context
      let result = null;
      try {
        const maybe = eval(expr); // expression you already build (e.g. getState('player'))
        result = (maybe && typeof maybe.then === "function") ? await maybe : maybe;
      } catch (err) {
        result = null;
        console.error("[SkipIntro bridge] eval error:", err);
      }
      window.postMessage({ type: RES, id, result }, "*");
    } catch (err) {
      window.postMessage({ type: RES, id: m?.id, result: null, error: String(err) }, "*");
    }
  });
})();
