const test=require('node:test');const assert=require('node:assert/strict');const {createSchedule,formatTime}=require('../scheduler.js');
const settings={start:'09:00',end:'15:00',focus:50,rest:10};
const work=(id,weight=1)=>({id,name:id,weight});
const fixed=(id,durationMinutes,startTime='')=>({id,name:id,type:'fixed',durationMinutes,startTime});
function verify(plan){
  let cursor=plan.start;
  for(const row of plan.rows){assert.equal(row.start,cursor);assert.ok(row.duration>0);assert.equal(row.end-row.start,row.duration);cursor=row.end;}
  assert.equal(cursor,plan.end);
  assert.equal(plan.work+plan.breakTime+plan.fixedTime+plan.idleTime,plan.total);
  for(const a of plan.allocations){assert.equal(plan.rows.filter(r=>r.taskId===a.id).reduce((s,r)=>s+r.duration,0),a.minutes);if(a.type==='fixed')assert.equal(plan.rows.filter(r=>r.taskId===a.id).length,1);}
}
test('점심 시각을 확보하고 남은 시간에 집중과 휴식을 배분한다',()=>{
  const p=createSchedule([work('A',2),fixed('점심',60,'12:00'),work('B')],settings);verify(p);
  assert.equal(p.work,250);assert.equal(p.breakTime,50);assert.equal(p.fixedTime,60);
  const lunch=p.rows.find(r=>r.taskId==='점심');assert.equal(lunch.start,720);assert.equal(lunch.end,780);
  assert.ok(p.rows.filter(r=>r.type==='task'&&r.kind!=='fixed').map(r=>r.taskId).join('').match(/^A*B*$/));
});
test('시각 없는 이동은 목록 순서대로 분할 없이 배치한다',()=>{
  const p=createSchedule([work('A'),fixed('이동',30),work('B')],{...settings,end:'11:30',rest:0});verify(p);
  assert.deepEqual(p.rows.map(r=>[r.taskId,r.duration]),[['A',60],['이동',30],['B',60]]);
});
test('고정 항목이 작은 틈에 들어가지 않으면 빈 시간을 남기고 작업 예산을 줄인다',()=>{
  const p=createSchedule([fixed('이동',50),fixed('예약',20,'09:30'),work('A')],{...settings,end:'11:00',rest:0});verify(p);
  assert.equal(p.idleTime,30);assert.equal(p.work,20);assert.equal(p.rows.find(r=>r.taskId==='이동').start,590);
});
test('고정 항목만 있는 날과 비중 0도 정확히 표시한다',()=>{
  const p=createSchedule([work('제외',0),fixed('점심',40,'12:00')],settings);verify(p);
  assert.equal(p.work,0);assert.equal(p.breakTime,0);assert.equal(p.idleTime,320);assert.equal(p.allocations[0].minutes,0);
});
test('시간 충돌, 전체 시간 초과, 범위 밖 시각과 배치 불가능은 안내한다',()=>{
  assert.throws(()=>createSchedule([fixed('A',60,'12:00'),fixed('B',30,'12:30')],settings),/겹쳐/);
  assert.throws(()=>createSchedule([fixed('A',400)],settings),/전체 시간/);
  assert.throws(()=>createSchedule([fixed('A',30,'08:00')],settings),/밖/);
  assert.throws(()=>createSchedule([fixed('이동',60),fixed('예약',30,'09:30')],{...settings,end:'10:30'}),/연속/);
  assert.throws(()=>createSchedule([fixed('A',0)],settings));
});
test('자정 이후 고정 시각과 1분 남는 짧은 작업을 보존한다',()=>{
  const p=createSchedule([work('A'),fixed('이동',30,'00:10'),work('B',0)],{...settings,start:'23:50',end:'00:50',rest:0});verify(p);
  assert.equal(p.rows.find(r=>r.taskId==='이동').start,1450);assert.equal(formatTime(p.rows.find(r=>r.taskId==='이동').end),'다음 날 00:40');
  const short=createSchedule([fixed('식사',30),work('A')],{...settings,end:'09:31'});verify(short);assert.equal(short.work,1);assert.equal(short.breakTime,0);
});
test('다양한 길이와 휴식에서 총합, 연속성, 고정 시간 및 작업 배분을 보존한다',()=>{
  for(const length of [91,137,240,601,1000])for(const rest of [0,5,10,20]){
    const end=540+length,stamp=v=>`${String(Math.floor(v/60)%24).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;
    const p=createSchedule([work('제외',0),work('A',3),fixed('이동',15),fixed('식사',20,stamp(570)),work('B',2)],{...settings,end:stamp(end),rest});verify(p);
    assert.equal(p.allocations[0].minutes,0);assert.equal(p.rows.find(r=>r.taskId==='식사').start,570);
    assert.ok(Math.abs(p.allocations[1].minutes-p.work*3/5)<1);assert.ok(Math.abs(p.allocations[4].minutes-p.work*2/5)<1);
  }
});
