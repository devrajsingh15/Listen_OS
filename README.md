# ListenOS

AI-powered desktop voice control for Windows and macOS.

ListenOS is a local-first Tauri app with a Next.js dashboard and a Rust backend. It supports dictation plus action commands with global shortcuts.

![ListenOS Demo](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue) ![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-orange) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![Rust](https://img.shields.io/badge/Rust-stable-red)

## Current Product Behavior

- On first launch, onboarding runs to set API key, microphone, and starter templates.
- Default hold-to-talk shortcut: `Ctrl+Space`
- Default assistant-mode shortcut: `Ctrl+Alt+Space`
- Assistant-mode shortcut toggles idle handsfree listening on/off.
- Theme follows user device preference automatically (light/dark).
- Settings and local runtime data are stored on-device.

## Features

- Voice-to-action command execution
- Fast push-to-talk dictation
- Idle assistant handsfree mode with dedicated shortcut
- Local-first runtime (no account login required)
- Dashboard tools:
  - Conversation
  - Commands
  - Clipboard
  - Integrations
  - Dictionary
  - Snippets
  - Tone
- Configurable shortcuts and language settings
- Groq API key management in Settings

## Quick Start

### Prerequisites

Windows:
- Windows 10/11 (64-bit)
- Node.js 20+
- Rust stable toolchain
- Visual Studio Build Tools with C++ workload

macOS:
- macOS 10.15+
- Node.js 20+
- Rust stable toolchain
- Xcode Command Line Tools (`xcode-select --install`)
- Grant Microphone and Accessibility permissions when prompted

### Install

1. Clone:
```bash
git clone https://github.com/devrajsingh15/Listen_OS.git
cd Listen_OS
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Run development app:
```bash
npm run tauri:dev
# or
bun run tauri:dev
```

4. Build production app:
```bash
npm run tauri:build
# or
bun run tauri:build
```

Build outputs are under `backend/target/release/bundle/`.

## Usage

### Global Shortcuts

| Action | Default | Behavior |
|---|---|---|
| Hold-to-talk | `Ctrl+Space` | Hold to record, release to process and execute |
| Assistant mode | `Ctrl+Alt+Space` | Press once to start handsfree, press again to stop |

Change both shortcuts in:
`Settings -> General`

### API Key Setup

Recommended path:
- Open `Settings -> System`
- Paste your `Groq API key`
- Save

Optional env file path:
1. Create/edit `.env.local`
2. Add:
```env
GROQ_API_KEY=your_groq_api_key_here
LISTENOS_REQUIRE_CONFIRMATION=false
```

## Theming

- Automatic device-based theme selection (`prefers-color-scheme`)
- Shared global CSS token system for text, surfaces, borders, and hover states
- Font stack uses Geist (`geist` package), loaded locally in app layouts

## Architecture

```text
ListenOS/
├── src/                          # Next.js frontend
│   ├── app/
│   │   ├── (dashboard)/          # Main dashboard routes
│   │   └── (overlay)/assistant   # Always-on assistant overlay UI
│   ├── components/
│   ├── context/
│   └── lib/tauri.ts              # Tauri command/event bridge
└── backend/
    └── src/
        ├── commands/             # Tauri command handlers
        ├── config/               # App config + hotkeys
        ├── audio/                # Capture/runtime
        ├── cloud/                # STT/intent clients
        └── streaming/
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run tauri:dev` | Start full desktop app in dev mode |
| `npm run build` | Build Next.js web bundle |
| `npm run tauri:build` | Build desktop installer/bundles |
| `npm run tauri:build:windows:nsis` | Build Windows NSIS |
| `npm run tauri:build:mac:dmg` | Build macOS DMG |
| `npm run tauri:build:linux:appimage` | Build Linux AppImage |
| `npm run lint` | Run ESLint |

## macOS Packaging Notes

Build DMG on macOS:
```bash
npm run tauri:build:mac:dmg
```

DMG output:
`backend/target/release/bundle/dmg/`

Post-build validation checklist:
[docs/macos-smoke-test-checklist.md](docs/macos-smoke-test-checklist.md)

## Release / Auto-Update Pipeline

ListenOS supports in-app updates through Tauri updater.

Required GitHub secrets:
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_ENDPOINT`
- `CLOUDFLARE_R2_BUCKET`
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`

Version helpers:
- `npm run release:prepare -- <version>`
- `npm run version:sync`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Proprietary software. See [LICENSE](LICENSE).
