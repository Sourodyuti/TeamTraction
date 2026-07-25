const { app, BrowserWindow, desktopCapturer, session } = require('electron');

// Suppress WebRTC permissions prompts
app.commandLine.appendSwitch('enable-media-stream');
app.commandLine.appendSwitch('disable-web-security');

// Fix for Linux Wayland + Vulkan compatibility crash
app.commandLine.appendSwitch('disable-vulkan');
app.disableHardwareAcceleration();

// Enable Wayland screen sharing via PipeWire (fixes Ubuntu 24.04 screen selection)
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');

let mainWindow;

async function createWindow() {
  // We let the OS handle the screen selection dialog instead of auto-picking,
  // because auto-picking breaks on Ubuntu 24.04 / Wayland.

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
