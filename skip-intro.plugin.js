/**
 * @name SkipIntro
 * @description Skip Intro for shows and movies in Stremio Enhanced
 * @version 1.0.0
 * @author shugi12345
 */

(function () {
  "use strict";

  const SERVER_URL = "https://stremio-skip-button.onrender.com";
  const INLINE_BTN_ID = "skiprange-setup-btn";
  const POPUP_ID = "skiprange-editor";
  const ACTIVE_BTN_ID = "skiprange-active-btn";
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;
  const STORAGE_PREFIX = "skipintro:";

  let currentEpisodeId = null;
  let currentRange = null;
  let lastVideo = null;
  let onTimeUpdate = null;
  let popupOpen = false;
  const rangeCache = {};

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

      script.textContent = `
        (async () => {
          try {
            const res = ${js};
            if (res instanceof Promise) res.then(r => window.dispatchEvent(new CustomEvent('${event}', { detail: r })));
            else window.dispatchEvent(new CustomEvent('${event}', { detail: res }));
          } catch (err) {
            console.error('[SkipIntro] _eval error:', err);
            window.dispatchEvent(new CustomEvent('${event}', { detail: null }));
          }
        })();`;
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
    const [min, sec] = str.split(":").map(Number);
    return (min || 0) * 60 + (sec || 0);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  async function fetchRangeWithRetry(epId) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(
          `[SkipIntro] Fetching /ranges/${epId} (attempt ${attempt})`
        );

        const res = await fetch(
          `${SERVER_URL}/ranges/${encodeURIComponent(epId)}`
        );

        if (res.status === 204 || res.status === 404) {
          console.log(
            `[SkipIntro] No skip data for episode ${epId} (${res.status})`
          );
          return null;
        }

        if (!res.ok) {
          console.warn(
            `[SkipIntro] Unexpected response for ${epId}: ${res.status}`
          );
          return null;
        }

        const json = await res.json();
        console.log(
          `[SkipIntro] Loaded range: start=${json.start}s → end=${json.end}s`
        );
        return json;
      } catch (err) {
        console.error(`[SkipIntro] Error fetching range for ${epId}:`, err);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
        } else {
          return null;
        }
      }
    }
    return null;
  }

  function createLabeledInput(id, labelText, value, placeholder, marginLeft) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    Object.assign(input, { id, value: value || "", placeholder });
    Object.assign(input.style, {
      width: "50px",
      color: "white",
      marginLeft,
    });
    label.appendChild(input);
    return label;
  }

  function createEditor(container, existing) {
    if (document.getElementById(POPUP_ID) || popupOpen) return;
    popupOpen = true;

    const popup = document.createElement("div");
    popup.id = POPUP_ID;
    Object.assign(popup.style, {
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

    const storageKey = STORAGE_PREFIX + currentEpisodeId;
    const draft = JSON.parse(localStorage.getItem(storageKey) || "{}");

    const startLabel = createLabeledInput(
      "sr-start",
      "Start: ",
      draft.start ||
        (existing?.start != null ? formatTime(existing.start) : ""),
      "00:00",
      "15px"
    );

    const endLabel = createLabeledInput(
      "sr-end",
      "End: ",
      draft.end || (existing?.end != null ? formatTime(existing.end) : ""),
      "00:30",
      "22px"
    );

    const saveDraft = () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          start: document.getElementById("sr-start").value,
          end: document.getElementById("sr-end").value,
        })
      );
    };
    startLabel.querySelector("input").addEventListener("input", saveDraft);
    endLabel.querySelector("input").addEventListener("input", saveDraft);

    const saveBtn = document.createElement("button");
    Object.assign(saveBtn, {
      id: "sr-save",
      textContent: "Save",
    });
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
    saveBtn.onmouseover = () => (saveBtn.style.backgroundColor = "#1b192b");
    saveBtn.onmouseout = () => (saveBtn.style.backgroundColor = "#0f0d20");

    saveBtn.onclick = async (e) => {
      e.preventDefault();
      const start = parseTime(document.getElementById("sr-start").value);
      const end = parseTime(document.getElementById("sr-end").value);

      if (!(end > start)) return alert("End must be greater than Start");
      if (existing && start === existing.start && end === existing.end) {
        popup.remove();
        popupOpen = false;
        return;
      }

      try {
        const { meta, seriesInfo } = await getPlayerState();
        const epId = `${meta.id}:${seriesInfo?.episode || 0}`;
        const title = meta?.name || "Unknown Title";

        let readableTitle = title;
        if (seriesInfo?.season != null && seriesInfo?.episode != null) {
          const season = String(seriesInfo.season).padStart(2, "0");
          const episode = String(seriesInfo.episode).padStart(2, "0");
          readableTitle = `${title} S${season}E${episode}`;
        }

        const res = await fetch(`${SERVER_URL}/ranges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeId: epId,
            start,
            end,
            title: readableTitle,
          }),
        });

        if (!res.ok) throw new Error(res.status);

        localStorage.removeItem(storageKey);
        delete rangeCache[epId];
        currentRange = await fetchRangeWithRetry(epId);
        if (lastVideo) attachTimeUpdate();
      } catch (err) {
        console.error("[SkipIntro] Failed to save range:", err);
      }

      popup.remove();
      popupOpen = false;
    };

    document.addEventListener("click", function closePopup(e) {
      if (!popup.contains(e.target) && e.target.id !== INLINE_BTN_ID) {
        popup.remove();
        popupOpen = false;
        document.removeEventListener("click", closePopup);
      }
    });

    document.addEventListener("keydown", function escClose(e) {
      if (e.key === "Escape") {
        popup.remove();
        popupOpen = false;
        document.removeEventListener("keydown", escClose);
      }
    });

    popup.append(startLabel, endLabel, saveBtn);
    container.appendChild(popup);
  }

  function addSetupButton(bar) {
    if (document.getElementById(INLINE_BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = INLINE_BTN_ID;

    const icon = document.createElement("img");
    Object.assign(icon, {
      src: "https://www.svgrepo.com/show/532105/clock-lines.svg",
      width: 30,
      height: 30,
      alt: "Clock icon",
    });
    icon.style.filter = "brightness(0) invert(1)";
    icon.style.pointerEvents = "none";

    Object.assign(btn.style, {
      padding: "6px",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
    });

    btn.appendChild(icon);
    btn.onclick = () => {
      const existingPopup = document.getElementById(POPUP_ID);
      if (existingPopup) {
        existingPopup.remove();
        popupOpen = false;
        return;
      }
      createEditor(bar, currentRange);
    };

    bar.prepend(btn);
  }

  function showActiveSkip(container, end) {
    if (document.getElementById(ACTIVE_BTN_ID)) return;

    const skipBtn = document.createElement("button");
    skipBtn.id = ACTIVE_BTN_ID;
    skipBtn.textContent = "Skip Intro";

    const icon = document.createElement("img");
    icon.src = "https://www.svgrepo.com/show/471906/skip-forward.svg";
    icon.alt = "Skip icon";
    icon.width = 24;
    icon.height = 24;
    icon.style.filter = "brightness(0) invert(1)";
    icon.style.pointerEvents = "none";

    Object.assign(skipBtn.style, {
      position: "absolute",
      bottom: "130px",
      right: "10vh",
      padding: "16px",
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
    });

    skipBtn.prepend(icon);
    skipBtn.onmouseover = () => (skipBtn.style.backgroundColor = "#1b192b");
    skipBtn.onmouseout = () => (skipBtn.style.backgroundColor = "#0f0d20");
    skipBtn.onclick = (e) => {
      e.preventDefault();
      if (document.querySelector("video"))
        document.querySelector("video").currentTime = end;
      skipBtn.remove();
    };

    container.appendChild(skipBtn);
  }

  function attachTimeUpdate() {
    if (onTimeUpdate && lastVideo) {
      lastVideo.removeEventListener("timeupdate", onTimeUpdate);
    }

    onTimeUpdate = () => {
      const video = lastVideo;
      const btn = document.getElementById(ACTIVE_BTN_ID);
      const inRange =
        currentRange &&
        video.currentTime >= currentRange.start &&
        video.currentTime < currentRange.end;

      if (inRange && !btn)
        showActiveSkip(video.parentElement, currentRange.end);
      else if (!inRange && btn) btn.remove();
    };

    lastVideo?.addEventListener("timeupdate", onTimeUpdate);
  }

  let lastCheckedEpisodeId = null;

  async function onPlay() {
    const epId = await getEpisodeId();
    if (epId !== currentEpisodeId || epId !== lastCheckedEpisodeId) {
      lastCheckedEpisodeId = epId;
      currentEpisodeId = epId;
      currentRange = await fetchRangeWithRetry(epId);
      if (lastVideo) attachTimeUpdate();
    }
  }

  function attachPlayListener() {
    const video = document.querySelector("video");
    if (!video || video === lastVideo) return;

    lastVideo?.removeEventListener("play", onPlay);
    if (onTimeUpdate)
      lastVideo?.removeEventListener("timeupdate", onTimeUpdate);

    video.addEventListener("play", onPlay);
    lastVideo = video;
  }

  const observer = new MutationObserver(() => {
    const bar = document.querySelector(
      ".control-bar-buttons-menu-container-M6L0_"
    );
    if (bar) addSetupButton(bar);
    attachPlayListener();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
