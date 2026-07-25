const { app, BrowserWindow, desktopCapturer, session } = require('electron');

// Suppress WebRTC permissions prompts
app.commandLine.appendSwitch('enable-media-stream');
app.commandLine.appendSwitch('disable-web-security');

// Determine if we are running on Linux under Wayland
const isWayland = process.platform === 'linux' && process.env.WAYLAND_DISPLAY;

if (isWayland) {
  // Fix for Linux Wayland + Vulkan compatibility crash
  app.commandLine.appendSwitch('disable-vulkan');
  app.disableHardwareAcceleration();
  // Enable Wayland screen sharing via PipeWire (fixes Ubuntu 24.04 screen selection)
  app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
}

let mainWindow;

async function createWindow() {
  // On Windows, macOS, and X11, Electron REQUIRES a handler for getDisplayMedia to work.
  // We auto-approve the primary screen for true "stealth" mode.
  // On Wayland, we intentionally skip this so the OS XDG desktop portal dialog appears.
  if (!isWayland) {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        if (sources && sources.length > 0) {
          callback({ video: sources[0], audio: 'loopback' }); // Auto-pick primary screen
        } else {
          callback();
        }
      }).catch((err) => {
        console.error('Error getting sources:', err);
        callback();
      });
    });
  }

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
