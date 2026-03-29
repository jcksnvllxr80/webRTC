const { app, BrowserWindow, desktopCapturer, ipcMain, Menu, nativeImage, session, shell } = require('electron');
app.name = 'FreeRTC';
const path = require('path');
const fs = require('fs');
const https = require('https');

// Load icon from file when available, otherwise use a white placeholder
const iconPath = path.join(__dirname, '../web/public/icon.png');
const appIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : (() => {
        // 32x32 white RGBA buffer
        const size = 32;
        const buf = Buffer.alloc(size * size * 4, 255); // all 0xFF = opaque white
        return nativeImage.createFromBuffer(buf, { width: size, height: size });
    })();

// Load client config (serverUrl)
// Prefer userData dir (writable in packaged app); fall back to source tree for dev
function getClientConfigPath() {
    try { return path.join(app.getPath('userData'), 'client.json'); }
    catch { return path.join(__dirname, '../../config/client.json'); }
}
function loadClientConfig() {
    const p = getClientConfigPath();
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch {
        // Fall back to source-tree config.json (dev mode seed value)
        try { return JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/client.json'), 'utf8')); }
        catch { return {}; }
    }
}
let clientConfig = {};

let mainWindow = null;
let connectionWindow = null;
let displayPickerWindow = null;

function createMenu() {
    const template = [];

    if (process.platform === 'darwin') {
        template.push({
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));

    template.push(
        {
            label: 'Connection',
            submenu: [
                {
                    label: 'New Connection',
                    click: () => createConnectionWindow()
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: `FreeRTC v${pkg.version}`,
                    enabled: false
                },
                { type: 'separator' },
                {
                    label: 'Documentation',
                    click: () => shell.openExternal('https://github.com/jcksnvllxr80/FreeRTC#readme')
                },
                {
                    label: 'GitHub Repository',
                    click: () => shell.openExternal('https://github.com/jcksnvllxr80/FreeRTC')
                }
            ]
        }
    );

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createConnectionWindow() {
    connectionWindow = new BrowserWindow({
        width: 400,
        height: 300,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'Connect to Server',
        icon: appIcon,
        resizable: false,
        minimizable: false,
        maximizable: false,
        parent: mainWindow,
        modal: mainWindow ? true : false
    });

    connectionWindow.loadFile(path.join(__dirname, 'connection.html'));
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 960,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'FreeRTC',
        icon: appIcon,
        show: false
    });

    mainWindow.webContents.on('enter-html-full-screen', () => {
        mainWindow.setFullScreen(true);
    });
    mainWindow.webContents.on('leave-html-full-screen', () => {
        mainWindow.setFullScreen(false);
    });
}

async function pickDisplaySource() {
    const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        fetchWindowIcons: true,
        thumbnailSize: { width: 320, height: 180 }
    });

    if (!sources.length) {
        return null;
    }

    if (displayPickerWindow && !displayPickerWindow.isDestroyed()) {
        displayPickerWindow.focus();
        return null;
    }

    displayPickerWindow = new BrowserWindow({
        width: 960,
        height: 720,
        parent: mainWindow,
        modal: true,
        show: false,
        title: 'Choose what to share',
        resizable: true,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'display-picker-preload.js')
        }
    });

    const pickerSources = sources.map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.id.startsWith('screen:') ? 'screen' : 'window',
        thumbnailDataUrl: source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL(),
        appIconDataUrl: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null
    }));

    return new Promise((resolve) => {
        let settled = false;

        const finish = (source) => {
            if (settled) {
                return;
            }
            settled = true;

            ipcMain.removeListener('display-picker:select', handleSelect);
            ipcMain.removeListener('display-picker:cancel', handleCancel);

            if (displayPickerWindow && !displayPickerWindow.isDestroyed()) {
                displayPickerWindow.close();
            }
            displayPickerWindow = null;
            resolve(source);
        };

        const handleSelect = (_event, sourceId) => {
            const source = sources.find((item) => item.id === sourceId) || null;
            finish(source);
        };

        const handleCancel = () => {
            finish(null);
        };

        ipcMain.once('display-picker:select', handleSelect);
        ipcMain.once('display-picker:cancel', handleCancel);

        displayPickerWindow.once('closed', () => {
            finish(null);
        });

        displayPickerWindow.webContents.once('did-finish-load', () => {
            displayPickerWindow.webContents.send('display-picker:sources', pickerSources);
        });

        displayPickerWindow.once('ready-to-show', () => {
            if (displayPickerWindow && !displayPickerWindow.isDestroyed()) {
                displayPickerWindow.show();
            }
        });

        displayPickerWindow.loadFile(path.join(__dirname, 'display-picker.html'));
    });
}

// Handle self-signed certificates
app.commandLine.appendSwitch('ignore-certificate-errors');

function configureDesktopPermissions() {
    const allowedPermissions = new Set(['media', 'display-capture', 'fullscreen', 'clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);

    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        return allowedPermissions.has(permission);
    });

    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(allowedPermissions.has(permission));
    });
}

function attemptConnect(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url + '/login.html', {
            rejectUnauthorized: false
        }, (response) => {
            if (response.statusCode === 200) {
                if (!mainWindow) createMainWindow();
                mainWindow.loadURL(url + '/login.html');
                mainWindow.show();
                if (connectionWindow && !connectionWindow.isDestroyed()) connectionWindow.close();
                resolve(true);
            } else {
                reject(new Error('Server returned status: ' + response.statusCode));
            }
        });
        request.on('error', (error) => {
            reject(new Error('Could not connect to server: ' + error.message));
        });
        request.end();
    });
}

ipcMain.handle('connect-to-server', async (_event, url) => {
    await attemptConnect(url);
    try {
        clientConfig.serverUrl = url;
        fs.writeFileSync(getClientConfigPath(), JSON.stringify(clientConfig, null, 2));
    } catch { /* ignore write errors */ }
});

ipcMain.handle('get-default-server-url', () => {
    return clientConfig.serverUrl || '';
});

ipcMain.handle('pick-display-source', async () => {
    const source = await pickDisplaySource();
    if (!source) {
        return null;
    }

    return {
        id: source.id,
        name: source.name,
        kind: source.id.startsWith('screen:') ? 'screen' : 'window'
    };
});

app.whenReady().then(async () => {
    clientConfig = loadClientConfig();

    if (process.platform === 'darwin' && app.dock) {
        app.dock.setIcon(appIcon);
    }
    configureDesktopPermissions();
    createMenu();

    const serverUrl = clientConfig.serverUrl && clientConfig.serverUrl.trim();
    if (serverUrl) {
        try {
            await attemptConnect(serverUrl);
            return;
        } catch { /* fall through to connection window */ }
    }

    createConnectionWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});
