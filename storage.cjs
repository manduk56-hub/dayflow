const fs = require('node:fs');
const path = require('node:path');
const keys = new Set(['dayflow-v1', 'dayflow-history-v1', 'dayflow-saved-items-v1', 'dayflow-view-v1', 'dayflow-timer-v1', 'dayflow-alarm-v1', 'dayflow-plans-v1']);

function createStorage(directory) {
  const file = path.join(directory, 'dayflow-state.json');
  let values = {}, readError;
  try {
    values = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!values || Array.isArray(values) || typeof values !== 'object' ||
        Object.entries(values).some(([key, value]) => !keys.has(key) || typeof value !== 'string')) {
      throw new Error('저장 파일 형식이 올바르지 않습니다.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') readError = error;
  }
  function setItems(items) {
      if (readError) throw readError;
      if (!items || Array.isArray(items) || typeof items !== 'object' ||
          Object.entries(items).some(([key, value]) => !keys.has(key) || typeof value !== 'string')) throw new Error('지원하지 않는 저장 항목입니다.');
      const next = { ...values, ...items };
      fs.mkdirSync(directory, { recursive: true });
      const temporary = file + '.tmp';
      const descriptor = fs.openSync(temporary, 'w');
      try {
        fs.writeFileSync(descriptor, JSON.stringify(next, null, 2), 'utf8');
        fs.fsyncSync(descriptor);
      } finally { fs.closeSync(descriptor); }
      fs.renameSync(temporary, file);
      values = next;
  }
  return {
    getItem(key) {
      if (readError) throw readError;
      if (!keys.has(key)) throw new Error('지원하지 않는 저장 항목입니다.');
      return values[key] ?? null;
    },
    setItem(key, value) {
      setItems({ [key]: value });
    },
    setItems
  };
}
module.exports = { createStorage };
