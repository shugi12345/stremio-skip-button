const SERVER_URL = "https://busy-jacinta-shugi-c2885b2e.koyeb.app";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type !== "api") return;
    try {
      const { method = "GET", path = "/", query = null, body = null, headers = {} } = msg;
      const url = new URL(path, SERVER_URL);
      if (query && typeof query === "object") {
        for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
      }
      const init = {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: ["POST","PUT","PATCH","DELETE"].includes(method.toUpperCase()) ? JSON.stringify(body ?? {}) : undefined
      };

      console.info("[SW] fetch", url.toString(), init);
      const res = await fetch(url.toString(), init);
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : await res.text();
      console.info("[SW] response", res.status, ct);

      sendResponse({ ok: res.ok, status: res.status, data });
    } catch (err) {
      console.error("[SW] fetch error", err);
      sendResponse({ ok: false, status: 0, error: String(err) });
    }
  })();
  return true;
});
