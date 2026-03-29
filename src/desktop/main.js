const { app, BrowserWindow, desktopCapturer, ipcMain, Menu, nativeImage, session, shell } = require('electron');
app.name = 'FreeRTC';
const path = require('path');
const fs = require('fs');
const https = require('https');

// ── Logger ────────────────────────────────────────────────────────────────────
// Levels: debug < info < warn < error
// Configured via logLevel in client.json. Defaults to 'info'.
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

const logger = (() => {
    let logPath = null;
    let minLevel = 1; // info

    function getPath() {
        if (!logPath) {
            try { logPath = path.join(app.getPath('userData'), 'freertc.log'); }
            catch { logPath = path.join(__dirname, '../../freertc.log'); }
        }
        return logPath;
    }

    function write(level, ...args) {
        if (LEVELS[level] < minLevel) return;
        const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${args.join(' ')}\n`;
        process.stdout.write(line);
        try { fs.appendFileSync(getPath(), line); } catch { /* ignore */ }
    }

    return {
        setLevel: (level) => { minLevel = LEVELS[level] ?? 1; },
        debug: (...a) => write('debug', ...a),
        info:  (...a) => write('info',  ...a),
        warn:  (...a) => write('warn',  ...a),
        error: (...a) => write('error', ...a),
        path:  ()     => getPath()
    };
})();

// ── Client config ─────────────────────────────────────────────────────────────
// Prefer userData dir (writable in packaged app); fall back to source tree for dev
function getClientConfigPath() {
    try { return path.join(app.getPath('userData'), 'client.json'); }
    catch { return path.join(__dirname, '../../config/client.json'); }
}

function loadClientConfig() {
    const p = getClientConfigPath();
    try {
        const config = JSON.parse(fs.readFileSync(p, 'utf8'));
        logger.debug(`Loaded client config from ${p}`);
        return config;
    } catch {
        // Fall back to source-tree client.json (dev mode seed value)
        try {
            const fallback = path.join(__dirname, '../../config/client.json');
            const config = JSON.parse(fs.readFileSync(fallback, 'utf8'));
            logger.debug(`Loaded client config from fallback ${fallback}`);
            return config;
        } catch {
            logger.debug('No client config found, using defaults');
            return {};
        }
    }
}

let clientConfig = {};

// ── Window handles ────────────────────────────────────────────────────────────
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

    let pkg = { version: '?' };
    try { pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')); }
    catch (err) { logger.warn(`Could not read package.json: ${err.message}`); }

    template.push(
        {
            label: 'Connection',
            submenu: [
                {
                    label: 'New Connection',
                    click: () => {
                        logger.info('User opened New Connection window');
                        createConnectionWindow();
                    }
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
                    label: 'Open Log File',
                    click: () => {
                        logger.info('User opened log file');
                        shell.openPath(logger.path());
                    }
                },
                {
                    label: 'Log Level',
                    submenu: ['debug', 'info', 'warn', 'error'].map(level => ({
                        label: level.charAt(0).toUpperCase() + level.slice(1),
                        type: 'radio',
                        checked: (clientConfig.logLevel || 'info') === level,
                        click: () => {
                            logger.info(`Log level changed to ${level}`);
                            logger.setLevel(level);
                            clientConfig.logLevel = level;
                            try {
                                fs.writeFileSync(getClientConfigPath(), JSON.stringify(clientConfig, null, 2));
                            } catch (err) {
                                logger.warn(`Could not save log level: ${err.message}`);
                            }
                        }
                    }))
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
    logger.debug('Creating connection window');
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
    connectionWindow.on('closed', () => {
        logger.debug('Connection window closed');
        connectionWindow = null;
    });
}

function createMainWindow() {
    logger.debug('Creating main window');
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
        logger.debug('Entered fullscreen');
        mainWindow.setFullScreen(true);
    });
    mainWindow.webContents.on('leave-html-full-screen', () => {
        logger.debug('Left fullscreen');
        mainWindow.setFullScreen(false);
    });

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
        logger.error(`Page failed to load — url: ${url} code: ${errorCode} reason: ${errorDescription}`);
    });

    mainWindow.webContents.on('crashed', (_event, killed) => {
        logger.error(`Renderer crashed (killed=${killed})`);
    });

    mainWindow.on('closed', () => {
        logger.info('Main window closed');
        mainWindow = null;
    });
}

async function pickDisplaySource() {
    logger.debug('Fetching display sources');
    let sources;
    try {
        sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            fetchWindowIcons: true,
            thumbnailSize: { width: 320, height: 180 }
        });
    } catch (err) {
        logger.error(`Failed to get display sources: ${err.message}`);
        return null;
    }

    logger.debug(`Found ${sources.length} display source(s)`);

    if (!sources.length) {
        logger.warn('No display sources available');
        return null;
    }

    if (displayPickerWindow && !displayPickerWindow.isDestroyed()) {
        logger.debug('Display picker already open — focusing');
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
            if (settled) return;
            settled = true;

            ipcMain.removeListener('display-picker:select', handleSelect);
            ipcMain.removeListener('display-picker:cancel', handleCancel);

            if (displayPickerWindow && !displayPickerWindow.isDestroyed()) {
                displayPickerWindow.close();
            }
            displayPickerWindow = null;

            if (source) {
                logger.info(`Display source selected: "${source.name}" (${source.id})`);
            } else {
                logger.info('Display picker cancelled');
            }
            resolve(source);
        };

        const handleSelect = (_event, sourceId) => {
            const source = sources.find((item) => item.id === sourceId) || null;
            finish(source);
        };

        const handleCancel = () => finish(null);

        ipcMain.once('display-picker:select', handleSelect);
        ipcMain.once('display-picker:cancel', handleCancel);

        displayPickerWindow.once('closed', () => finish(null));

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

// ── Load icon ─────────────────────────────────────────────────────────────────
const iconPath = path.join(__dirname, '../web/public/icon.png');
const appIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : (() => {
        const size = 32;
        const buf = Buffer.alloc(size * size * 4, 255);
        return nativeImage.createFromBuffer(buf, { width: size, height: size });
    })();

// Handle self-signed certificates
app.commandLine.appendSwitch('ignore-certificate-errors');

function configureDesktopPermissions() {
    const allowedPermissions = new Set(['media', 'display-capture', 'fullscreen', 'clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);

    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        const allowed = allowedPermissions.has(permission);
        logger.debug(`Permission check: ${permission} → ${allowed}`);
        return allowed;
    });

    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        const allowed = allowedPermissions.has(permission);
        logger.debug(`Permission request: ${permission} → ${allowed}`);
        callback(allowed);
    });
}

function attemptConnect(url) {
    return new Promise((resolve, reject) => {
        logger.debug(`HTTP probe: GET ${url}/login.html`);
        const request = https.get(url + '/login.html', {
            rejectUnauthorized: false
        }, (response) => {
            logger.debug(`HTTP probe response: ${response.statusCode}`);
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
            logger.debug(`HTTP probe error: ${error.message}`);
            reject(new Error('Could not connect to server: ' + error.message));
        });
        request.end();
    });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('connect-to-server', async (_event, url) => {
    logger.info(`Connecting to ${url}`);
    try {
        await attemptConnect(url);
        logger.info('Connected successfully');
        try {
            clientConfig.serverUrl = url;
            fs.writeFileSync(getClientConfigPath(), JSON.stringify(clientConfig, null, 2));
            logger.info(`Saved server URL to ${getClientConfigPath()}`);
        } catch (err) {
            logger.warn(`Could not save server URL: ${err.message}`);
        }
    } catch (err) {
        logger.error(`Connection failed: ${err.message}`);
        throw err;
    }
});

ipcMain.handle('get-default-server-url', () => {
    logger.debug(`Returning default server URL: ${clientConfig.serverUrl || '(none)'}`);
    return clientConfig.serverUrl || '';
});

ipcMain.handle('pick-display-source', async () => {
    logger.info('Display source picker requested');
    try {
        const source = await pickDisplaySource();
        if (!source) return null;
        return { id: source.id, name: source.name, kind: source.id.startsWith('screen:') ? 'screen' : 'window' };
    } catch (err) {
        logger.error(`Display source picker failed: ${err.message}`);
        return null;
    }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    clientConfig = loadClientConfig();
    logger.setLevel(clientConfig.logLevel || 'info');
    logger.info(`FreeRTC starting — log: ${logger.path()} — level: ${clientConfig.logLevel || 'info'}`);
    logger.debug(`Platform: ${process.platform} — Electron: ${process.versions.electron} — Node: ${process.versions.node}`);

    if (process.platform === 'darwin' && app.dock) {
        app.dock.setIcon(appIcon);
    }
    configureDesktopPermissions();
    createMenu();

    const serverUrl = clientConfig.serverUrl && clientConfig.serverUrl.trim();
    if (serverUrl) {
        logger.info(`Auto-connecting to ${serverUrl}`);
        try {
            await attemptConnect(serverUrl);
            logger.info('Auto-connect succeeded');
            return;
        } catch (err) {
            logger.warn(`Auto-connect failed: ${err.message} — showing connection window`);
        }
    } else {
        logger.info('No server URL configured — showing connection window');
    }

    createConnectionWindow();
});

process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.stack || err.message}`);
});

process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${reason?.stack || reason}`);
});

app.on('window-all-closed', () => {
    logger.info('All windows closed — quitting');
    app.quit();
});
