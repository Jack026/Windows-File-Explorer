const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let tray = null;

// Start internal Express backend server directly inside Electron Node environment
function startServer() {
  try {
    const probe = http.get('http://127.0.0.1:3579/api/drives', (res) => {
      console.log('[Electron] Backend server already active on port 3579.');
    });

    probe.on('error', () => {
      console.log('[Electron] Starting internal Windows Filesystem Bridge server...');
      try {
        const serverPath = path.join(__dirname, '..', 'dist-server', 'index.cjs');
        require(serverPath);
      } catch (err) {
        console.error('[Electron] Error loading server module:', err);
      }
    });
  } catch (err) {
    console.error('[Electron] Failed to start server:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0B0F17',
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.setMenu(null);

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('maximized-change', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('is-maximized', () => {
    return mainWindow?.isMaximized() || false;
  });

  setupTray();
}

function setupTray() {
  try {
    const iconPath = path.join(__dirname, 'icon.png');
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Smart Explorer',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Smart Explorer & Visual Storage Analyzer');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
  } catch (err) {
    console.warn('Tray setup warning:', err);
  }
}

app.whenReady().then(() => {
  startServer();
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
