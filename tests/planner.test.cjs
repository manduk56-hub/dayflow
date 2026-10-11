const test=require('node:test'),assert=require('node:assert/strict');
const Planner=require('../planner.js'),Scheduler=require('../scheduler.js'),History=require('../history.js');
const state={tasks:[{id:'a',name:'내일 공부',weight:2},{id:'b',name:'약속',type:'fixed',durationMinutes:30,startTime:'23:30'}],settings:{start:'23:00',end:'01:00',focus:50,rest:10}};
test('날짜별 입력과 완료 체크를 독립적으로 저장하고 다시 읽는다',()=>{
  const snapshot={...state,planState:state,done:[0],scheduleVersion:2};
  let plans=Planner.put({},'2026-10-12',snapshot);
  plans=Planner.put(plans,'2026-10-13',{tasks:[],settings:state.settings,planState:null,done:[],scheduleVersion:2});
  snapshot.tasks[0].name='다른 이름';
  const restored=Planner.readPlans(JSON.stringify(plans));
  assert.equal(restored['2026-10-12'].tasks[0].name,'내일 공부');assert.deepEqual(restored['2026-10-12'].done,[0]);
  assert.equal(restored['2026-10-13'].tasks.length,0);
  const plan=Scheduler.createSchedule(restored['2026-10-12'].tasks,restored['2026-10-12'].settings);
  assert.equal(plan.total,120);assert.equal(plan.rows.at(-1).end,1500);
});
test('기존 기록에서 고정 시간과 비중 설정을 복원한다',()=>{
  const plan=Scheduler.createSchedule(state.tasks,state.settings);
  const record=History.updateRecord({},'2026-10-12',plan,[0],state.settings)['2026-10-12'];
  const restored=Planner.fromRecord(record);
  assert.equal(restored.tasks.length,2);assert.equal(restored.tasks.find(t=>t.type==='fixed').startTime,'23:30');
  assert.deepEqual(Scheduler.createSchedule(restored.tasks,restored.settings),plan);
});
test('손상된 날짜별 저장값과 존재하지 않는 날짜를 거절한다',()=>{
  assert.deepEqual(Planner.readPlans(null),{});
  assert.throws(()=>Planner.readPlans('{broken'));
  assert.throws(()=>Planner.readPlans('{"2026-02-30":{}}'));
  assert.throws(()=>Planner.put({},'2026-02-30',{...state,done:[]}));
  assert.throws(()=>Planner.readPlans('{"2026-10-12":{"tasks":null}}'));
});
