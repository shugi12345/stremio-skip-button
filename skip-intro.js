(function () {
    const STORAGE_PREFIX = 'skipIntro-';

    function getImdbId() {
        // Attempt to extract IMDb ID from the current video metadata.
        // Stremio often exposes it via player settings or URL hash.
        if (window.currentMeta && window.currentMeta.imdb_id) {
            return window.currentMeta.imdb_id;
        }
        const hash = window.location.hash || '';
        const match = hash.match(/imdb_id=([^&]+)/);
        return match ? match[1] : null;
    }

    function loadIntroData(imdbId) {
        const stored = localStorage.getItem(STORAGE_PREFIX + imdbId);
        return stored ? JSON.parse(stored) : null;
    }

    function saveIntroData(imdbId, data) {
        localStorage.setItem(STORAGE_PREFIX + imdbId, JSON.stringify(data));
    }

    function createButton(text, id) {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.id = id;
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.right = id === 'setIntroBtn' ? '140px' : '20px';
        btn.style.zIndex = 9999;
        btn.style.padding = '8px 12px';
        btn.style.background = '#673ab7';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        return btn;
    }

    function setupSetIntro(imdbId) {
        const existing = document.getElementById('setIntroBtn');
        if (existing) return;
        const setIntroBtn = createButton('Set Intro', 'setIntroBtn');
        setIntroBtn.onclick = () => {
            const start = parseFloat(prompt('Intro start time in seconds:'));
            if (isNaN(start)) return;
            const end = parseFloat(prompt('Intro end time in seconds:'));
            if (isNaN(end) || end <= start) return;
            saveIntroData(imdbId, { start, end });
            alert('Intro saved!');
        };
        document.body.appendChild(setIntroBtn);
    }

    function setupSkipButton(video, introData) {
        let skipBtn = document.getElementById('skipIntroBtn');
        if (!skipBtn) {
            skipBtn = createButton('Skip Intro', 'skipIntroBtn');
            skipBtn.onclick = () => {
                video.currentTime = introData.end;
                skipBtn.style.display = 'none';
            };
            document.body.appendChild(skipBtn);
        }
        skipBtn.style.display = 'none';
        video.addEventListener('timeupdate', () => {
            if (video.currentTime >= introData.start && video.currentTime < introData.end) {
                skipBtn.style.display = 'block';
            } else {
                skipBtn.style.display = 'none';
            }
        });
    }

    function init() {
        const imdbId = getImdbId();
        if (!imdbId) return;
        setupSetIntro(imdbId);
        const introData = loadIntroData(imdbId);
        const video = document.querySelector('video');
        if (video && introData) {
            setupSkipButton(video, introData);
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 0);
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
