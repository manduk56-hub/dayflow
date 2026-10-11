const test=require('node:test'),assert=require('node:assert/strict');
const H=require('../history.js');
const settings={start:'14:00',end:'18:00'};
const row={type:'task',taskId:'a',name:'공부',start:840,end:890,duration:50};
const fixed={type:'task',kind:'fixed',taskId:'f',name:'약속',start:900,end:920,duration:20};
const plan={rows:[row,fixed],total:80,work:50,fixedTime:20,breakTime:10};
test('한국 날짜의 자정 경계와 윤년 달력을 정확히 계산한다',()=>{
  assert.equal(H.dateKey(new Date('2026-10-10T14:59:59Z')),'2026-10-10');
  assert.equal(H.dateKey(new Date('2026-10-10T15:00:00Z')),'2026-10-11');
  const days=H.monthDays('2024-02');assert.ok(days.includes('2024-02-29'));assert.equal(days.length%7,0);
  assert.equal(new Date(days[0]+'T00:00:00Z').getUTCDay(),0);
  assert.equal(H.validDate('2026-02-29'),false);assert.throws(()=>H.monthDays('2026-13'));
});
test('완료 기록을 재계산 뒤에도 보존하고 같은 구간의 중복 저장을 방지한다',()=>{
  let records=H.updateRecord({},'2026-10-10',plan,[0,1],settings);
  records=H.updateRecord(records,'2026-10-10',plan,[0,1],settings);
  assert.deepEqual(H.summary(records['2026-10-10']),{count:2,focus:50,fixed:20});
  const next={...plan,rows:[{...row,end:900,duration:60}]};
  records=H.updateRecord(records,'2026-10-10',next,[],settings);
  assert.equal(records['2026-10-10'].completed.length,2);assert.equal(records['2026-10-10'].plan.rows[0].duration,60);
  records=H.updateRecord(records,'2026-10-10',plan,[1],settings,{row,checked:false});
  assert.deepEqual(H.summary(records['2026-10-10']),{count:1,focus:0,fixed:20});
});
test('날짜별 기록은 독립적인 사본이며 저장과 복원으로 보존된다',()=>{
  const source=structuredClone(plan);let records=H.updateRecord({},'2026-10-10',source,[0],settings);
  const yesterday=JSON.stringify(records['2026-10-10']);records=H.updateRecord(records,'2026-10-11',source,[],settings);
  source.rows[0].name='수정';assert.equal(JSON.stringify(records['2026-10-10']),yesterday);
  assert.equal(records['2026-10-11'].plan.rows[0].name,'공부');assert.equal(H.summary(records['2026-10-11']).count,0);
  assert.deepEqual(H.readRecords(JSON.stringify(records)),records);
  assert.throws(()=>H.readRecords('{broken'));assert.throws(()=>H.readRecords('{"2026-10-11":{}}'));
  assert.deepEqual(H.readRecords(null),{});
});
