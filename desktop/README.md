# NEXUS AI Desktop

Native Electron apps for macOS and Windows. The web app is bundled inside the executable, so the app works without a browser and uses the NEXUS robot icon throughout.

## Download the finished apps

See the [GitHub Releases](https://github.com/NovaTweaksOfficial/NEXUS-AI/releases) page:

| File | Platform |
|---|---|
| `NEXUS-AI-macOS-arm64.dmg` | macOS on Apple Silicon (M1/M2/M3/M4) |
| `NEXUS-AI-macOS-x64.dmg` | macOS on Intel |
| `NEXUS-AI-Windows-x64.exe` | Windows 10/11, 64-bit (portable — no install needed) |

The apps are **unsigned**, so your OS may warn on first open:

- **macOS:** open Finder → right-click the app → **Open** → **Open** again.
- **Windows:** SmartScreen may say "unknown publisher" → **More info** → **Run anyway**.

Signing/notarizing requires an Apple Developer membership and a Windows code-signing certificate.

## Build from source

```bash
# from the repo root
npm run build
cd desktop
npm install
npm run build:mac     # produces release/NEXUS-AI-macOS-*.dmg
npm run build:win     # produces release/NEXUS-AI-Windows-x64.exe
```

`npm run bundle` copies the root `dist/` folder into `desktop/app/` before packaging, so rebuild the web app first.
