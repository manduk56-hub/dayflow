const test=require('node:test');
const assert=require('node:assert/strict');
const {createSchedule}=require('../scheduler.js');
const settings={start:'14:00',end:'18:00',focus:50,rest:10};
const tasks=[{id:'direct',name:'직접 작업',type:'duration',durationMinutes:40},{id:'a',name:'작업 A',weight:3},{id:'zero',name:'제외',weight:0},{id:'b',name:'작업 B',weight:1},{id:'fixed',name:'약속',type:'fixed',durationMinutes:20,startTime:'16:00'}];
function verify(plan){
  assert.equal(plan.rows.reduce((sum,row)=>sum+row.duration,0),plan.total);
  assert.equal(plan.work+plan.breakTime+plan.fixedTime+plan.idleTime,plan.total);
  plan.rows.forEach((row,i)=>{assert.equal(row.end-row.start,row.duration);assert.equal(row.start,i?plan.rows[i-1].end:plan.start);});
  assert.equal(plan.rows.at(-1).end,plan.end);
  plan.allocations.forEach(task=>assert.equal(plan.rows.filter(r=>r.taskId===task.id).reduce((sum,r)=>sum+r.duration,0),task.minutes));
}
test('직접 작업 시간과 고정 활동을 확보하고 남은 시간을 비중에 배분한다',()=>{
  const plan=createSchedule(tasks,settings);verify(plan);
  assert.equal(plan.allocations[0].minutes,40);assert.equal(plan.allocations[2].minutes,0);assert.equal(plan.fixedTime,20);
  assert.equal(plan.rows.find(r=>r.taskId==='direct').kind,'duration');
  assert.ok(Math.abs(plan.allocations[1].minutes-3*plan.allocations[3].minutes)<=2);
  const longer=createSchedule(tasks.map(t=>t.id==='direct'?{...t,durationMinutes:80}:t),settings);verify(longer);
  assert.ok(longer.allocations[1].minutes<plan.allocations[1].minutes);
});
test('짧은 시간, 직접 시간만 있는 일정, 자정 넘김을 보존한다',()=>{
  for(const [start,end,duration] of [['14:00','14:01',1],['23:40','00:20',40]]){
    const plan=createSchedule([{id:'direct',name:'작업',type:'duration',durationMinutes:duration}],{...settings,start,end});verify(plan);assert.equal(plan.work,duration);assert.equal(plan.fixedTime,0);
  }
  const plan=createSchedule([{id:'direct',name:'작업',type:'duration',durationMinutes:5},{id:'zero',name:'제외',weight:0}],{...settings,end:'14:10'});verify(plan);assert.equal(plan.idleTime,5);
});
test('잘못된 직접 시간과 전체 시간 초과를 안내한다',()=>{
  for(const durationMinutes of [null,0,1.5,1440])assert.throws(()=>createSchedule([{id:'d',name:'작업',type:'duration',durationMinutes}],settings));
  assert.throws(()=>createSchedule([{id:'d',name:'작업',type:'duration',durationMinutes:241}],settings),/전체 시간/);
});
test('비중과 직접 시간 작업 전체에 집중·휴식 주기를 적용한다',()=>{
  const plan=createSchedule([{id:'a',name:'2',weight:5},{id:'b',name:'1',type:'duration',durationMinutes:30},{id:'c',name:'3',type:'duration',durationMinutes:90},{id:'d',name:'4',weight:2}],settings);
  verify(plan);assert.equal(plan.work,200);assert.equal(plan.breakTime,40);
  assert.equal(plan.allocations[1].minutes,30);assert.equal(plan.allocations[2].minutes,90);
  assert.ok(plan.rows.filter(r=>r.taskId==='c').length>1);
  let uninterrupted=0;
  for(const row of plan.rows){if(row.type==='task')uninterrupted+=row.duration;else uninterrupted=0;assert.ok(uninterrupted<=60);}
});
test('직접 시간만 있는 긴 작업도 휴식으로 나누고 총 작업 분량을 보존한다',()=>{
  const plan=createSchedule([{id:'d',name:'작업',type:'duration',durationMinutes:90}],settings);verify(plan);
  assert.deepEqual(plan.rows.filter(r=>r.type!=='idle').map(r=>[r.type,r.duration]),[['task',50],['break',10],['task',40]]);
  assert.equal(plan.idleTime,140);
  assert.throws(()=>createSchedule([{id:'d',name:'작업',type:'duration',durationMinutes:90}],{...settings,end:'15:30'}),/휴식/);
  const noBreak=createSchedule([{id:'d',name:'작업',type:'duration',durationMinutes:90}],{...settings,rest:0});verify(noBreak);assert.equal(noBreak.breakTime,0);
});
test('자정 넘김과 고정 약속이 있는 직접 작업에서도 휴식과 시간 연속성을 보존한다',()=>{
  for(const directMinutes of [1,30,60,90])for(const rest of [0,5,10]){
    const plan=createSchedule([{id:'d',name:'직접',type:'duration',durationMinutes:directMinutes},{id:'w',name:'비중',weight:3},{id:'z',name:'제외',weight:0},{id:'f',name:'약속',type:'fixed',durationMinutes:15,startTime:'00:20'}],{...settings,start:'23:00',end:'02:00',rest});
    verify(plan);assert.equal(plan.allocations[0].minutes,directMinutes);assert.equal(plan.allocations[2].minutes,0);assert.equal(plan.fixedTime,15);
  }
});
