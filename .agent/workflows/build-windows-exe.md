---
description: How to build Windows .exe executable
---

# Building Windows .exe Executable

This workflow explains how to build a Windows executable for the Flight Planner application.

## Prerequisites

- Node.js installed (v18 or higher recommended)
- npm installed
- All project dependencies installed (`npm install`)

## Build Steps

### 1. Ensure the project is built

First, make sure the Vite frontend and Electron main process are compiled:

```bash
npm run build
```

This command:
- Compiles TypeScript files
- Builds the Vite frontend to `dist/`
- Builds the Electron main process to `dist-electron/`

### 2. Build the Windows executable

**Important**: When building from Linux, you must specify the `--win` flag to build for Windows:

```bash
npm run dist -- --win
```

If you're on Windows, you can simply run:

```bash
npm run dist
```

This command uses `electron-builder` with the configuration in `package.json` to:
- Package the application
- Create a portable Windows executable (no installer required)
- Output to the `release/` directory

### 3. Locate the executable

After the build completes, you'll find:

- **Portable .exe**: `release/win-unpacked/Flight Planner.exe` or `release/win-arm64-unpacked/Flight Planner.exe` (depending on architecture)
- **Build metadata**: `release/builder-debug.yml` and `release/builder-effective-config.yaml`

## Architecture Considerations

**IMPORTANT**: If you're building on an ARM64 Linux system (like ARM-based WSL2), `electron-builder` will default to building ARM64 Windows executables. However, **most Windows PCs use x64 (AMD64) architecture**.

### Building for x64 Windows (Most Common)

To build for standard x64 Windows PCs:

```bash
npm run dist -- --win --x64
```

### Building for ARM64 Windows

For ARM-based Windows devices (like Surface Pro X):

```bash
npm run dist -- --win --arm64
```

### Building for Both Architectures

To create executables for both architectures:

```bash
npm run dist -- --win --x64 --arm64
```

### Cross-Compilation Limitation with Native Modules

**IMPORTANT**: If your system is ARM64 Linux and you try to build for x64 Windows, you may encounter this error:

```
⨯ node-gyp does not support cross-compiling native modules from source.
```

This happens because the project uses `better-sqlite3`, a native module that must be compiled for the target architecture. `node-gyp` cannot cross-compile from ARM64 to x64.

**Workarounds**:

1. **Use an x64 Linux system** - Build on an x64 machine (native or VM)
2. **Use GitHub Actions** - Set up a CI/CD pipeline that builds on x64 runners
3. **Use Docker** - Run an x64 Docker container with QEMU emulation
4. **Build on Windows** - If you have access to a Windows x64 machine, build there directly

For ARM64 Linux systems, you can successfully build:
- ✅ ARM64 Windows executables (`--win --arm64`)
- ✅ ARM64 Linux executables (`--linux --arm64`)
- ❌ x64 Windows executables (requires x64 build environment)

## Cross-Platform Building

### Building for Windows from Linux (IMPORTANT)

By default, `electron-builder` builds for your current platform. **When running on Linux, you MUST use the `--win` flag** to build for Windows:

```bash
npm run dist -- --win
```

The builder can create Windows executables from Linux without requiring Wine in most cases. However, if you encounter issues, you may need to install Wine:

```bash
# On Ubuntu/Debian (only if needed)
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install wine wine32 wine64
```

### Building for specific platforms

```bash
# Windows (required when building from Linux/macOS)
npm run dist -- --win

# Linux (required when building from Windows/macOS)
npm run dist -- --linux

# macOS (requires macOS host)
npm run dist -- --mac

# Build for multiple platforms
npm run dist -- --win --linux
```

## Configuration

The build configuration is defined in `package.json` under the `"build"` key:

```json
"build": {
  "appId": "com.flightplanner.app",
  "productName": "Flight Planner",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "dist-electron/**/*"
  ],
  "win": {
    "target": "portable"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

## Troubleshooting

### Build fails with missing dependencies

Run `npm install` to ensure all dependencies are installed, including dev dependencies.

### Native module rebuild errors

If you encounter errors with native modules like `better-sqlite3`, rebuild them:

```bash
npm run rebuild
```

This runs `electron-rebuild` to recompile native modules for the Electron version.

### File size concerns

The executable is large (~177MB) because it includes:
- Electron runtime
- Chromium browser engine
- Node.js runtime
- Your application code
- All dependencies

This is normal for Electron applications.

## Distribution

The portable .exe can be distributed directly to users. No installation is required - users can simply run the executable.

For a more professional distribution, you can modify the `"win"` target in `package.json` to create an installer:

```json
"win": {
  "target": ["nsis", "portable"]
}
```

This will create both an NSIS installer and a portable executable.
