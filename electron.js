const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const https = require('https');

let mainWindow = null;
let connectionWindow = null;

function createMenu() {
    const template = [
        {
            label: 'Connection',
            submenu: [
                {
                    label: 'New Connection',
                    click: () => createConnectionWindow()
                }
            ]
        }
    ];
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
        resizable: false,
        minimizable: false,
        maximizable: false,
        parent: mainWindow,
        modal: mainWindow ? true : false
    });

    connectionWindow.loadFile('connection.html');
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'WebRTC Desktop Client',
        show: false
    });

    createMenu();
}

// Handle self-signed certificates
app.commandLine.appendSwitch('ignore-certificate-errors');

// IPC handler for connection
ipcMain.handle('connect-to-server', async (event, url) => {
    return new Promise((resolve, reject) => {
        const request = https.get(url + '/login.html', {
            rejectUnauthorized: false // Allow self-signed certificates
        }, (response) => {
            if (response.statusCode === 200) {
                if (!mainWindow) {
                    createMainWindow();
                }
                mainWindow.loadURL(url + '/login.html', {
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                });
                mainWindow.show();
                connectionWindow.close();
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
});

app.whenReady().then(() => {
    createConnectionWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createConnectionWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});