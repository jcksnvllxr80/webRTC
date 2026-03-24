const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('displayPickerAPI', {
    onSources: (callback) => {
        ipcRenderer.on('display-picker:sources', (_event, sources) => {
            callback(sources);
        });
    },
    selectSource: (sourceId) => ipcRenderer.send('display-picker:select', sourceId),
    cancel: () => ipcRenderer.send('display-picker:cancel')
});
