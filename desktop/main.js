// ============================================================
//  MAGI 决策系统 - Electron 桌面端主进程
//  启动 Express 后端 → 打开 Electron 窗口
// ============================================================
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;

// 等待 Express 服务就绪
function waitForServer(port, maxRetries = 20) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      const req = http.get(`http://localhost:${port}/api/config`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (retries < maxRetries) { retries++; setTimeout(check, 300); }
        else reject(new Error('Server health check failed'));
        res.resume();
      });
      req.on('error', () => {
        if (retries < maxRetries) { retries++; setTimeout(check, 300); }
        else reject(new Error('Server failed to start'));
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (retries < maxRetries) { retries++; setTimeout(check, 300); }
        else reject(new Error('Server timeout'));
      });
    };
    check();
  });
}

process.env.PORT = process.env.PORT || '3000';

app.whenReady().then(async () => {
  try {
    require('./server.js');
    await waitForServer(3000);
    console.log('[Electron] 后端服务已就绪');
  } catch (err) {
    console.error('[Electron] 后端启动失败:', err.message);
  }

  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 400, minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    title: 'MAGI 决策系统',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });

  mainWindow.loadURL('http://localhost:3000/');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) app.whenReady();
});

app.on('window-all-closed', () => { app.quit(); });
