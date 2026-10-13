const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStorage } = require('../storage.cjs');

function profile(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dayflow-storage-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
test('all local data survives reopening the store and later edits', t => {
  const directory = profile(t), first = createStorage(directory);
  const values = {
    'dayflow-v1': JSON.stringify({ tasks: [{ id: 'reading', name: '독서', weight: 4 }], done: [0], settings: { start: '23:00', end: '01:00' } }),
    'dayflow-history-v1': '{"2026-10-11":{}}',
    'dayflow-saved-items-v1': '[{"name":"식사"}]',
    'dayflow-saved-tasks-v1': '[{"name":"공부","type":"weighted","weight":7}]',
    'dayflow-view-v1': 'circle',
    'dayflow-plans-v1': '{"2026-10-12":{"tasks":[]}}',
    'dayflow-timer-v1': '{"mode":"stopwatch"}',
    'dayflow-alarm-v1': '{"sound":false}'
  };
  for (const [key, value] of Object.entries(values)) first.setItem(key, value);
  const reopened = createStorage(directory);
  for (const [key, value] of Object.entries(values)) assert.equal(reopened.getItem(key), value);
  reopened.setItem('dayflow-view-v1', 'list');
  assert.equal(createStorage(directory).getItem('dayflow-view-v1'), 'list');
  assert.equal(createStorage(directory).getItem('dayflow-v1'), values['dayflow-v1']);
});

test('저장한 할 일의 비중과 직접 시간을 재실행 뒤에도 복원한다', t => {
  const directory=profile(t),storage=createStorage(directory);
  const items=[{name:'공부',type:'weighted',weight:7},{name:'독서',type:'duration',durationMinutes:25}];
  storage.setItem('dayflow-saved-tasks-v1',JSON.stringify(items));
  const reopened=createStorage(directory);
  assert.deepEqual(JSON.parse(reopened.getItem('dayflow-saved-tasks-v1')),items);
  reopened.setItem('dayflow-saved-tasks-v1',JSON.stringify(items.slice(1)));
  assert.deepEqual(JSON.parse(createStorage(directory).getItem('dayflow-saved-tasks-v1')),items.slice(1));
});
test('a damaged saved file is never replaced by defaults', t => {
  const directory = profile(t), file = path.join(directory, 'dayflow-state.json');
  fs.writeFileSync(file, '{damaged');
  const storage = createStorage(directory);
  assert.throws(() => storage.getItem('dayflow-v1'));
  assert.throws(() => storage.setItem('dayflow-v1', '{}'));
  assert.equal(fs.readFileSync(file, 'utf8'), '{damaged');
});
test('failed writes retain the previous complete snapshot', t => {
  const directory = profile(t), storage = createStorage(directory);
  storage.setItem('dayflow-view-v1', 'circle');
  fs.mkdirSync(path.join(directory, 'dayflow-state.json.tmp'));
  assert.throws(() => storage.setItem('dayflow-view-v1', 'list'));
  assert.equal(storage.getItem('dayflow-view-v1'), 'circle');
  assert.equal(createStorage(directory).getItem('dayflow-view-v1'), 'circle');
  assert.throws(() => storage.setItem('../other-file', 'value'));
});
test('날짜별 목표와 마지막 화면을 한 번에 저장하고 실패 시 둘 다 보존한다', t => {
  const directory=profile(t),storage=createStorage(directory);
  storage.setItems({'dayflow-v1':'old','dayflow-plans-v1':'old plans'});
  fs.mkdirSync(path.join(directory,'dayflow-state.json.tmp'));
  assert.throws(()=>storage.setItems({'dayflow-v1':'new','dayflow-plans-v1':'new plans'}));
  const reopened=createStorage(directory);
  assert.equal(reopened.getItem('dayflow-v1'),'old');
  assert.equal(reopened.getItem('dayflow-plans-v1'),'old plans');
  fs.rmdirSync(path.join(directory,'dayflow-state.json.tmp'));
  storage.setItems({'dayflow-v1':'new','dayflow-plans-v1':'new plans'});
  const updated=createStorage(directory);
  assert.equal(updated.getItem('dayflow-v1'),'new');assert.equal(updated.getItem('dayflow-plans-v1'),'new plans');
});
