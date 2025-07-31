# Unofficial Intro Skip plugin for Stremio Enhanced

**Version:** 1.0.0  
**Author:** shugi12345  

> Community-powered “Skip Intro” for shows and movies in **Stremio Enhanced**.  
> Everyone contributes timestamps; once someone saves an intro range, it becomes available to everyone.

---

## Features

- Detects the current episode and shows a **Skip Intro** button when you're in the intro segment.
- Community-editable intro ranges: anyone can add or correct the start/end times.
- Automatic sharing: saved ranges are stored centrally and propagate to other users.
- Robust handling of seeks/rewinds so the skip button reappears if you go back into the intro.

---

## Installation

1. **Install Stremio Enhanced**  
   You must use [Stremio Enhanced](https://github.com/REVENGE977/stremio-enhanced) — it’s the only version that supports plugins with direct access to modify the player behavior.

2. **Add the SkipIntro plugin**  
   - Open Stremio Enhanced.
   - Go into **Settings** and scroll all the way to the bottom.
   - Open the **Plugins** folder.
   - Download `skip-intro.plugin.js` from the **Releases** tab of this GitHub repository and place it into the plugins folder.

3. **Start watching**  
   Play any episode. If an intro range exists (or after you add one), the skip button will appear during the intro.

---

## How to Use

This is a **community-based project**: intro timestamps must be created manually by users.

1. Play an episode.
2. Look for the small **clock icon** (setup button) in the control bar.
3. Click it to open the editor popup.
4. Enter the **Start** and **End** time of the intro (format `MM:SS`).
5. Click **Save**.  
   - That range is saved centrally and becomes available to others.
   - Once the range is present, a **Skip Intro** button appears when playback enters the specified range.
6. If you rewind back into the intro, the skip button will reappear (thanks to improved seek handling).

---

## Notes

- The plugin does **not** increment the version number automatically; versioning is manual. Do **not** update the version in the header unless you intend to release a new version.
- Intro ranges are cached per episode but will refresh when you re-enter an episode or if the range is missing.
- this code was mostly AI generated, this project could have taken a lot longer but using ai made it a few day project im hoping to use more 

---

## Troubleshooting

- **Saved range doesn’t appear for others**  
  The project relies on a central server. If saving fails, check console logs for network errors and ensure your connection to the server is intact.

---

## Contributing

1. Play episodes and help build the database by adding accurate intro ranges.
2. Open issues for bugs or suggestions.
3. Pull requests are welcome for:
   - Improving UI/UX of the editor.
   - Enhancing reliability of range fetching/saving.
   - Supporting additional edge cases in playback handling.

---

## Development

The core script is self-contained and injected into the Stremio Enhanced context. Key behaviors:
- Fetches current episode ID and associated intro range from the backend.
- Shows "Skip Intro" UI when playback enters the defined range.
- Allows users to edit or create new ranges via an inline popup.
- Listens to both `timeupdate` and `seeked` to handle scrubbing and rewinds.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

## Acknowledgements

Thanks to the official stremio project for countless hours of entertienment.
Thanks to the Stremio Enhanced project for enabling powerful plugin hooks.

