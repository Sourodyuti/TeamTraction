const { app, BrowserWindow, ipcMain, desktopCapturer, screen, systemPreferences, globalShortcut, session } = require('electron');
const path = require('path');

// Disable Vulkan and hardware acceleration on Linux Wayland for screen capture compatibility
if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') {
  app.commandLine.appendSwitch('disable-vulkan');
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
}

let mainWindow;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const windowWidth = 420;
  const windowHeight = 680;
  const x = width - windowWidth - 20; // top-right margin
  const y = 20; // top-right margin

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false
    }
  });

  try {
    mainWindow.setContentProtection(true);
  } catch (error) {
    console.error('Failed to set content protection:', error);
  }

  if (mainWindow.setVisibleOnAllWorkspaces) {
    mainWindow.setVisibleOnAllWorkspaces(true);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL('http://localhost:3000/overlay');
  
  // Set permissions for media access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Display media request handler for non-wayland capturing
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then(sources => {
      const primarySource = sources.find(s => s.name === 'Entire Screen' || s.name === 'Screen 1' || s.name === 'Screen 2') || sources[0];
      if (primarySource) {
        callback({ video: primarySource, audio: 'loopback' });
      } else {
        callback({ error: 'Not found' });
      }
    }).catch(err => {
      callback({ error: err.message });
    });
  });
  
  // Register global shortcut
  globalShortcut.register('CommandOrControl+Shift+1', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      mainWindow.webContents.send('screen:capture-and-ask');
    }
  });
}

// IPC Handlers
ipcMain.handle('screen:capture', async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    // Using a large resolution to capture high quality
    const thumbnailSize = {
      width: primaryDisplay.size.width * primaryDisplay.scaleFactor,
      height: primaryDisplay.size.height * primaryDisplay.scaleFactor
    };
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: thumbnailSize
    });
    
    // Find primary screen
    const primarySource = sources.find(s => s.display_id === primaryDisplay.id.toString()) || sources[0];
    
    if (primarySource && primarySource.thumbnail) {
      let thumbnail = primarySource.thumbnail;
      
      // Resize to max 1600px long edge
      const maxEdge = 1600;
      const { width, height } = thumbnail.getSize();
      
      if (width > maxEdge || height > maxEdge) {
        const ratio = Math.min(maxEdge / width, maxEdge / height);
        thumbnail = thumbnail.resize({
          width: Math.floor(width * ratio),
          height: Math.floor(height * ratio)
        });
      }
      
      const dataUrl = thumbnail.toDataURL();
      return { success: true, dataUrl };
    } else {
      return { success: false, error: 'No screen source found' };
    }
  } catch (error) {
    console.error('Screen capture failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('screen:get-access', () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('screen');
  }
  return 'granted';
});

ipcMain.handle('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.handle('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.handle('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.handle('window-always-on-top', (event, flag) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setAlwaysOnTop(flag);
});

ipcMain.handle('window-set-size', (event, w, h) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setSize(w, h);
});

ipcMain.handle('window-set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (options) {
      win.setIgnoreMouseEvents(ignore, options);
    } else {
      win.setIgnoreMouseEvents(ignore);
    }
  }
});

ipcMain.handle('window-focus', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.focus();
  }
});

ipcMain.handle('app-quit', () => {
  app.quit();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
