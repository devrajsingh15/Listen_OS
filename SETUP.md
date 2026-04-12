# ListenOS Setup

ListenOS is desktop-first and local-first.

- No cloud auth/login gate
- No external server process
- No cloud database
- Tauri + Next.js + Rust backend in one app

## Prerequisites

- Node.js 20+
- Rust stable toolchain
- Tauri platform toolchain

Windows extras:
- Visual Studio Build Tools with C++ workload

macOS extras:
- Xcode Command Line Tools (`xcode-select --install`)

## Install

```bash
npm install
# or
bun install
```

## Configure API Key

Primary path (recommended):
- Open app
- Go to `Settings -> System`
- Set `Groq API key`

Optional env path:
Copy `.env.example` to `.env.local` and set:

```env
GROQ_API_KEY=your_groq_api_key
LISTENOS_REQUIRE_CONFIRMATION=false
```

## Run Development

```bash
npm run tauri:dev
# or
bun run tauri:dev
```

## Build

```bash
npm run tauri:build
# or
bun run tauri:build
```

Platform bundles:

- Windows NSIS: `npm run tauri:build:windows:nsis`
- macOS DMG: `npm run tauri:build:mac:dmg`
- Linux AppImage: `npm run tauri:build:linux:appimage`

## Default Shortcuts

- Hold-to-talk: `Ctrl+Space`
- Assistant mode (idle/handsfree toggle): `Ctrl+Alt+Space`

Both are configurable in `Settings -> General`.

## Notes

- First launch shows onboarding to configure key/microphone baseline.
- Theme follows device preference automatically.
- Settings and key storage are local to device.
- Voice processing and action execution run through desktop runtime.
