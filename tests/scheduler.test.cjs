const test=require('node:test');const assert=require('node:assert/strict');const {createSchedule,formatTime}=require('../scheduler.js');
const tasks=[{id:'a',name:'프로젝트',weight:5},{id:'b',name:'영어',weight:3},{id:'c',name:'독서',weight:2}];const settings={start:'14:00',end:'18:00',focus:50,rest:10};
test('4시간을 집중 200분과 휴식 40분으로 배분한다',()=>{const p=createSchedule(tasks,settings);assert.deepEqual(p.allocations.map(t=>t.minutes),[100,60,40]);assert.equal(p.work,200);assert.equal(p.breakTime,40);assert.equal(p.rows.at(-1).end,1080);});
test('0 비중 제외, 작은 시간의 반올림, 자정 넘김',()=>{const p=createSchedule([{id:'a',name:'제외',weight:0},{id:'b',name:'일',weight:1},{id:'c',name:'일2',weight:1}],{...settings,start:'23:58',end:'00:01'});assert.deepEqual(p.allocations.map(t=>t.minutes),[0,2,1]);assert.equal(p.total,3);assert.equal(formatTime(p.end),'다음 날 00:01');});
test('잘못된 입력은 설명과 함께 거절한다',()=>{assert.throws(()=>createSchedule([],settings));assert.throws(()=>createSchedule(tasks,{...settings,end:'14:00'}));assert.throws(()=>createSchedule(tasks.map(t=>({...t,weight:0})),settings));assert.throws(()=>createSchedule(tasks,{...settings,start:'25:00'}));assert.throws(()=>createSchedule(tasks,{...settings,rest:-1}));});
test('가까운 작업 경계로 휴식을 옮겨 60분 작업을 한 구간으로 배치한다',()=>{
  const p=createSchedule(tasks,settings), old=createSchedule(tasks,settings,{alignBreaks:false});
  assert.deepEqual(p.allocations,old.allocations);
  assert.deepEqual(p.rows.filter(r=>r.taskId==='b').map(r=>r.duration),[60]);
  assert.deepEqual(p.rows.filter(r=>r.taskId==='c').map(r=>r.duration),[40]);
  assert.equal(p.rows.filter(r=>r.type==='task').length,4);
  assert.equal(old.rows.filter(r=>r.type==='task').length,5);
  assert.deepEqual(p.rows.filter(r=>r.type==='break').map(r=>r.duration),[10,10,10,10]);
});
test('휴식이 없으면 긴 작업도 한 구간으로 표시한다',()=>{
  const p=createSchedule(tasks,{...settings,rest:0});
  assert.deepEqual(p.rows.map(r=>r.duration),[120,72,48]);
  assert.equal(p.rows.length,3);
  assert.equal(p.breakTime,0);
});
test('배정 시간, 작업 순서, 집중 조정 범위와 짧은 마지막 휴식을 보존한다',()=>{
  for(const focus of [10,25,40,50,90,120])for(const rest of [0,5,10,60])for(const length of [1,9,51,61,137,240,503,1439]){
    const weighted=[{id:'skip',name:'제외',weight:0},{id:'a',name:'A',weight:1},{id:'b',name:'B',weight:7},{id:'c',name:'C',weight:2}];
    const end=(1380+length)%1440,t=v=>`${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;
    const config={start:'23:00',end:t(end),focus,rest};
    const p=createSchedule(weighted,config),old=createSchedule(weighted,config,{alignBreaks:false});
    assert.deepEqual(p.allocations,old.allocations);
    assert.equal(p.work,old.work);assert.equal(p.breakTime,old.breakTime);
    assert.deepEqual(p.rows.filter(r=>r.type==='break').map(r=>r.duration),old.rows.filter(r=>r.type==='break').map(r=>r.duration));
    assert.ok(p.rows.filter(r=>r.type==='task').length<=old.rows.filter(r=>r.type==='task').length);
    let cursor=p.start,lastIndex=-1,interval=0;
    for(const row of p.rows){
      assert.equal(row.start,cursor);assert.equal(row.end-row.start,row.duration);assert.ok(row.duration>0);cursor=row.end;
      if(row.type==='task'){
        const index=weighted.findIndex(t=>t.id===row.taskId);assert.ok(index>=lastIndex);lastIndex=index;interval+=row.duration;
      }else{assert.ok(interval<=focus+Math.floor(focus/5));interval=0;}
    }
    if(rest)assert.ok(interval<=focus+Math.floor(focus/5));
    assert.equal(cursor,p.end);
    for(const a of p.allocations)assert.equal(p.rows.filter(r=>r.taskId===a.id).reduce((sum,r)=>sum+r.duration,0),a.minutes);
    assert.equal(p.allocations[0].minutes,0);
  }
  const short=createSchedule(tasks,{...settings,start:'14:00',end:'14:53'});
  assert.equal(short.rows.at(-1).type,'break');assert.equal(short.rows.at(-1).duration,3);
});
test('다양한 길이에서 시간 누락·겹침이 없고 비중 배분이 유지된다',()=>{for(let total=1;total<=1440;total+=7){for(const rest of [0,5,10,20]){const end=600+total;const t=v=>`${String(Math.floor(v/60)%24).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`;if(total===1440)continue;const p=createSchedule(tasks,{start:'10:00',end:t(end),focus:50,rest});assert.equal(p.total,total);assert.equal(p.work+p.breakTime,total);assert.equal(p.rows.reduce((a,r)=>a+r.duration,0),total);let cursor=p.start;for(const r of p.rows){assert.equal(r.start,cursor);assert.ok(r.duration>0);cursor=r.end;}assert.equal(cursor,p.end);for(const a of p.allocations){assert.equal(p.rows.filter(r=>r.taskId===a.id).reduce((s,r)=>s+r.duration,0),a.minutes);assert.ok(Math.abs(a.minutes-p.work*a.weight/10)<1);}}}});
