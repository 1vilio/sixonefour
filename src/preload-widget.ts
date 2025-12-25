const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    on: (channel: any, callback: any) => {
        ipcRenderer.on(channel, (_event: any, ...args: any[]) => callback(...args));
    },
    send: (channel: any, data: any) => {
        ipcRenderer.send(channel, data);
    },
});
