const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    connectToServer: (url) => ipcRenderer.invoke('connect-to-server', url)
});
