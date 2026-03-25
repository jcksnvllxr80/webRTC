# WebRTC

A small WebRTC demo app served over HTTPS with login, registration, chat, friends, camera, screen sharing, and an Electron desktop client.

## Project Layout

```text
.
|-- certs/          HTTPS certificate files
|-- config/         runtime config
|-- data/           local SQLite database files
|-- src/
|   |-- desktop/    Electron client
|   |-- server/     HTTPS + Socket.IO backend
|   `-- web/public/ browser app
|-- install.bat
|-- install.sh
|-- package.json
`-- README.md
```

## Getting Started

### 1. Prerequisites

Install Node.js. A current LTS version is fine.

### 2. Run the installer

From the project root, run one installer:

```bash
sh ./install.sh
```

On Windows PowerShell, use:

```powershell
.\install.bat
```

The installer runs `npm install`, rebuilds the native modules for the current Node.js runtime, and checks that the HTTPS certificate files are present.

### 3. Make sure the HTTPS certificate files exist

This app expects these files in `certs/`:

* `certs/private.key`
* `certs/certificate.pem`

They are already in this repo, so the default setup works without any extra certificate step.

If you want to regenerate them yourself, use OpenSSL:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout certs/private.key -out certs/certificate.pem
```

### 4. Start the server

Run:

```bash
npm start
```

The default port is `8001`.

### 5. Open the app

Use one of these URLs:

* On the same computer: `https://localhost:8001`
* On another device on your network: `https://<server-ip>:8001`

Because the certificate is self-signed, your browser will show a security warning the first time. Continue to the site so the app can load.

### 6. Create accounts and log in

For a real test, use two separate browser sessions:

* two different devices, or
* one normal browser window and one private/incognito window

Then:

1. Open the app URL in the first session and create an account at `/register.html`.
2. Open the same app URL in the second session and create a different account.
3. Log in with both accounts.

### 7. Start a call

After both users are logged in:

1. In the first session, click `Create Room` on the lobby page.
2. Copy the room link using the `Copy Link` button in the room bar.
3. Paste the link into the second session's browser (or enter the room ID in the `Join` field on the lobby).
4. Click `Start Camera` or `Share Screen` and allow access.
5. The two users will connect automatically once both are in the same room.

You can also:

* send chat messages in the room
* add the other user as a friend
* click `Invite` next to a friend's name to create a room and copy the link to your clipboard

## Electron Desktop Client

The Electron app is a desktop client for the HTTPS server. It does not replace the server, so the server must already be running.

### Run the desktop client

1. Start the server:

```bash
npm start
```

2. In a second terminal, start Electron:

```bash
npm run electron
```

3. In the Electron connection window, use:

* Server IP: `localhost` if the server is on the same computer
* Port: `8001` unless you changed it in `config/server.json` or with `PORT`

After connecting, the desktop client opens the same login and room flow as the browser version.

### Build the desktop app

Building packages the Electron client into a standalone installer. The packaged app still requires a running WebRTC HTTPS server to connect to.

**Prerequisites:** The dev dependencies (`electron` and `electron-builder`) must be installed. They are included by default when you run the installer or `npm install`.

**Build for your current platform:**

```bash
npm run build
```

This produces platform-specific output in the `dist/` folder:

| Platform | Target | Output |
|----------|--------|--------|
| Windows  | NSIS installer | `dist/WebRTC Desktop Setup x.x.x.exe` |
| macOS    | DMG | `dist/WebRTC Desktop-x.x.x.dmg` |
| Linux    | AppImage | `dist/WebRTC Desktop-x.x.x.AppImage` |

**Build for a specific platform** (cross-compilation may require additional tooling):

```bash
# Windows
npx electron-builder --win

# macOS (must be run on macOS)
npx electron-builder --mac

# Linux
npx electron-builder --linux
```

**Note:** The build dependencies (`electron`, `electron-builder`) account for the majority of `npm audit` warnings. These are build-time only and do not affect the running server or browser clients. You can verify with `npm audit --omit=dev`.

## Notes

* `data/users.db` is created automatically the first time the app runs.
* The server listens on `0.0.0.0`, so other devices on the same network can reach it.
* The default port comes from `config/server.json`. You can also override it with the `PORT` environment variable before starting the server.
* The browser version will show a self-signed certificate warning the first time you connect.
* This project uses public STUN servers and does not include a TURN server, so same-network testing is the simplest and most reliable setup.
* Electron build output is written to the `dist` folder.

## Dependencies

The installer scripts install the Node.js package dependencies for you, so you normally do not need to run `npm install` manually.

System dependencies:

* Node.js
* npm, which ships with Node.js
* OpenSSL only if you need to generate new HTTPS certificate files

Runtime package dependencies:

* `bcrypt`
* `better-sqlite3`
* `express`
* `express-session`
* `socket.io`

Desktop build dependencies:

* `electron`
* `electron-builder`

## Inspired By

* https://medium.com/agora-io/how-does-webrtc-work-996748603141
