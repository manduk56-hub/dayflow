const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
let window;
app.whenReady().then(() => {
  window = new BrowserWindow({ width: 1280, height: 900, minWidth: 900, minHeight: 680, title: 'Dayflow · 하루를 나답게', backgroundColor: '#f5f0df', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.loadFile(path.join(__dirname, 'index.html'));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
});
app.on('window-all-closed', () => app.quit());
ipcMain.handle('export-file', async (_, payload) => {
  if (!payload || !['csv', 'pdf'].includes(payload.type)) throw new Error('지원하지 않는 형식입니다.');
  const type = payload.type;
  const { canceled, filePath } = await dialog.showSaveDialog(window, { defaultPath: `Dayflow-일정표.${type}`, filters: [{ name: type.toUpperCase(), extensions: [type] }] });
  if (canceled || !filePath) return false;
  const contents = type === 'pdf' ? await window.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true }) : '\ufeff' + String(payload.content || '');
  await fs.writeFile(filePath, contents);
  return true;
});
