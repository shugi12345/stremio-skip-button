# Stremio Skip Intro Plugin

This repository provides a small plugin script for **Stremio Enhanced**. It lets you store per-movie or per-episode intro times and automatically offers a skip button while watching.

## Usage

1. Install the **Stremio Enhanced** browser extension.
2. Add `skip-intro.js` as a custom plugin in the extension settings.
3. Start playing a video. A new button will appear in the player's control bar.
4. Click the button to enter the intro start and end times (in seconds). You can use the video's current time for convenience.
5. The times are saved locally in `localStorage` using the IMDb ID of the title.
6. When you watch the same title again, a "Skip Intro" popup shows up once the intro starts. If you don't interact, it auto-skips after five seconds.

All data is stored locally in the browser.
