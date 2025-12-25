# <p align="center">![Banner](assets/preview/Banner.png)</p>

<h1 align="center">sixonefour</h1>

<p align="center">
  <strong>Elevate your SoundCloud experience — where style meets high-end functionality.</strong><br>
  Stop using boring SoundCloud. Discover a client built for creators, collectors, and true music fans.
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/release/1vilio/sixonefour?style=for-the-badge&color=orange" alt="Release">
  <img src="https://img.shields.io/github/license/1vilio/sixonefour?style=for-the-badge&color=blue" alt="License">
  <img src="https://img.shields.io/github/stars/1vilio/sixonefour?style=for-the-badge&color=yellow" alt="Stars">
</p>

---

## ✨ Features at a Glance

- 🎨 **Unlimited Customization:** Beautiful glassmorphism themes with video backgrounds.
- 🚀 **High Performance:** Smooth, Electron-based core optimized for speed.
- 📱 **Interactive Widget:** Floating player that adapts to your theme.
- 💬 **Social Integration:** Advanced Discord RPC and Telegram automation.
- 🔓 **Full Access:** Built-in bypass tools (Zapret, DNS, Proxy) for regional restrictions.
- 📊 **Deep Stats:** Professional listening statistics and "Fans" category boosting.

---

## 🎨 Detailed Features

<details>
<summary><strong>🌈 Custom Themes & Aesthetics</strong></summary>

Tailor every pixel of your player. **sixonefour** supports a powerful theme engine that allows for custom CSS injection, manifest-based structures, and stunning visual effects.

- **Dynamic Visuals:** Supports high-quality video backgrounds.
- **Custom Logos:** Replace the default branding with your own assets.
- **Live Injection:** Hot-reload themes without restarting the app.

| | |
|:---:|:---:|
| ![Theme 1](assets/preview/ThemePreview1.gif) | ![Theme 2](assets/preview/ThemePreview2.gif) |
| ![Theme 3](assets/preview/ThemePreview3.gif) | ![Theme 4](assets/preview/ThemePreview4.gif) |

> [!TIP]
> Check out our [Theming Guide](docs/CUSTOM_THEMES.md) and [Selector List](docs/SELECTORS_LIST.md) to start building your own skins!

</details>

<details>
<summary><strong>🪟 Floating Desktop Widget</strong></summary>

Keep your music at your fingertips with the "Glass" widget. It lives on your desktop and mirrors the main application's theme, including video backgrounds and color palettes.

- **Always on Top:** Never lose track of what's playing.
- **Micro-Animations:** Fluid control buttons and smooth transitions.
- **Theme Sync:** Completely identical visual experience to the main client.

<p align="center">
  <img src="assets/preview/WidgetPreview.gif" width="80%">
</p>
</details>

<details>
<summary><strong>🎮 Discord Rich Presence</strong></summary>

Showoff your music taste with advanced Discord integration. Includes a live preview in the settings menu so you know exactly what others see.

- **Precise Status:** Shows artist, track title, and elapsed/remaining time.
- **Custom Buttons:** (Optional) Add links to your profile or the current track.
- **Live Preview:** Real-time feedback of your Discord status in settings.

<p align="center">
  <img src="assets/preview/DiscordPreview.png" width="80%">
</p>
</details>

<details>
<summary><strong>✈️ Telegram Integration</strong></summary>

Automate your music life with powerful Telegram tools. Turn your SoundCloud likes into a personal channel feed.

- **Live Feed:** Automatically send new liked tracks to your Telegram channel.
- **Weekly Stats:** Get an aesthetic image summary of your listening habits every week.
- **Mass Export:** Export your entire library to Telegram in one tap.

| Live Feed | Weekly Stats |
|:---:|:---:|
| ![Live Feed](assets/preview/Live%20Feed.png) | ![Weekly Statistics](assets/preview/Weekly%20Statistics.png) |

<p align="center">
  <strong>Mass Export Preview:</strong><br>
  <img src="assets/preview/MassExportPreview.gif" width="60%">
</p>

> [!NOTE]
> To use this, create a Telegram Bot via @BotFather and provide your Bot Token and Channel ID in Settings (F1).
</details>

<details>
<summary><strong>🌐 Regional Bypass (Zapret, DNS, Proxy)</strong></summary>

Music should have no borders. **sixonefour** includes built-in tools to bypass regional blocks and ISP restrictions.

- **Zapret Support:** Native integration for deep packet inspection bypass.
- **Custom DNS:** Change DNS settings directly within the app.
- **Proxy Engine:** Full support for custom proxy servers.
</details>

<details>
<summary><strong>📈 Fans Boosting</strong></summary>

A specialized tool for artists and fans to improve track placement in the "Fans" category. It uses sophisticated behavior simulation to ensure listens are counted naturally.

- **Human-like Behavior:** Simulates varying listening durations and random patterns.
- **Fingerprinting:** Spoofs device metrics, User-Agents, and platforms to avoid detection.
- **Scheduling:** Distribute plays over time for organic-looking growth.

<p align="center">
  <img src="assets/preview/FansBoostingPreview.png" width="80%">
</p>
</details>

---

## 🚀 Quick Start

1. Download the latest version from the **[Releases Page](https://github.com/1vilio/sixonefour/releases)**.
2. Run the installer and launch the app.
3. Press **`F1`** at any time to open the Settings menu and customize your experience.

---

## 🛠️ Building from Source

To build **sixonefour** locally:

```bash
# Clone the repository
git clone https://github.com/1vilio/sixonefour.git
cd sixonefour

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for Windows
npm run build-win
```

---

## 💻 Tech Stack

| Category | Technologies |
|:---|:---|
| **Core** | Electron, TypeScript, Node.js |
| **Integrations** | Ably (Real-time), Discord-RPC, Telegram Bot API |
| **Styling** | Vanilla CSS, HTML5, Glassmorphism UI |
| **Logic** | scdl-core, nedb-promises, dotenv |
| **Security** | Zapret Service, DNS Mapping, Proxy |

---

## 🤝 Contributing

Contributions are welcome! Whether it's a bug report, a feature suggestion, or a new theme, feel free to open an Issue or a Pull Request.

---

## 📜 License

This project is licensed under the **MIT License**.

---

## 💖 Acknowledgments

Special thanks to **[richardhbtz](https://github.com/richardhbtz)** for the inspiration and work on **[soundcloud-rpc](https://github.com/richardhbtz/soundcloud-rpc)**, which served as a foundation for the Discord integration in this project.

---
<p align="center">
  Made with ❤️ for the SoundCloud community.
</p>
