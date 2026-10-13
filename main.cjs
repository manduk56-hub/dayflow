const { app, BrowserWindow, ipcMain, dialog, Notification, clipboard } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
let window;
app.setAppUserModelId('Dayflow');
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('second-instance', () => {
  if (window && !window.isDestroyed()) { window.restore();window.show();window.focus(); }
});
if (primaryInstance) app.whenReady().then(() => {
  const storage = require('./storage.cjs').createStorage(app.getPath('userData'));
  ipcMain.on('local-state', (event, payload) => {
    try {
      if (!payload || !['get', 'set', 'setMany'].includes(payload.action)) throw new Error('잘못된 저장 요청입니다.');
      const value = payload.action === 'get' ? storage.getItem(payload.key) : payload.action === 'setMany' ? storage.setItems(payload.values) : storage.setItem(payload.key, payload.value);
      event.returnValue = { ok: true, value };
    } catch { event.returnValue = { ok: false }; }
  });
  window = new BrowserWindow({ width: 1280, height: 900, minWidth: 900, minHeight: 680, title: 'Dayflow · 하루를 나답게', icon: path.join(__dirname, 'assets/icon/dayflow-d.ico'), backgroundColor: '#f5f0df', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  window.loadFile(path.join(__dirname, 'index.html'));
  window.on('focus',()=>window.flashFrame(false));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
});
app.on('window-all-closed', () => app.quit());
ipcMain.handle('copy-plan-image', async (event, html) => {
  if (event.sender !== window?.webContents) throw new Error('잘못된 이미지 복사 요청입니다.');
  return require('./image-export.cjs').copyPlanImage({ BrowserWindow, clipboard }, html);
});
ipcMain.handle('schedule-alarm',(_,payload)=>{
  if(!payload||typeof payload.message!=='string'||payload.message.length>500)return false;
  if(window&&!window.isFocused())window.flashFrame(true);
  if(!Notification.isSupported())return false;
  const notification=new Notification({title:'Dayflow · 일정 알람',body:payload.message,silent:true});
  notification.on('click',()=>{if(window&&!window.isDestroyed()){window.restore();window.show();window.focus();window.flashFrame(false);}});
  notification.show();return true;
});
ipcMain.handle('export-file', async (_, payload) => {
  if (!payload || !['csv', 'pdf', 'png'].includes(payload.type)) throw new Error('지원하지 않는 형식입니다.');
  const type = payload.type;
  const { canceled, filePath } = await dialog.showSaveDialog(window, { defaultPath: `Dayflow-일정표.${type}`, filters: [{ name: type.toUpperCase(), extensions: [type] }] });
  if (canceled || !filePath) return false;
  const contents = type === 'png' ? (await require('./image-export.cjs').renderPlanImage({ BrowserWindow }, payload.html)).toPNG() : type === 'pdf' ? await require('./image-export.cjs').exportPlanPDF({ BrowserWindow }, payload.html) : '\ufeff' + String(payload.content || '');
  await fs.writeFile(filePath, contents);
  return true;
});
