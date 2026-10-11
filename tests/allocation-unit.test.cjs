const test=require('node:test');const assert=require('node:assert/strict');
const {createSchedule}=require('../scheduler.js');
const tasks=[{id:'a',name:'A',weight:5},{id:'z',name:'제외',weight:0},{id:'b',name:'B',weight:3},{id:'c',name:'C',weight:2}];
const settings={start:'14:00',end:'18:00',focus:50,rest:10};
function verify(plan,unit){
  assert.equal(plan.rows.reduce((s,r)=>s+r.duration,0),plan.total);
  assert.equal(plan.work+plan.breakTime+plan.fixedTime+plan.idleTime,plan.total);
  plan.rows.forEach((r,i)=>assert.equal(r.start,i?plan.rows[i-1].end:plan.start));
  assert.equal(plan.rows.at(-1).end,plan.end);
  const weighted=plan.allocations.filter(t=>t.type!=='duration'&&t.type!=='fixed'&&t.weight>0);
  weighted.slice(0,-1).forEach(t=>assert.equal(t.minutes%unit,0));
  plan.allocations.forEach(t=>{assert.equal(plan.rows.filter(r=>r.taskId===t.id).reduce((s,r)=>s+r.duration,0),t.minutes);if(t.weight===0)assert.equal(t.minutes,0);if(t.type==='duration'||t.type==='fixed')assert.equal(t.minutes,t.durationMinutes);});
}
test('비중 총 배정 시간을 1·5·10분 단위로 보존하며 나머지는 마지막 작업에 넣는다',()=>{
  for(const unit of [1,5,10]){
    const plan=createSchedule(tasks,{...settings,end:'15:43',rest:0,allocationUnit:unit});verify(plan,unit);
    assert.equal(plan.allocations.at(-1).minutes%unit,103%unit);
  }
  const plan=createSchedule(tasks,{...settings,end:'15:43',rest:0,allocationUnit:10});assert.deepEqual(plan.allocations.map(t=>t.minutes),[50,0,30,23]);
});
test('직접·고정 시간, 휴식, 짧은 시간, 자정 넘김에도 배정 단위를 지킨다',()=>{
  for(const unit of [1,5,10])for(const total of [1,3,9,11,59,103,181])for(const rest of [0,5,10]){
    const endMinute=23*60+total;
    const end=`${String(Math.floor(endMinute/60)%24).padStart(2,'0')}:${String(endMinute%60).padStart(2,'0')}`;
    const mixed=total>59?[{id:'d',name:'직접',type:'duration',durationMinutes:13},...tasks,{id:'f',name:'고정',type:'fixed',durationMinutes:7}]:tasks;
    const plan=createSchedule(mixed,{...settings,start:'23:00',end,rest,allocationUnit:unit});verify(plan,unit);
  }
});
test('기존 저장 설정은 기본 1분이며 잘못된 단위와 모든 비중 0은 안내한다',()=>{
  assert.deepEqual(createSchedule(tasks,settings),createSchedule(tasks,{...settings,allocationUnit:1}));
  for(const unit of [0,2,7,NaN])assert.throws(()=>createSchedule(tasks,{...settings,allocationUnit:unit}),/배정 단위/);
  assert.throws(()=>createSchedule(tasks.map(t=>({...t,weight:0})),{...settings,allocationUnit:10}),/비중/);
});
