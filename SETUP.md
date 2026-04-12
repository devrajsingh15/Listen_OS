# ListenOS Setup

This project is desktop-first and local-first.

- No cloud auth
- No external server process
- No cloud database
- Tauri + Next.js UI + Rust backend in one app

## Prerequisites

- Node.js 20+
- Rust stable toolchain
- Platform toolchain for Tauri builds

## Install

```bash
npm install
```

## Environment

Copy `.env.example` to `.env.local` and set your key:

```env
GROQ_API_KEY=your_groq_api_key
LISTENOS_REQUIRE_CONFIRMATION=false
```

## Run Development

```bash
npm run tauri:dev
```

## Build

```bash
npm run tauri:build
```

Platform bundles:

- Windows NSIS: `npm run tauri:build:windows:nsis`
- macOS DMG: `npm run tauri:build:mac:dmg`
- Linux AppImage: `npm run tauri:build:linux:appimage`

## Notes

- Settings are stored locally on device.
- API key settings are stored locally via app settings.
- Voice processing and action execution run through the desktop runtime.
