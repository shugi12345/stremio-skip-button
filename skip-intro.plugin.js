/**
 * @name SkipIntro
 * @description Skip‐range editor synced to your server + smart skip button
 * @version 1.1.1 DOM refactor
 */

(function () {
  "use strict";

  const SERVER_URL = "http://localhost:3000";
  const INLINE_BTN_ID = "skiprange-setup-btn";
  const POPUP_ID = "skiprange-editor";
  const ACTIVE_BTN_ID = "skiprange-active-btn";
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500;
  const REFETCH_DELAY = 2000;

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

  function parseTime(str) {
    if (str.includes(":")) {
      const [m, s] = str.split(":").map(Number);
      return (m || 0) * 60 + (s || 0);
    }
    return Number(str) || 0;
  }

  async function fetchRangeWithRetry(epId) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[SkipRange] HEAD /ranges/${epId} (attempt ${attempt})`);
        const head = await fetch(
          `${SERVER_URL}/ranges/${encodeURIComponent(epId)}`,
          { method: "HEAD" }
        );

        if (head.status === 404) return null;
        if (head.status === 204) return null;
        if (head.status === 200) {
          const getRes = await fetch(
            `${SERVER_URL}/ranges/${encodeURIComponent(epId)}`
          );
          if (getRes.ok) return await getRes.json();
          return null;
        }
        return null;
      } catch {
        if (attempt < MAX_RETRIES)
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
        else return null;
      }
    }
    return null;
  }

  function createLabeledInput(id, labelText, value, placeholder, marginLeft) {
    const label = document.createElement("label");
    label.textContent = labelText;

    const input = document.createElement("input");
    input.id = id;
    input.value = value || "";
    input.placeholder = placeholder;
    Object.assign(input.style, {
      width: "50px",
      color: "white",
      marginLeft,
    });

    label.appendChild(input);
    return label;
  }

  function createEditor(bar, existing) {
    if (document.getElementById(POPUP_ID)) return;

    const pop = document.createElement("div");
    pop.id = POPUP_ID;
    Object.assign(pop.style, {
      width: "150px",
      position: "absolute",
      bottom: "120px",
      background: "#0f0d20",
      color: "#fff",
      padding: "10px",
      borderRadius: "6px",
      zIndex: 9999,
      fontSize: "16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    });

    const startLabel = createLabeledInput(
      "sr-start",
      "Start: ",
      existing?.start,
      "00:00",
      "15px"
    );
    const endLabel = createLabeledInput(
      "sr-end",
      "End: ",
      existing?.end,
      "00:30",
      "22px"
    );

    const saveBtn = document.createElement("button");
    saveBtn.id = "sr-save";
    saveBtn.textContent = "Save";
    Object.assign(saveBtn.style, {
      marginTop: "6px",
      padding: "10px 20px",
      color: "white",
      cursor: "pointer",
      backgroundColor: "#0f0d20",
      border: "none",
      borderRadius: "6px",
      transition: "background-color .3s",
    });
    saveBtn.addEventListener(
      "mouseover",
      () => (saveBtn.style.backgroundColor = "#1b192b")
    );
    saveBtn.addEventListener(
      "mouseout",
      () => (saveBtn.style.backgroundColor = "#0f0d20")
    );

    saveBtn.onclick = async (e) => {
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
        setTimeout(() => loadRangeForCurrentEpisode(), REFETCH_DELAY);
      } catch (err) {
        console.error("[SkipRange] Failed to save:", err);
      }
      pop.remove();
      document.removeEventListener("click", closeOutside);
    };

    function closeOutside(e) {
      if (!pop.contains(e.target) && e.target.id !== INLINE_BTN_ID) {
        pop.remove();
        document.removeEventListener("click", closeOutside);
      }
    }

    document.addEventListener("click", closeOutside);
    pop.append(startLabel, endLabel, saveBtn);
    bar.appendChild(pop);
  }

  function addSetupButton(bar) {
    if (document.getElementById(INLINE_BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = INLINE_BTN_ID;

    const icon = document.createElement("img");
    icon.src = "https://www.svgrepo.com/show/532105/clock-lines.svg";
    icon.width = 30;
    icon.height = 30;
    icon.alt = "Clock icon";
    Object.assign(icon.style, {
      verticalAlign: "middle",
      filter: "brightness(0) invert(1)",
    });

    Object.assign(btn.style, {
      padding: "6px",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
    });

    btn.appendChild(icon);
    btn.onclick = async (e) => {
      e.preventDefault();
      const epId = await getEpisodeId();
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
    bar.prepend(btn);
  }

  function showActiveSkip(wrap, end) {
    if (document.getElementById(ACTIVE_BTN_ID)) return;

    const b = document.createElement("button");
    b.id = ACTIVE_BTN_ID;
    b.textContent = "Skip Intro";

    const icon = document.createElement("img");
    icon.src = "https://www.svgrepo.com/sho/471906/skip-forward.svg";
    icon.alt = "Skip icon";
    icon.width = 24;
    icon.height = 24;
    Object.assign(icon.style, {
      filter: "brightness(0) invert(1)",
    });

    Object.assign(b.style, {
      position: "absolute",
      bottom: "130px",
      right: "10vh",
      padding: "8px 12px",
      background: "#0f0d20",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "24px",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "16px",
    });

    b.prepend(icon);

    b.addEventListener("mouseover", () => {
      b.style.backgroundColor = "#1b192b";
    });
    b.addEventListener("mouseout", () => {
      b.style.backgroundColor = "#0f0d20";
    });

    b.onclick = (e) => {
      e.preventDefault();
      document.querySelector("video").currentTime = end;
      b.remove();
    };

    wrap.appendChild(b);
  }

  let currentEpisodeId = null;
  let currentRange = null;
  let lastVideo = null;
  let onTimeUpdate = null;

  async function loadRangeForCurrentEpisode() {
    if (!currentEpisodeId) return;
    const data = await fetchRangeWithRetry(currentEpisodeId);
    currentRange = data;
    if (data && lastVideo) attachTimeUpdate();
  }

  function attachTimeUpdate() {
    if (onTimeUpdate && lastVideo)
      lastVideo.removeEventListener("timeupdate", onTimeUpdate);

    onTimeUpdate = () => {
      if (
        lastVideo.currentTime >= currentRange.start &&
        lastVideo.currentTime < currentRange.end
      ) {
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

  const obs = new MutationObserver(() => {
    const bar = document.querySelector(
      ".control-bar-buttons-menu-container-M6L0_"
    );
    if (bar) addSetupButton(bar);
    attachPlayListener();
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();
