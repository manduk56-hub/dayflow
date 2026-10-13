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

test('밤샘 일정과 완료 시간을 두 날짜로 나누고 원본을 보존한다',()=>{
  const night={type:'task',taskId:'night',name:'밤샘 공부',start:1410,end:1500,duration:90};
  const rest={type:'break',name:'휴식',start:1500,end:1510,duration:10};
  const appointment={...fixed,start:1510,end:1540,duration:30};
  let records=H.updateRecord({},'2026-10-31',{rows:[night,rest,appointment]},[0,2],{start:'23:30',end:'01:40'});
  const original=JSON.stringify(records),first=H.dayView(records,'2026-10-31'),next=H.dayView(records,'2026-11-01');
  assert.deepEqual(first.stats,{count:1,focus:30,fixed:0});
  assert.deepEqual(next.stats,{count:2,focus:60,fixed:30});
  assert.deepEqual(next.rows.map(i=>[i.row.start,i.row.end,i.row.duration]),[[0,60,60],[60,70,10],[70,100,30]]);
  assert.deepEqual(next.sourceDates,['2026-10-31']);assert.equal(next.rows[0].index,0);assert.equal(next.rows[0].done,true);
  assert.equal(first.stats.focus+next.stats.focus,90);assert.equal(JSON.stringify(records),original);
  records=H.updateRecord(records,'2026-10-31',{rows:[night,rest,appointment]},[2],{}, {row:night,checked:false});
  assert.equal(H.dayView(records,'2026-10-31').stats.focus,0);assert.equal(H.dayView(records,'2026-11-01').stats.focus,0);
});

test('다음 날 자체 일정과 전날의 밤샘 일정을 함께 표시한다',()=>{
  const night={...row,start:1380,end:1500,duration:120};
  let records=H.updateRecord({},'2024-02-28',{rows:[night]},[0],{});
  records=H.updateRecord(records,'2024-02-29',plan,[0,1],settings);
  const view=H.dayView(records,'2024-02-29');
  assert.deepEqual(view.sourceDates,['2024-02-28','2024-02-29']);
  assert.deepEqual(view.stats,{count:3,focus:110,fixed:20});
  assert.equal(view.rows[0].row.start,0);assert.equal(view.rows[1].row.start,840);
  assert.equal(H.dayView(records,'2024-03-01').rows.length,0);
});

test('자정 정각 종료는 다음 날짜에 빈 구간을 만들지 않는다',()=>{
  const midnight={...row,start:1437,end:1440,duration:3};
  const records=H.updateRecord({},'2026-12-31',{rows:[midnight]},[0],{});
  assert.equal(H.dayView(records,'2026-12-31').stats.focus,3);
  assert.deepEqual(H.dayView(records,'2027-01-01').sourceDates,[]);
  assert.equal(H.dateAtMinute('2026-12-31',1440),'2027-01-01');
  assert.equal(H.dateAtMinute('2024-02-28',1500),'2024-02-29');
  assert.throws(()=>H.dayView(records,'2026-02-30'));
});

test('한국 자정 이후 밤샘 종료 전에는 시작한 날짜를 유지한다',()=>{
  const night={start:'22:00',end:'06:00'};
  assert.equal(H.activeOvernight('2026-10-31',night,new Date('2026-10-31T14:59:59Z')),false);
  assert.equal(H.activeOvernight('2026-10-31',night,new Date('2026-10-31T15:00:00Z')),true);
  assert.equal(H.activeOvernight('2026-10-31',night,new Date('2026-10-31T20:59:59Z')),true);
  assert.equal(H.activeOvernight('2026-10-31',night,new Date('2026-10-31T21:00:00Z')),false);
  assert.equal(H.activeOvernight('2026-10-30',night,new Date('2026-10-31T15:00:00Z')),false);
  assert.equal(H.activeOvernight('2026-10-31',{start:'14:00',end:'18:00'},new Date('2026-10-31T15:00:00Z')),false);
  assert.equal(H.activeOvernight('2026-10-31',{start:'23:00',end:'00:00'},new Date('2026-10-31T15:00:00Z')),false);
  assert.equal(H.activeOvernight('2026-10-31',{start:'25:00',end:'06:00'},new Date('2026-10-31T15:00:00Z')),false);
});
