# Stremio Skip Intro Plugin

This repository contains a simple JavaScript plugin for **Stremio Enhanced**. The script injects a "Set Intro" button into the Stremio web UI that allows a user to store intro start and end timestamps for a given video (keyed by IMDb ID). When those timestamps are available, a "Skip Intro" button appears while the video is playing, allowing the viewer to jump past the intro segment.

## Usage

1. Install the **Stremio Enhanced** browser extension.
2. Add the script `skip-intro.js` as a custom plugin in the extension settings.
3. Open Stremio in your browser. A "Set Intro" button will appear in the bottom-right corner of the interface.
4. While a video is selected, click "Set Intro" and enter the start and end times for the intro segment in seconds.
5. The times are saved in `localStorage` under a key that includes the video's IMDb ID.
6. When the same video is played again, a "Skip Intro" button will appear when the playback reaches the intro segment.

All data is stored locally in the browser. No external server is used.
