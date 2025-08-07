# 🚀 Unofficial Intro Skip Plugin for Stremio Enhanced

**Version:** 1.1.0
**Author:** shugi12345

> 🌍 Community-powered “Skip Intro” for shows and movies in **Stremio Enhanced**.
> Everyone contributes timestamps; once someone saves an intro range, it becomes available to everyone.

---

## ✨ Features

* 🎬 **Intro Button:** Detects the current episode and shows a **Skip Intro** button when you're in the intro segment.
* ✍️ **Reporting UI:** Community-editable intro ranges: anyone can add or correct the start/end times.
* 🔄 **Shared DB:** Automatic sharing: saved ranges are stored centrally and propagate to other users.
* 🖊️ **Intro Marker** mark intro times on the TimeLine for easier way of checking if intro was reported
* 🕰️ **Per-File Offsets**: apply slight time adjustments per file version or encoding so skip ranges align even across different cuts.
* 🚨 **Enhanced Alerts**: customizable on-screen notifications for updates, so you never miss an update.

---

## 🛠️ Installation

1. **Install Stremio Enhanced**
   You must use [Stremio Enhanced](https://github.com/REVENGE977/stremio-enhanced) — it’s the only version that supports plugins with direct access to modify the player behavior. ⭐

2. **Add the SkipIntro plugin**

   * Open Stremio Enhanced.
   * Go into **Settings** and scroll all the way to the bottom.
   * Open the **Plugins** folder.
   * Download `skip-intro.plugin.js` from the **Releases** tab of this GitHub repository and place it into the plugins folder. 📦
   * Don't forget to **enable** it in the settings!

3. **Start watching**
   Play any episode. If an intro range exists (or after you add one), the skip button will appear during the intro.

---

## 🧠 How to Use

This is a **community-based project**: intro timestamps must be created manually by users.

1. ▶️ Play an episode.
2. 👀 Look for the small **clock icon** (setup button) in the control bar.
3. 🕒 Click it to open the editor popup.
4. ✏️ Enter the **Start** and **End** time of the intro (format `MM:SS`).
5. 💾 Click **Save**.

   * That range is saved centrally and becomes available to others.
   * Once the range is present, a **Skip Intro** button appears when playback enters the specified range.
6. ↩️ If you rewind back into the intro, the skip button will appear again.
7. 🔔 **Manage Reminders**: if you update or replace your video file, use the clock icon menu to reset reminders or adjust per-file offsets.

---

## 📝 Notes

* 🌐 Thanks to the effort of [@Josselin](https://github.com/jletallec) we have a website that tracks the state of subtitle coverage! Welcome to check it out! https://skipdb.vercel.app/
* ⚠️ The plugin does **not** increment the version number automatically; versioning is manual. Do **not** update the version in the header unless you intend to release a new version.
* 🤖 This code was aided with AI (lmao I ended up rewriting most of the code the more I learned); this project could have taken a lot longer, but using AI made it a few-day project. Hoping to build more with it.

---

## 🛠️ Troubleshooting

* **I don't see an intro button**
  Check the logs using Ctrl + Shift + I; if you don’t see an error it means no time range is saved for this episode (please add it!). If you see an error, please open a bug report. 🔍
* **Skip range out of sync?**
  Use the **Per-File Offset** option in the editor popup to nudge the start/end times by a few seconds until it aligns.

---

## 🤝 Contributing

1. ▶️ Play episodes and help build the database by adding accurate intro ranges.
2. 🐛 Open issues for bugs or suggestions.
3. 🔧 Pull requests are welcome for:
   * Improving UI/UX of the editor.
   * Enhancing reliability of range fetching/saving.
   * Supporting additional edge cases in playback handling.
   * Refining reminder scheduling logic and per-file offset interfaces.

---

## 🧪 Development

Ideas I have for the feature, would love to see if people are intersted:

* 🔎 Add outro option for skipping to next episode.
* 🔎 Overhall UI (i hate frontEnd so muchhh).
* 🔎 Make better documentation

---

## 📜 License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details. 🗝️

---

## 🙏 Acknowledgements

* Thanks to the official Stremio project for countless hours of entertainment. 🍿
* Thanks to the Stremio Enhanced project for enabling powerful plugin hooks. 🧩
* Thanks to the community for helping bootstrap this quickly. 🚀
