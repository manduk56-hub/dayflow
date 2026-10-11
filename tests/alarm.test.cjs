const test=require('node:test'),assert=require('node:assert/strict');
const {ScheduleAlarm}=require('../alarm.js');
const rows=[{type:'task',name:'공부',taskId:'a',start:840,end:842,duration:2},{type:'break',name:'휴식',start:842,end:843,duration:1},{type:'task',name:'정리',taskId:'b',start:843,end:845,duration:2}];
test('각 목표와 휴식을 자동 전환하고 마지막 종료는 한 번만 알린다',()=>{
  let now=0;const alarm=new ScheduleAlarm(null,()=>now);alarm.start(rows);assert.equal(alarm.secondsLeft,120);
  now=120000;assert.equal(alarm.tick()[0].name,'공부');assert.equal(alarm.current.type,'break');assert.equal(alarm.secondsLeft,60);
  now=180000;assert.equal(alarm.tick()[0].name,'휴식');assert.equal(alarm.current.name,'정리');
  now=300000;assert.equal(alarm.tick().length,1);assert.equal(alarm.status,'finished');assert.equal(alarm.tick().length,0);
});
test('일시정지 시간은 제외하고 재개하며 중지하면 초기화한다',()=>{
  let now=0;const alarm=new ScheduleAlarm(null,()=>now);alarm.start(rows);now=25000;alarm.pause();assert.equal(alarm.remainingMs,95000);
  now=1000000;assert.equal(alarm.tick().length,0);assert.equal(alarm.remainingMs,95000);alarm.resume();
  now+=95000;assert.equal(alarm.tick()[0].name,'공부');assert.equal(alarm.secondsLeft,60);alarm.stop();assert.equal(alarm.status,'idle');assert.equal(alarm.current,null);
});
test('백그라운드 지연 뒤 여러 구간을 지나도 종료 시각이 밀리지 않는다',()=>{
  let now=0;const alarm=new ScheduleAlarm(null,()=>now);alarm.start(rows);now=195000;
  assert.deepEqual(alarm.tick().map(r=>r.name),['공부','휴식']);assert.equal(alarm.current.name,'정리');assert.equal(alarm.secondsLeft,105);assert.equal(alarm.tick().length,0);
});
test('실행 중 일정 수정은 알람에 영향을 주지 않고 재실행 시 일시정지로 복원한다',()=>{
  let now=0;const alarm=new ScheduleAlarm(null,()=>now),source=structuredClone(rows);alarm.start(source);source[0].duration=10;
  now=10000;alarm.tick();const saved=alarm.snapshot();assert.equal(saved.rows[0].duration,2);
  const restored=new ScheduleAlarm(saved,()=>1000000);assert.equal(restored.status,'paused');assert.equal(restored.secondsLeft,110);
  restored.rows[0].name='수정';assert.equal(saved.rows[0].name,'공부');
  assert.equal(new ScheduleAlarm({...saved,remainingMs:-1}).status,'idle');assert.throws(()=>alarm.start([]));
});
