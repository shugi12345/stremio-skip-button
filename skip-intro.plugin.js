/**
 * @name SkipIntro
 * @description Skip Intro for shows and movies in Stremio Enhanced
 * @version 1.1.0
 * @author shugi12345
 */

(function () {
  "use strict";

  const SERVER_URL = "https://busy-jacinta-shugi-c2885b2e.koyeb.app/"; // Change to your server URL
  const PLUGIN_VERSION = "1.1.0"; // Keep in sync with server
  const REPO_URL = "https://github.com/shugi12345/stremio-skip-button/releases";
  const INLINE_BTN_ID = "skiprange-setup-btn";
  const POPUP_ID = "skiprange-editor";
  const ACTIVE_BTN_ID = "skiprange-active-btn";
  const UPGRADE_BTN_ID = "skiprange-upgrade-btn";
  const ICON_BAR_CLASS = ".control-bar-buttons-menu-container-M6L0_";
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  let video = null;
  let episodeId = null;
  let fileId = null;
  let title = null;
  let start = null;
  let tempStart = null;
  let end = null;
  let tempEnd = null;
  let offset = 0;
  let onTimeUpdate = null;
  let popupOpen = false;
  let serverPluginVersion = null;
  
  async function onPlay() {
    video = document.querySelector("video");
    serverPluginVersion = await fetchServerPluginVersion();
    if (await updateVerCheck(PLUGIN_VERSION, serverPluginVersion) === "BREAKING") {
      return;
    }
    episodeId = await getEpisodeId();
    fileId = await simpleHash();
    title = await getTitle();
    console.log(`[SkipIntro] \nEpisode ID: ${episodeId}, \nFileID: ${fileId}, \nTitle: ${title}`);
    await fetchData();
    tempStart = start;
    tempEnd = end;
  }
  async function fetchData() {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[SkipIntro] Fetching /ranges/${episodeId} (attempt ${attempt})`);
      try {
        const quaryParams = new URLSearchParams({ fileId, title });
        const res = await fetch(`${SERVER_URL}/ranges/${encodeURIComponent(episodeId)}?${quaryParams}`);
        if (res.status === 204) {
          start = 0;
          end = 0;
          console.log(`[SkipIntro] No skip data for episode ${episodeId} (${res.status})`);
          return null;
        }
        if (res.status === 404) {
          console.warn(`[SkipIntro] Server not found at URL ${SERVER_URL}`);
          return null;
        }
        if (!res.ok) {
          console.warn(`[SkipIntro] Unexpected response for ${episodeId}: ${res.status}`);
          return null;
        }
        const json = await res.json();
        start = json.start;
        end = json.end;
        offset = json.offset || 0;
        console.log(`[SkipIntro] Loaded range: start=${start}s → end=${end}s, offset=${offset}s`);
        highlightRangeOnBar();
        attachTimeUpdate();
        return null;
      } catch (err) {
        console.error(`[SkipIntro] Error fetching range for ${episodeId}:`, err);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY));
        } else {
          return null;
        }
      }
    }
    return null;
  }
  function sendData(newStart, newEnd, newOffset) {
        try {
          fetch(`${SERVER_URL}/ranges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ episodeId, fileId, start: newStart, end: newEnd, offset: newOffset, title }),
          })
          console.log(`[SkipIntro] Successfully sent data to server for ${episodeId}: startTime: ${newStart}, endTime: ${newEnd}, offset: ${newOffset}, title: ${title}`);
          setTimeout(() => {
            fetchData();
          }, 3000);
        } catch {
          console.error(`[SkipIntro] Error sending data to server for ${episodeId}`);
          return { ok: false, status: 500 };
        }
  }
  function attachTimeUpdate() {
    onTimeUpdate = async () => {
      const inRange =
        video.currentTime >= start + offset &&
        video.currentTime < end + offset;
      if (inRange && !document.getElementById(ACTIVE_BTN_ID)) {
        await showSkipButton(video.parentElement, end + offset);
      } else if ((!inRange || video.currentTime >= end + offset) &&
                 document.getElementById(ACTIVE_BTN_ID)) {
        document.getElementById(ACTIVE_BTN_ID).remove();
      }
    };
    let onSeeked = () => onTimeUpdate();
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);
  }
  function addSetupButton(iconBar) {
    if (document.getElementById(INLINE_BTN_ID)) return;
    const btn = document.createElement("button");
    btn.id = INLINE_BTN_ID;
    const icon = document.createElement("img");
    Object.assign(icon, {
      src: "https://www.svgrepo.com/show/532105/clock-lines.svg",
      width: 30, height: 30, alt: "Clock icon"
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
      const existing = document.getElementById(POPUP_ID);
      if (existing) {
        existing.remove();
        popupOpen = false;
      } else {
        popupEditor(iconBar);
      }
    };
    iconBar.prepend(btn);
  }
  async function popupEditor(iconBar) {
    if (document.getElementById(POPUP_ID) || popupOpen) return;
    popupOpen = true;
    const numKeyBlocker = e => {
      if (!/^[0-9]$/.test(e.key)) 
        return;
      if ( e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)
        return; 

      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener("keydown", numKeyBlocker, { capture: true });

    const popup = document.createElement("div");
    popup.id = POPUP_ID;
    Object.assign(popup.style, {
      width: "calc(220px + 1vw)",
      position: "absolute",
      bottom: "120px",
      background: "#0f0d20",
      color: "#fff",
      padding: "10px",
      borderRadius: "8px",
      zIndex: 9999,
      fontSize: "16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    });

    const startLabel = nowButton(
      "sr-start", "Start: ",
      formatTime(tempStart) || (start != null ? formatTime(start) : ""),
      "00:00", "15px"
    );

    const endLabel = nowButton(
      "sr-end", "End: ",
      formatTime(tempEnd) || (end != null ? formatTime(end) : ""),
      "00:30", "22px"
    );

    // Save button
    const saveBtn = document.createElement("button");
    Object.assign(saveBtn, { id: "sr-save", textContent: "Save" });
    Object.assign(saveBtn.style, {
      marginTop: "6px",
      padding: "10px 20px",
      color: "white",
      cursor: "pointer",
      backgroundColor: "#0f0d20",
      border:         "2px solid #1b192b",
      borderRadius:   "8px",
      transition: "background-color .3s",
    });
    saveBtn.onmouseover = () => saveBtn.style.backgroundColor = "#1b192b";
    saveBtn.onmouseout = () => saveBtn.style.backgroundColor = "#0f0d20";

    saveBtn.onclick = async (e) => {
    e.preventDefault();

    const newStart = parseTime(document.getElementById("sr-start").value);
    const newEnd   = parseTime(document.getElementById("sr-end").value);

    if (!(newEnd > newStart)) {
      return Swal.fire({
        icon: "error",
        title: "Invalid range",
        text: "End time must be greater than start time."
      });
    }
    if(start === 0 && end ===0){
        await sendData(newStart, newEnd, offset);
        popup.remove();
        popupOpen = false;
    }
    else{
      const result = await Swal.fire({
        title: "Are you sure?",
        html: `
          Editing the intro will change it for everyone else.<br>
          If there’s a delay, please adjust the offset option.
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, save it",
        cancelButtonText: "Cancel",
        reverseButtons: true
      });

      if (result.isConfirmed) {
        await sendData(newStart, newEnd, offset);
        popup.remove();
        popupOpen = false;
      }
    }
  };

    // Offset button
    const offsetBtn = document.createElement("button");
    Object.assign(offsetBtn, { id: "sr-offset", textContent: "Offset" });
    Object.assign(offsetBtn.style, {
      marginTop: "6px",
      marginLeft: "8px",
      padding: "10px 20px",
      color: "white",
      cursor: "pointer",
      backgroundColor: "#0f0d20",
      border:         "2px solid #1b192b",
      borderRadius:   "8px",
      transition: "background-color .3s",
    });
    offsetBtn.onmouseover = () => offsetBtn.style.backgroundColor = "#1b192b";
    offsetBtn.onmouseout  = () => offsetBtn.style.backgroundColor = "#0f0d20";
    offsetBtn.onclick     = (e) => {
      e.preventDefault();
      showOffsetPopup();
    };

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, {
      display: "flex",
      flexDirection: "row",
      gap: "8px",
      marginTop: "6px"
    });
    btnRow.append(saveBtn, offsetBtn);

    // Close handlers
    document.addEventListener("click", function closePopup(e) {
      if (!popup.contains(e.target) && e.target.id !== INLINE_BTN_ID) {
        if(tempStart === null || tempEnd === null) {
          tempStart = parseTime(document.getElementById("sr-start").value);
          tempEnd   = parseTime(document.getElementById("sr-end").value);
        }
        document.removeEventListener("keydown", numKeyBlocker, { capture: true });
        popup.remove();
        popupOpen = false;
        document.removeEventListener("click", closePopup);
      }
    });
    document.addEventListener("keydown", function escClose(e) {
      if (e.key === "Escape") {
        tempStart = parseTime(document.getElementById("sr-start").value);
        tempEnd   = parseTime(document.getElementById("sr-end").value);
        document.removeEventListener("keydown", numKeyBlocker, { capture: true });
        popup.remove();
        popupOpen = false;
        document.removeEventListener("keydown", escClose);
      }
    });

    popup.append(startLabel, endLabel, btnRow);
    iconBar.appendChild(popup);
  }
  async function showOffsetPopup() {
    if (document.getElementById("sr-offset-popup")) return;
    
    // Create offset popup
    const offsetPopup = document.createElement("div");
    offsetPopup.id = "sr-offset-popup";
    Object.assign(offsetPopup.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "#0f0d20",
      color: "#fff",
      padding: "18px 24px",
      borderRadius: "8px",
      zIndex: 99999,
      fontSize: "18px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.4)"
    });

    const label = document.createElement("span");
    label.textContent = "Offset (seconds): ";
    // now field for offset
    const nowOffsetBtn = document.createElement("button");
    nowOffsetBtn.type = "button";
    nowOffsetBtn.textContent = "Now";
    Object.assign(nowOffsetBtn.style, {
      padding: "6px 12px",
      fontSize: "14px",
      color: "white",
      backgroundColor: "#0f0d20",
      border:         "2px solid #1b192b",
      borderRadius:   "8px",
      cursor: "pointer",
      transition: "background-color .3s"
    });
    nowOffsetBtn.onmouseover = () => nowOffsetBtn.style.backgroundColor = "#1b192b";
    nowOffsetBtn.onmouseout = () => nowOffsetBtn.style.backgroundColor = "#0f0d20";
    nowOffsetBtn.onclick = () => {
      if (video != null && typeof start === 'number') {
        const relativeOffset = Math.floor(video.currentTime - start);
        input.value = relativeOffset;
        input.dispatchEvent(new Event('input'));
      }
    };

    // Input field for offset
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.25";
    input.value = offset || 0;
    Object.assign(input.style, {
      width: "60px",
      marginRight: "8px",
      fontSize: "16px",
      color: "white",
      background: "#0f0d20",
      border:         "2px solid #1b192b",
      borderRadius:   "8px",
    });

    // Save‐offset button
    const saveOffsetBtn = document.createElement("button");
    saveOffsetBtn.textContent = "Save Offset";
    Object.assign(saveOffsetBtn.style, {
      padding: "6px 12px",
      color: "white",
      backgroundColor: "#0f0d20",
      border:         "2px solid #1b192b",
      borderRadius:   "8px",
      cursor: "pointer",
      fontSize: "14px",
      transition: "background-color .3s"
    });
    saveOffsetBtn.onmouseover = () => saveOffsetBtn.style.backgroundColor = "#1b192b";
    saveOffsetBtn.onmouseout = () => saveOffsetBtn.style.backgroundColor = "#0f0d20";

    saveOffsetBtn.onclick = async () => {
      const newOffset = Number(input.value) || 0;
      await sendData(start, end, newOffset);
      offsetPopup.remove();
    };

    // Assemble popup
    offsetPopup.append(nowOffsetBtn, label, input, saveOffsetBtn);
    document.body.appendChild(offsetPopup);

    // Close when clicking outside
    setTimeout(() => {
      document.addEventListener("mousedown", function closeOffsetPopup(ev) {
        if (!offsetPopup.contains(ev.target)) {
          offsetPopup.remove();
          document.removeEventListener("mousedown", closeOffsetPopup);
        }
      });
    }, 0);
  }
  function nowButton(id, labelText, value, placeholder, marginLeft) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Now";
    Object.assign(btn.style, {
        cursor: "pointer",
        width:          "50px",           // wide enough for “00:00”
        height:         "28px",           // fixed box height
        margin:        "0px 4px",          // no vertical padding needed now
        fontSize:       "14px",           // legible size
        //lineHeight:     "28px",           // exactly equal to height for vertical centering
        textAlign:      "center",         // horizontal centering
        boxSizing:      "border-box",     // include padding/border in width/height
        color:          "white",
        backgroundColor:"#0f0d20",
        border:         "2px solid #1b192b",
        borderRadius:   "8px"
    });
    btn.onmouseover = () => btn.style.backgroundColor = "#1b192b";
    btn.onmouseout  = () => btn.style.backgroundColor = "#0f0d20";
    btn.onclick = () => {
      if (video) {
        input.value = formatTime(video.currentTime);
        input.dispatchEvent(new Event("input"));
      }
    };
    const text = document.createElement("span");
    text.textContent = labelText;
    Object.assign(text.style, { marginRight: "4px", color: "white" });

    const input = document.createElement("input");
    Object.assign(input, { id, value: value || "", placeholder });
    Object.assign(input.style, {
      width:          "70px",           // wide enough for “00:00”
      height:         "28px",           // fixed box height
      margin:        "4px 0px",          // no vertical padding needed now
      fontSize:       "14px",           // legible size
      lineHeight:     "28px",           // exactly equal to height for vertical centering
      textAlign:      "center",         // horizontal centering
      boxSizing:      "border-box",     // include padding/border in width/height
      color:          "white",
      backgroundColor:"#0f0d20",
      border:         "2px solid #1b192b",
      borderRadius:   "8px",
      marginLeft
    });

    container.append(btn, text, input);
    return container;
  }

  async function highlightRangeOnBar() {
    const slider = document.querySelector(".slider-container-nJz5F");
    if (!slider) return;
    let highlight = slider.querySelector(".intro-highlight");
    if (video && video.duration) {
      if (!highlight) {
        highlight = document.createElement("div");
        highlight.className = "intro-highlight";
        const trackEl = slider.querySelector(".track-gItfW");
        Object.assign(highlight.style, {
          position: "absolute",
          top: trackEl.offsetTop + "px",
          borderRadius: "4px",
          height: trackEl.clientHeight + "px",
          background: "rgba(255, 217, 0, 0.6)",
          pointerEvents: "none",
          zIndex: "0"
        });
        const thumbEl = slider.querySelector('.thumb-PiTF5');
        const thumbLayer = thumbEl && thumbEl.parentNode;
        slider.insertBefore(highlight, thumbLayer && slider.contains(thumbLayer) ? thumbLayer : slider.firstChild);
      }
      const { duration } = video;
      const startPct = ((start + offset) / duration) * 100;
      const widthPct = ((end - start) / duration) * 100;
      highlight.style.left = `${startPct}%`;
      highlight.style.width = `${widthPct}%`;
    } else if (highlight) {
      highlight.remove();
    }
  }
  async function showSkipButton() {
    if (document.getElementById(ACTIVE_BTN_ID) || document.getElementById(UPGRADE_BTN_ID)) return;
    const skipBtn = document.createElement("button");
    skipBtn.id = ACTIVE_BTN_ID;
    skipBtn.textContent = "Skip Intro";
    const icon = document.createElement("img");
    icon.src = "https://www.svgrepo.com/show/471906/skip-forward.svg";
    icon.alt = "Skip icon";
    icon.width = 24; icon.height = 24;
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
    skipBtn.onmouseover = () => skipBtn.style.backgroundColor = "#1b192b";
    skipBtn.onmouseout = () => skipBtn.style.backgroundColor = "#0f0d20";
    skipBtn.onclick = (e) => {
      e.preventDefault();
      if (video) {
        video.currentTime = end + offset;
        console.log(`[SkipIntro] Skipping intro: targetTime=${end + offset}`);
      } else {
        console.warn("[SkipIntro] No video element found to apply offset.");
      }
      skipBtn.remove();
    };
    video.parentElement.appendChild(skipBtn);
  }
  async function fetchServerPluginVersion() {
    try {
      const res = await fetch(`${SERVER_URL}/plugin-version`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.version;
    } catch (err) {
      console.error("[SkipIntro] Error fetching server plugin version:", err);
      return null;
    }
  }
  async function updateVerCheck(local, remote) {
    console.log(`[SkipIntro] Checking plugin versions: local=${local}, remote=${remote}`);
    if (!local || !remote) return false;
    const [lMaj,lMin,lPatch] = local.split(".");
    const [rMaj,rMin,rPatch] = remote.split(".");
    if (lMaj !== rMaj){
      video.addEventListener("loadeddata", () => video.pause(), { once: true });
      Swal.fire({
        title: "Plugin Update Required.",
        html: `
          Version <strong>${remote}</strong> is out!<br/>
          Please update here:
          <a href="${REPO_URL}" target="_blank">GitHub ↗</a>
        `,
        icon: "error",
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: "Exit"
      }).then((result) => {
        if (result.isConfirmed) {
          window.history.back();
        }
      });
      return "BREAKING";
    }
    if ((lMin !== rMin || lPatch !== rPatch) && !localStorage.getItem("updateReminder")) {
      video.addEventListener("loadeddata", () => video.pause(), { once: true });
      Swal.fire({
        title: "Plugin Update Available!",
        html: `Version <strong>${remote}</strong> is out!<br>
              Please update here: 
              <a href="${REPO_URL}" target="_blank">GitHub ↗</a>`,
        icon: "info"
      });
      localStorage.setItem("updateReminder", "true");
    }
  }
  async function getTitle() {
    const { seriesInfo, meta } = await getPlayerState();
    let title = meta?.name || "Unknown Title";
    if (seriesInfo?.season != null && seriesInfo?.episode != null) {
      const s = String(seriesInfo.season).padStart(2, "0");
      const e = String(seriesInfo.episode).padStart(2, "0");
      title = `${title} S${s}E${e}`;
    }
    return title;
  }
  async function getPlayerState() {
    let state = null;
    while (!state?.metaItem?.content) {
      state = await _eval("window.services.core.transport.getState('player')");
      if (!state?.metaItem?.content) await new Promise(r => setTimeout(r, 300));
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
    if(seconds == null || isNaN(seconds)) 
      return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }
  async function simpleHash() {
    const state = await _eval("window.services.core.transport.getState('player')");
    const streamUrl = state?.selected?.stream?.url;

    let hash = 0, i, chr;
    if (typeof streamUrl !== 'string' || streamUrl.length === 0) return 'unknown';
    for (i = 0; i < streamUrl.length; i++) {
      chr = streamUrl.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString();
  }
  function _eval(js) {
    return new Promise((resolve) => {
      const event = "stremio-enhanced";
      const script = document.createElement("script");
      window.addEventListener(event, (e) => {
        script.remove();
        resolve(e.detail);
      }, { once: true });
      script.textContent = `
        (async () => {
          try {
            const res = ${js};
            if (res instanceof Promise) res.then(r => window.dispatchEvent(new CustomEvent('${event}', { detail: r })));
            else window.dispatchEvent(new CustomEvent('${event}', { detail: res }));
          } catch (err) {
            console.error(err);
            window.dispatchEvent(new CustomEvent('${event}', { detail: null }));
          }
        })();`;
      document.head.appendChild(script);
    });
  }
  function attachEpisodeListener() {
    const newVideo = document.querySelector("video");
    if (!newVideo || newVideo === video) return;
    video = newVideo;
    video.addEventListener("loadedmetadata", onPlay);
  }
  const observer = new MutationObserver(() => {
    const iconBar = document.querySelector(ICON_BAR_CLASS);
    if (iconBar) 
      addSetupButton(iconBar);
    attachEpisodeListener();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();

//import SweetAlert2 module
const _swalReady = (function loadSwal() {
  return new Promise((resolve, reject) => {
    if (window.Swal) return resolve(window.Swal);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
    s.onload  = () => resolve(window.Swal);
    s.onerror = () => reject(new Error("Failed to load SweetAlert2"));
    document.head.appendChild(s);
  });
})();

//delete localStorage items before closing app
window.addEventListener("beforeunload", () => {
  localStorage.removeItem("updateReminder");
});