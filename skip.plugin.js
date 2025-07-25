/**
 * @name SkipRangeServer
 * @description Skip‐range editor synced to your server + smart skip button
 * @version 1.0.0
 */

(function () {
  "use strict";

  // ==== CONFIGURATION ====
  const SERVER_URL = "http://localhost:3000"; // your server endpoint

  // ==== ELEMENT IDs ====
  const INLINE_BTN_ID = "skiprange-setup-btn";
  const POPUP_ID = "skiprange-editor";
  const ACTIVE_BTN_ID = "skiprange-active-btn";

  // ==== HELPER: Inject & evaluate in page context ====
  function _eval(js) {
    return new Promise((resolve) => {
      const event = "stremio-enhanced";
      const script = document.createElement("script");
      window.addEventListener(
        event,
        (e) => {
          script.remove();
          resolve(e.detail);
        },
        { once: true }
      );
      script.appendChild(
        document.createTextNode(`
        (async () => {
          try {
            const res = ${js};
            if (res instanceof Promise) res.then(r => window.dispatchEvent(new CustomEvent('${event}', { detail: r }))); 
            else window.dispatchEvent(new CustomEvent('${event}', { detail: res }));
          } catch { window.dispatchEvent(new CustomEvent('${event}', { detail: null })); }
        })();`)
      );
      document.head.appendChild(script);
    });
  }

  // ==== HELPER: Get player state ====
  async function getPlayerState() {
    let state = null;
    while (!state?.metaItem?.content) {
      state = await _eval("window.services.core.transport.getState('player')");
      if (!state?.metaItem?.content)
        await new Promise((r) => setTimeout(r, 300));
    }
    return { seriesInfo: state.seriesInfo, meta: state.metaItem.content };
  }

  // ==== Unique episode ID ====
  async function getEpisodeId() {
    const { seriesInfo, meta } = await getPlayerState();
    return `${meta.id}:${seriesInfo?.episode || 0}`;
  }

  // ==== Parse mm:ss or seconds ====
  function parseTime(str) {
    if (str.includes(":")) {
      const [m, s] = str.split(":").map(Number);
      return (m || 0) * 60 + (s || 0);
    }
    return Number(str) || 0;
  }

  // ==== Popup editor ====
  function createEditor(bar, existing) {
    if (document.getElementById(POPUP_ID)) return;
    const pop = document.createElement("div");
    pop.id = POPUP_ID;
    Object.assign(pop.style, {
      position: "absolute",
      bottom: "50px",
      right: "0",
      background: "#222",
      color: "#fff",
      padding: "8px",
      border: "1px solid #666",
      borderRadius: "6px",
      zIndex: 9999,
      fontSize: "13px",
    });
    pop.innerHTML = `
      <label>Start: <input id="sr-start" style="width:50px" value="${
        existing?.start || ""
      }" placeholder="0"></label><br>
      <label>End:   <input id="sr-end"   style="width:50px" value="${
        existing?.end || ""
      }"   placeholder="10"></label><br>
      <button id="sr-save" style="margin-top:6px;padding:4px 8px">Save</button>`;
    bar.appendChild(pop);
    document.getElementById("sr-save").onclick = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const start = parseTime(document.getElementById("sr-start").value);
      const end = parseTime(document.getElementById("sr-end").value);
      if (!(end > start)) return alert("End must be > Start");
      const epId = await getEpisodeId();
      try {
        const res = await fetch(`${SERVER_URL}/ranges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeId: epId, start, end }),
        });
        if (!res.ok) throw new Error(res.status);
      } catch {
        console.error("[SkipRange] Failed to save to server");
      }
      pop.remove();
    };
  }

  // ==== Setup button ====
  function addSetupButton(bar) {
    if (document.getElementById(INLINE_BTN_ID)) return;
    const btn = document.createElement("button");
    btn.id = INLINE_BTN_ID;
    btn.textContent = "⏩ Setup";
    Object.assign(btn.style, {
      marginLeft: "8px",
      padding: "6px 8px",
      background: "#444",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "13px",
    });
    btn.onclick = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const epId = await getEpisodeId();
      let existing = null;
      try {
        const r = await fetch(
          `${SERVER_URL}/ranges/${encodeURIComponent(epId)}`
        );
        if (r.ok) existing = await r.json();
      } catch {}
      createEditor(bar, existing);
    };
    bar.appendChild(btn);
  }

  // ==== Active skip button ====
  function showActiveSkip(wrap, end) {
    if (document.getElementById(ACTIVE_BTN_ID)) return;
    const b = document.createElement("button");
    b.id = ACTIVE_BTN_ID;
    b.textContent = "⏩ Skip";
    Object.assign(b.style, {
      position: "absolute",
      bottom: "100px",
      right: "20px",
      padding: "8px 12px",
      background: "#27ae60",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "14px",
      zIndex: 1000,
    });
    b.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      document.querySelector("video").currentTime = end;
      b.remove();
    };
    wrap.appendChild(b);
  }

  // ==== Load range (server only) ====
  async function loadRange() {
    const epId = await getEpisodeId();
    try {
      const r = await fetch(`${SERVER_URL}/ranges/${encodeURIComponent(epId)}`);
      if (r.ok) return await r.json();
    } catch {
      console.error("[SkipRange] Fetch error");
    }
    return null; // no fallback
  }

  // ==== Observer ====
  const obs = new MutationObserver(() => {
    const bar = document.querySelector(
      ".control-bar-buttons-menu-container-M6L0_"
    );
    if (bar) addSetupButton(bar);
    const vid = document.querySelector("video"),
      wrap = vid?.parentElement;
    if (vid && wrap) {
      loadRange().then((r) => {
        if (!r) {
          document.getElementById(ACTIVE_BTN_ID)?.remove();
          return;
        }
        const { start, end } = r;
        vid.addEventListener("timeupdate", () => {
          const btn = document.getElementById(ACTIVE_BTN_ID);
          if (vid.currentTime >= start && vid.currentTime < end) {
            showActiveSkip(wrap, end);
          } else if (btn) {
            btn.remove();
          }
        });
      });
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();
