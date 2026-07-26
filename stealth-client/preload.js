const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  screen: {
    capture: () => ipcRenderer.invoke('screen:capture'),
    getAccess: () => ipcRenderer.invoke('screen:get-access'),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    close: () => ipcRenderer.invoke('window-close'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('window-always-on-top', flag),
    setSize: (w, h) => ipcRenderer.invoke('window-set-size', w, h),
    setIgnoreMouseEvents: (ignore, options) => ipcRenderer.invoke('window-set-ignore-mouse-events', ignore, options),
    focus: () => ipcRenderer.invoke('window-focus'),
  },
  onCaptureAndAsk: (callback) => {
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on('screen:capture-and-ask', subscription);
    return () => {
      ipcRenderer.removeListener('screen:capture-and-ask', subscription);
    };
  },
  appQuit: () => ipcRenderer.invoke('app-quit')
});
