(function () {
    const STORAGE_PREFIX = 'introTimes-';

    function loadIntro(id) {
        const stored = localStorage.getItem(STORAGE_PREFIX + id);
        return stored ? JSON.parse(stored) : null;
    }

    function saveIntro(id, data) {
        localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(data));
    }

    function secondsToTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function waitForTimestamp(video, target, cb) {
        function check() {
            if (video.currentTime >= target) {
                video.removeEventListener('timeupdate', check);
                cb();
            }
        }
        video.addEventListener('timeupdate', check);
    }

    function _eval(js) {
        return new Promise((resolve, reject) => {
            try {
                const eventName = 'stremio-skip-intro';
                const script = document.createElement('script');
                window.addEventListener(eventName, (data) => {
                    script.remove();
                    resolve(data.detail);
                }, { once: true });
                script.id = eventName;
                script.appendChild(document.createTextNode(`
                    var core = window.services.core;
                    var result = ${js};
                    if (result instanceof Promise) {
                        result.then((awaited) => {
                            window.dispatchEvent(new CustomEvent("${eventName}", { detail: awaited }));
                        });
                    } else {
                        window.dispatchEvent(new CustomEvent("${eventName}", { detail: result }));
                    }
                `));
                document.head.appendChild(script);
            } catch (err) {
                reject(err);
            }
        });
    }

    async function getPlayerState() {
        let state = null;
        while (!state?.seriesInfo || !state.metaItem?.content) {
            try {
                state = await _eval('core.transport.getState("player")');
                if (state.seriesInfo && state.metaItem?.content) break;
            } catch (err) {
                console.error('skip-intro: error fetching player state', err);
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        return { seriesInfo: state.seriesInfo, meta: state.metaItem.content };
    }

    function getImdbId(meta) {
        if (!meta) return null;
        if (meta.imdb_id) return meta.imdb_id;
        const match = (meta.id || '').match(/tt\d+/);
        return match ? match[0] : null;
    }

    function createSetIntroButton(imdbId) {
        if (document.getElementById('set-intro-btn')) return;
        const controlBar = document.querySelector('.control-bar-buttons-menu-container-M6L0_');
        if (!controlBar) return;
        const btn = document.createElement('div');
        btn.className = 'control-bar-button-FQUsj button-container-zVLH6';
        btn.id = 'set-intro-btn';
        btn.innerHTML = `<svg class="icon-qy6I6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>Set Intro</title><path d="M13,6V18L21.5,12M4,18L12.5,12L4,6V18Z" style="fill: currentcolor;" /></svg>`;
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => {
            const video = document.querySelector('video');
            const start = prompt('Intro start time in seconds', video ? Math.floor(video.currentTime) : '0');
            if (start === null) return;
            const end = prompt('Intro end time in seconds');
            if (end === null) return;
            const s = parseFloat(start);
            const e = parseFloat(end);
            if (!isNaN(s) && !isNaN(e) && e > s) {
                saveIntro(imdbId, { start: s, end: e });
                alert('Intro times saved');
            }
        });
        controlBar.insertBefore(btn, controlBar.firstChild);
    }

    const skipPopupHTML = `
<div class="layer-qalDW menu-layer-HZFG9 next-video-popup-container-H4wnL" id="skip-intro-popup">
  <div class="info-container-KLOMx">
    <div class="details-container-bUOTZ">
      <div class="name-sIiDL">
        <span class="label-zOq_w">Skip Intro?</span>
      </div>
      <div class="title-Z5Kgo">This will skip to {{ timestamp }} (Autoskipping in 5s)</div>
    </div>
    <div class="buttons-container-iYrpZ">
      <div tabindex="0" class="button-container-i4F7t dismiss-IvEL_ button-container-zVLH6" id="dismiss-skip-intro">
        <svg class="icon-N3Ewm" viewBox="0 0 512 512"><path d="M289.9 256l95-95c4.5-4.53 7-10.63 7.1-17 0-6.38-2.5-12.5-7-17.02s-10.6-7.07-17-7.08c-3.2-0.01-6.3 0.61-9.2 1.81s-5.6 2.96-7.8 5.19l-95 95-95-95c-3.4-3.33-7.6-5.6-12.3-6.51-4.6-0.91-9.4-0.42-13.8 1.4-4.4 1.79-8.1 4.86-10.8 8.81-2.6 3.94-4 8.58-4 13.33-0.1 3.15 0.5 6.28 1.7 9.19 1.2 2.92 3 5.57 5.2 7.78l95 95-95 95c-2.8 2.8-4.8 6.24-6 10.02-1.1 3.78-1.3 7.78-0.5 11.64 0.8 3.87 2.5 7.48 5 10.52 2.5 3.05 5.8 5.43 9.4 6.93 4.4 1.81 9.2 2.29 13.8 1.39 4.7-0.91 8.9-3.17 12.3-6.5l95-95 95 95c3.4 3.34 7.6 5.6 12.3 6.51 4.6 0.92 9.4 0.43 13.8-1.39 4.4-1.8 8.1-4.87 10.8-8.82 2.6-3.94 4-8.58 4-13.33 0.1-3.15-0.5-6.28-1.7-9.2-1.2-2.91-3-5.56-5.2-7.77z" style="fill: currentcolor;"></path></svg>
        <div class="label-zOq_w">Dismiss</div>
      </div>
      <div tabindex="0" class="button-container-i4F7t play-button-Dluk6 button-container-zVLH6" id="skip-intro-button">
        <svg class="icon-N3Ewm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>Skip</title><path d="M13,6V18L21.5,12M4,18L12.5,12L4,6V18Z" style="fill: currentcolor;" /></svg>
        <div class="label-zOq_w">Skip</div>
      </div>
    </div>
  </div>
</div>`;

    function createSkipPopup(start, end) {
        const player = document.querySelector('.player-container-wIELK');
        const video = document.querySelector('video');
        if (!player || !video) return;
        let container = document.getElementById('skip-intro-popup');
        if (container) container.remove();
        container = document.createElement('div');
        container.innerHTML = skipPopupHTML.replace('{{ timestamp }}', secondsToTime(end));
        container.style.display = 'none';
        player.appendChild(container);
        waitForTimestamp(video, start, () => {
            if (video.currentTime > start + 1) return;
            let interacted = false;
            container.style.display = 'flex';
            const skipBtn = document.getElementById('skip-intro-button');
            const dismissBtn = document.getElementById('dismiss-skip-intro');
            const hide = () => {
                container.style.display = 'none';
            };
            skipBtn.addEventListener('click', () => {
                video.currentTime = end;
                video.play();
                interacted = true;
                hide();
            });
            dismissBtn.addEventListener('click', () => {
                interacted = true;
                hide();
            });
            setTimeout(() => {
                if (!interacted) {
                    video.currentTime = end;
                    video.play();
                    hide();
                }
            }, 5000);
        });
    }

    async function hashChangeHandler() {
        if (!location.hash.startsWith('#/player')) return;
        const { meta } = await getPlayerState();
        const imdbId = getImdbId(meta);
        if (!imdbId) return console.log('skip-intro: no imdb id');
        createSetIntroButton(imdbId);
        const intro = loadIntro(imdbId);
        if (intro) createSkipPopup(intro.start, intro.end);
    }

    window.addEventListener('hashchange', hashChangeHandler);
    window.addEventListener('load', hashChangeHandler);
})();
