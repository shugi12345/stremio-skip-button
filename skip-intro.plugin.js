/**
 * @name SkipIntro
 * @description Skip‐range editor synced to your server + smart skip button
 * @version 1.0.4 (single-fetch + post-save re-fetch)
 */

(function () {
  "use strict";

  const SERVER_URL = "http://localhost:3000";
  const INLINE_BTN_ID = "skiprange-setup-btn";
  const POPUP_ID = "skiprange-editor";
  const ACTIVE_BTN_ID = "skiprange-active-btn";
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500; // ms
  const REFETCH_DELAY = 2000; // ms after saving

  // ==== Page-context evaluator ====
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
            if (res instanceof Promise)
              res.then(r => window.dispatchEvent(new CustomEvent('${event}', { detail: r })));
            else
              window.dispatchEvent(new CustomEvent('${event}', { detail: res }));
          } catch (err) {
            console.error('[SkipRange] _eval error:', err);
            window.dispatchEvent(new CustomEvent('${event}', { detail: null }));
          }
        })();`)
      );
      document.head.appendChild(script);
    });
  }

  // ==== Player-state helpers ====
  async function getPlayerState() {
    let state = null;
    while (!state?.metaItem?.content) {
      state = await _eval("window.services.core.transport.getState('player')");
      if (!state?.metaItem?.content)
        await new Promise((r) => setTimeout(r, 300));
    }
    return { seriesInfo: state.seriesInfo, meta: state.metaItem.content };
  }
  async function getEpisodeId() {
    const { seriesInfo, meta } = await getPlayerState();
    return `${meta.id}:${seriesInfo?.episode || 0}`;
  }

  // ==== Time parsing ====
  function parseTime(str) {
    if (str.includes(":")) {
      const [m, s] = str.split(":").map(Number);
      return (m || 0) * 60 + (s || 0);
    }
    return Number(str) || 0;
  }

  // ==== HEAD+GET with retry & status logic ====
  async function fetchRangeWithRetry(epId) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[SkipRange] HEAD /ranges/${epId} (attempt ${attempt})`);
        const head = await fetch(
          `${SERVER_URL}/ranges/${encodeURIComponent(epId)}`,
          { method: "HEAD" }
        );

        if (head.status === 404) {
          console.error("[SkipRange] API missing (404). Aborting.");
          return null;
        }
        if (head.status === 204) {
          console.log("[SkipRange] No skip data (204).");
          return null;
        }
        if (head.status === 200) {
          console.log("[SkipRange] Data exists (200) – fetching JSON…");
          const getRes = await fetch(
            `${SERVER_URL}/ranges/${encodeURIComponent(epId)}`
          );
          if (getRes.ok) {
            const data = await getRes.json();
            console.log(
              `[SkipRange] Got range: start=${data.start}, end=${data.end}`
            );
            return data;
          }
          console.error(`[SkipRange] GET failed: ${getRes.status}`);
          return null;
        }
        console.warn(`[SkipRange] Unexpected HEAD status: ${head.status}`);
        return null;
      } catch (err) {
        console.error(`[SkipRange] Network error (attempt ${attempt}):`, err);
        if (attempt < MAX_RETRIES) {
          console.log(`[SkipRange] Retrying in ${RETRY_DELAY}ms…`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
        } else {
          console.error("[SkipRange] All retry attempts failed.");
          return null;
        }
      }
    }
    return null;
  }

  // ==== Popup editor (unchanged) ====
  function createEditor(bar, existing) {
    if (document.getElementById(POPUP_ID)) return;
    console.log("[SkipRange] Opening editor popup");
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

    function closeOutside(e) {
      if (!pop.contains(e.target) && e.target.id !== INLINE_BTN_ID) {
        pop.remove();
        document.removeEventListener("click", closeOutside);
        console.log("[SkipRange] Editor popup closed");
      }
    }
    document.addEventListener("click", closeOutside);

    document.getElementById("sr-save").onclick = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const start = parseTime(document.getElementById("sr-start").value);
      const end = parseTime(document.getElementById("sr-end").value);
      if (!(end > start)) {
        alert("End must be > Start");
        return;
      }

      const epId = await getEpisodeId();
      console.log(
        `[SkipRange] Saving range for ${epId}: start=${start}, end=${end}`
      );
      try {
        const res = await fetch(`${SERVER_URL}/ranges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeId: epId, start, end }),
        });
        if (!res.ok) throw new Error(res.status);
        console.log("[SkipRange] Range saved 👍");
        // After save, re-fetch in a moment so skip UI appears immediately
        setTimeout(() => loadRangeForCurrentEpisode(), REFETCH_DELAY);
      } catch (err) {
        console.error("[SkipRange] Failed to save:", err);
      }
      pop.remove();
      document.removeEventListener("click", closeOutside);
    };
  }

  // ==== Setup button (unchanged) ====
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
      console.log(`[SkipRange] Setup clicked for ${epId}`);
      let existing = null;
      try {
        const head = await fetch(
          `${SERVER_URL}/ranges/${encodeURIComponent(epId)}`,
          { method: "HEAD" }
        );
        if (head.status === 200) {
          const getRes = await fetch(
            `${SERVER_URL}/ranges/${encodeURIComponent(epId)}`
          );
          if (getRes.ok) existing = await getRes.json();
        }
      } catch (err) {
        console.error("[SkipRange] Error loading existing range:", err);
      }
      createEditor(bar, existing);
    };
    bar.appendChild(btn);
  }

  // ==== Skip button UI ====
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
      console.log("[SkipRange] Skip clicked → jumped to", end);
    };
    wrap.appendChild(b);
  }

  // ==== One-fetch-per-episode + post-save re-fetch ====
  let currentEpisodeId = null;
  let currentRange = null;
  let lastVideo = null;
  let onTimeUpdate = null;

  async function loadRangeForCurrentEpisode() {
    if (!currentEpisodeId) return;
    const data = await fetchRangeWithRetry(currentEpisodeId);
    currentRange = data;
    if (data && lastVideo) {
      attachTimeUpdate();
    }
  }

  function attachTimeUpdate() {
    if (onTimeUpdate && lastVideo) {
      lastVideo.removeEventListener("timeupdate", onTimeUpdate);
    }
    onTimeUpdate = () => {
      if (
        lastVideo.currentTime >= currentRange.start &&
        lastVideo.currentTime < currentRange.end
      ) {
        console.log("[SkipRange] Within skip window→ showing Skip");
        showActiveSkip(lastVideo.parentElement, currentRange.end);
      }
    };
    lastVideo.addEventListener("timeupdate", onTimeUpdate);
  }

  async function onPlayOnceCheck() {
    const epId = await getEpisodeId();
    if (epId !== currentEpisodeId) {
      currentEpisodeId = epId;
      currentRange = null;
      console.log(
        `[SkipRange] New episode ${epId} started—fetching range once`
      );
      await loadRangeForCurrentEpisode();
    }
  }

  function attachPlayListener() {
    const video = document.querySelector("video");
    if (!video || video === lastVideo) return;
    if (lastVideo) {
      lastVideo.removeEventListener("play", onPlayOnceCheck);
      if (onTimeUpdate)
        lastVideo.removeEventListener("timeupdate", onTimeUpdate);
    }
    video.addEventListener("play", onPlayOnceCheck);
    lastVideo = video;
  }

  // ==== Observer to wire everything up ====
  const obs = new MutationObserver(() => {
    const bar = document.querySelector(
      ".control-bar-buttons-menu-container-M6L0_"
    );
    if (bar) addSetupButton(bar);
    attachPlayListener();
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();
