const { contextBridge, ipcRenderer } = require('electron');
function localState(payload) {
  const result = ipcRenderer.sendSync('local-state', payload);
  if (!result?.ok) throw new Error('로컬 저장 파일을 읽거나 쓰지 못했습니다.');
  return result.value;
}
contextBridge.exposeInMainWorld('desktop', {
  exportFile: payload => ipcRenderer.invoke('export-file', payload),
  copyPlanImage: html => ipcRenderer.invoke('copy-plan-image', html),
  notifyAlarm: payload => ipcRenderer.invoke('schedule-alarm',payload),
  storage: {
    getItem: key => localState({ action: 'get', key }),
    setItem: (key, value) => localState({ action: 'set', key, value }),
    setItems: values => localState({ action: 'setMany', values })
  }
});
