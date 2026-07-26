const { app, BrowserWindow, desktopCapturer, session } = require('electron');

// Suppress WebRTC permissions prompts
app.commandLine.appendSwitch('enable-media-stream');
app.commandLine.appendSwitch('disable-web-security');

let mainWindow;

async function createWindow() {
  // Auto-approve screen capture requests
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Just pick the primary screen
      callback({ video: sources[0], audio: 'loopback' });
    }).catch((err) => {
      console.error('Error getting sources:', err);
      callback();
    });
  });

  // Auto-approve microphone/camera permissions
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow = new BrowserWindow({
    width: 350,
    height: 700,
    x: 100, // You can adjust or let the user drag
    y: 100,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Keep it always on top of EVERYTHING
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  // Load the Next.js overlay page
  mainWindow.loadURL('http://localhost:3000/overlay');

  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
