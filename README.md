# WebRTC

A small WebRTC demo app served over HTTPS with login, registration, chat, friends, camera, and screen sharing.

## Getting Started

### 1. Prerequisites

Install:

* Node.js (a current LTS version is fine)

### 2. Run the installer

From the project root, run:

```bash
sh ./install.sh
```

Use `.\install.bat` instead in PowerShell on Windows if you do not want to use a shell script.

### 3. Make sure the HTTPS certificate files exist

This app expects these files in the project root:

* `private.key`
* `certificate.pem`

They are already in this repo, so you can start the app without doing anything else.

If you want to regenerate them yourself, use OpenSSL:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout private.key -out certificate.pem
```

### 4. Start the server

Run:

```bash
npm start
```

By default, the app runs on port `8001`.

### 5. Open the app

Use one of these URLs:

* On the same computer: `https://localhost:8001`
* On another device on your network: `https://<server-ip>:8001`

Because the certificate is self-signed, your browser will show a security warning the first time. Continue to the site so the app can load.

### 6. Create accounts and log in

To test the app successfully, use two separate browser sessions:

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

## Notes

* `users.db` is created automatically in the project root the first time the app runs.
* The server listens on `0.0.0.0`, so other devices on the same network can reach it.
* The default port comes from `config.json`. You can change it there, or set `PORT` before starting the server.
* This project uses public STUN servers and does not include a TURN server, so same-network testing is the simplest setup.

## Dependencies

The installer scripts install the Node.js package dependencies for you, so you normally do not need to run `npm install` manually.

System dependencies:

* Node.js
* npm
* OpenSSL only if you need to generate new HTTPS certificate files

Project package dependencies:

* `bcrypt`
* `better-sqlite3`
* `express`
* `express-session`
* `https`
* `socket.io`

## electron desktop app

**Running the App**
``` bash
npm run electron
```

**Building the App**
``` bash
npm run build
```
This will create a packaged application in the `dist` folder. On macOS, it will create a file, on Windows, an `.exe`, and on Linux, an `.AppImage`. You can then create a shortcut to this executable. `.app`

## Inspired by:

* https://medium.com/agora-io/how-does-webrtc-work-996748603141