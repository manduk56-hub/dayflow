const $ = id => document.getElementById(id);
const colors = ['#7560b2','#b77735','#367f77','#b05c83','#637d42','#b85e48'];
const defaults = { tasks:[{id:'project',name:'프로젝트',weight:5},{id:'english',name:'영어 공부',weight:3},{id:'reading',name:'독서',weight:2}], settings:{start:'14:00',end:'18:00',focus:50,rest:10} };
let state = structuredClone(defaults), plan = null, done = [], builtFrom = '', planVersion = 2, toastTimer;
let flowView='list', selectedCircleRow=0;
try { if(localStorage.getItem('dayflow-view-v1')==='circle')flowView='circle'; } catch {}
try {
  const saved = JSON.parse(localStorage.getItem('dayflow-v1'));
  if (saved && Array.isArray(saved.tasks) && saved.settings) {
    Scheduler.createSchedule(saved.tasks.length && saved.tasks.some(t=>t.weight>0) ? saved.tasks : defaults.tasks, saved.settings);
    state = { tasks:saved.tasks, settings:saved.settings };
    if (saved.planState) { planVersion=saved.scheduleVersion===2?2:1; plan = Scheduler.createSchedule(saved.planState.tasks,saved.planState.settings,{alignBreaks:planVersion===2}); builtFrom=JSON.stringify(saved.planState); done=Array.isArray(saved.done)?saved.done:[]; }
  }
} catch {}
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,3500); }
function save() {
  try { localStorage.setItem('dayflow-v1',JSON.stringify({...state,planState:builtFrom?JSON.parse(builtFrom):null,done,scheduleVersion:planVersion})); }
  catch { toast('자동 저장에 실패했어요. 저장 공간을 확인해주세요.'); }
}
function duration(n) { return n>=60 ? `${Math.floor(n/60)}시간${n%60?' '+n%60+'분':''}` : `${n}분`; }
function el(tag, className, text) { const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node; }
function signature() { return JSON.stringify(state); }
function renderStale() {
  $('stale').hidden=!plan || (planVersion===2 && builtFrom===signature());
  $('stale').textContent=planVersion===1?'↻ 새 배치 방식 · 일정을 다시 만드세요.':'↻ 설정 변경 · 일정을 다시 만드세요.';
}
function update() {
  save(); $('error').textContent=''; renderStale();
  $('task-count').textContent=`${state.tasks.length}개`;
  try { const preview=Scheduler.createSchedule(state.tasks,state.settings); $('window-note').textContent=`${duration(preview.total)}${preview.end>=1440?' · 다음 날':''}`;
    document.querySelectorAll('.share').forEach((node,i)=>{node.textContent=`${preview.allocations[i].minutes}분`;node.title=`시간 비중 ${Math.round(state.tasks[i].weight/state.tasks.reduce((s,t)=>s+t.weight,0)*100)}%`;});
  } catch { $('window-note').textContent='시간과 비중을 정해주세요.'; document.querySelectorAll('.share').forEach(n=>n.textContent='—'); }
}
let taskDrag=null;
function clearDragMarkers() {
  document.querySelectorAll('.task').forEach(row=>row.classList.remove('dragging','drop-before','drop-after'));
  document.body.classList.remove('task-reordering');
}
function updateTaskDropPosition() {
  if(!taskDrag?.active)return;
  const list=$('task-list'),rect=list.getBoundingClientRect(),rows=Array.from(list.children);
  rows.forEach(row=>row.classList.remove('drop-before','drop-after'));
  taskDrag.insertion=null;
  if(taskDrag.x<rect.left-32 || taskDrag.x>rect.right+32 || taskDrag.y<rect.top-32 || taskDrag.y>rect.bottom+32)return;
  const next=rows.findIndex(row=>taskDrag.y<row.getBoundingClientRect().top+row.offsetHeight/2);
  taskDrag.insertion=next<0?rows.length:next;
  if(next<0)rows.at(-1)?.classList.add('drop-after');else rows[next].classList.add('drop-before');
}
function scrollTaskDrag() {
  if(!taskDrag?.active)return;
  const amount=taskDrag.y<64?-12:taskDrag.y>window.innerHeight-64?12:0;
  if(amount)window.scrollBy(0,amount);
  updateTaskDropPosition();taskDrag.frame=requestAnimationFrame(scrollTaskDrag);
}
function finishTaskDrag(commit) {
  if(!taskDrag)return;
  const drag=taskDrag;taskDrag=null;cancelAnimationFrame(drag.frame);
  if(drag.handle.hasPointerCapture(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
  clearDragMarkers();
  if(commit && drag.active && drag.insertion!==null){
    const from=state.tasks.findIndex(task=>task.id===drag.id);
    moveTask(drag.id,drag.insertion-(drag.insertion>from?1:0));
  }
}
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&taskDrag){event.preventDefault();finishTaskDrag(false);}});
function moveTask(taskId,toIndex,focusHandle=false) {
  const fromIndex=state.tasks.findIndex(task=>task.id===taskId);
  if(fromIndex<0 || toIndex<0 || toIndex>=state.tasks.length || fromIndex===toIndex)return;
  const [task]=state.tasks.splice(fromIndex,1);state.tasks.splice(toIndex,0,task);
  renderTasks();update();
  $('reorder-status').textContent=`${task.name}, ${toIndex+1}번째로 이동`;
  if(focusHandle)$('task-list').children[toIndex].querySelector('.drag-handle').focus();
}
function renderTasks() {
  $('task-list').replaceChildren(); $('empty-tasks').hidden=state.tasks.length>0;
  state.tasks.forEach((task,i)=> {
    const row=el('div','task'), top=el('div','task-top'), dot=el('span','dot'); dot.style.background=colors[i%6];row.dataset.taskId=task.id;
    const name=el('input','task-name'); name.value=task.name; name.maxLength=80; name.setAttribute('aria-label',`할 일 ${i+1} 이름`);
    name.addEventListener('input',()=>{task.name=name.value;update();});
    const handle=el('button','drag-handle');handle.type='button';handle.title='드래그해서 순서 이동';handle.setAttribute('aria-label',`${task.name} 순서 이동`);handle.setAttribute('aria-describedby','drag-help');
    const grip=svgNode('svg',{class:'icon',viewBox:'0 0 24 24','aria-hidden':'true'});
    for(const x of [8,16])for(const y of [5,12,19])grip.append(svgNode('rect',{x:x-1.5,y:y-1.5,width:3,height:3,fill:'currentColor',stroke:'none'}));handle.append(grip);
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0 || taskDrag)return;
      event.preventDefault();handle.focus({preventScroll:true});handle.setPointerCapture(event.pointerId);
      taskDrag={id:task.id,handle,row,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false,insertion:null,frame:0};
    });
    handle.addEventListener('pointermove',event=>{
      if(!taskDrag || event.pointerId!==taskDrag.pointerId)return;
      taskDrag.x=event.clientX;taskDrag.y=event.clientY;
      if(!taskDrag.active && Math.hypot(event.clientX-taskDrag.startX,event.clientY-taskDrag.startY)>=6){
        taskDrag.active=true;row.classList.add('dragging');document.body.classList.add('task-reordering');scrollTaskDrag();
      }
      updateTaskDropPosition();
    });
    handle.addEventListener('pointerup',event=>{if(taskDrag?.pointerId===event.pointerId)finishTaskDrag(true);});
    handle.addEventListener('pointercancel',()=>finishTaskDrag(false));
    handle.addEventListener('lostpointercapture',()=>finishTaskDrag(false));
    handle.addEventListener('keydown',event=>{
      if(event.key!=='ArrowUp' && event.key!=='ArrowDown')return;
      event.preventDefault();moveTask(task.id,i+(event.key==='ArrowUp'?-1:1),true);
    });
    const remove=el('button','remove','×'); remove.title='삭제';remove.setAttribute('aria-label',`${task.name} 삭제`);
    remove.addEventListener('click',()=>{state.tasks.splice(i,1);renderTasks();update();});
    top.append(dot,name,remove);
    const controls=el('div','slider-row'), slider=el('input'); slider.type='range'; slider.min='0';slider.max='10';slider.step='1';slider.value=task.weight;slider.setAttribute('aria-label',`${task.name} 비중`);
    const badge=el('span','weight',task.weight), share=el('span','share');badge.title='시간 투자 비중 (0은 제외)';
    slider.addEventListener('input',()=>{task.weight=Number(slider.value);badge.textContent=task.weight;update();});
    controls.append(slider,badge,share);const content=el('div','task-content');content.append(top,controls);row.append(handle,content);$('task-list').append(row);
  });
}
function renderPlan() {
  $('plan-empty').hidden=!!plan; $('plan-content').hidden=!plan; if(!plan)return;
  $('total').textContent=duration(plan.total);$('work').textContent=duration(plan.work);$('break').textContent=duration(plan.breakTime);
  $('allocation-bar').replaceChildren();$('allocation-legend').replaceChildren();
  function allocationSegment(name,minutes,color,isBreak=false) {
    const label=`${name} · ${minutes}분`,bar=el('span','allocation-segment');
    bar.style.width=`${minutes/plan.total*100}%`;bar.style.background=color;
    if(isBreak)bar.classList.add('allocation-break');
    bar.dataset.label=label;bar.tabIndex=0;bar.setAttribute('aria-label',label);
    bar.append(el('span','allocation-label',name));$('allocation-bar').append(bar);
    const legend=el('span'),dot=el('i','dot');dot.style.background=color;
    legend.append(dot,document.createTextNode(`${name} ${minutes}분`));$('allocation-legend').append(legend);
  }
  plan.allocations.forEach((t,i)=>{if(t.minutes)allocationSegment(t.name,t.minutes,colors[i%6]);});
  if(plan.breakTime)allocationSegment('휴식',plan.breakTime,'#c7cebb',true);
  $('timeline').replaceChildren();
  plan.rows.forEach((r,i)=>{
    const row=el('div',`timeline-row ${r.type==='break'?'break':''} ${done.includes(i)?'done':''}`), time=el('div','time-label',Scheduler.formatTime(r.start));time.append(el('small',``, `— ${Scheduler.formatTime(r.end)}`));
    const block=el('div','block');if(r.type==='task') {block.style.borderLeftColor=colors[r.color]; const check=el('input');check.type='checkbox';check.checked=done.includes(i);check.setAttribute('aria-label',`${r.name} ${Scheduler.formatTime(r.start)} 완료`);check.addEventListener('change',()=>setCompletion(i,check.checked));block.append(check);}
    block.append(el('span','name',r.type==='break'?'휴식':r.name),el('span','duration',`${r.duration}분`));row.append(time,block);$('timeline').append(row);
  });
  const excluded=plan.allocations.filter(t=>!t.minutes);
  $('allocation-note').hidden=!excluded.length;
  $('allocation-note').textContent=excluded.length?`미배정: ${excluded.map(t=>t.name).join(', ')}`:'';
  renderProgress();renderStale();renderCircle();renderFlowView();
}
function renderProgress(){const tasks=plan.rows.filter(r=>r.type==='task');const count=plan.rows.filter((r,i)=>r.type==='task'&&done.includes(i)).length;$('progress').textContent=`✓ ${count} / ${tasks.length}`;$('progress').title=`${tasks.length}구간 중 ${count}구간 완료`;$('plan-status').textContent=count===tasks.length?'모두 마쳤어요 ✓':'나만의 흐름';}
function setCompletion(index,checked) {
  if(!plan || plan.rows[index]?.type!=='task')return;
  done=checked?[...new Set([...done,index])]:done.filter(i=>i!==index);
  const row=$('timeline').children[index];
  row.classList.toggle('done',checked);row.querySelector('input').checked=checked;
  save();renderProgress();renderCircleSelection();
}
function svgNode(tag,attributes,text) {
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
  if(text!==undefined)node.textContent=text;
  return node;
}
function renderFlowView() {
  $('timeline').hidden=flowView==='circle';$('circle-view').hidden=flowView!=='circle';
  $('allocation-bar').hidden=false;$('allocation-legend').hidden=false;
  for(const view of ['list','circle'])$(`view-${view}`).setAttribute('aria-pressed',String(flowView===view));
}
function renderCircle() {
  if(!plan)return;
  const chart=$('day-circle');chart.replaceChildren();
  chart.append(svgNode('circle',{cx:220,cy:220,r:123,fill:'none',stroke:'#e6e1d7','stroke-width':54}));
  for(let hour=0;hour<24;hour++){
    const major=hour%3===0,a=DayflowCircle.point(hour*60,major?162:166),b=DayflowCircle.point(hour*60,174);
    chart.append(svgNode('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:major?'#5e5568':'#b4a9b9','stroke-width':major?2:1}));
    if(major){const p=DayflowCircle.point(hour*60,195);chart.append(svgNode('text',{x:p[0],y:p[1],'text-anchor':'middle','dominant-baseline':'middle',class:'circle-hour'},`${hour}시`));}
  }
  $('circle-row').replaceChildren();
  plan.rows.forEach((r,i)=>{
    const label=`${Scheduler.formatTime(r.start)} ~ ${Scheduler.formatTime(r.end)} · ${r.name} · ${r.duration}분`;
    const path=svgNode('path',{d:DayflowCircle.sectorPath(r.start,r.end),fill:r.type==='break'?'#c7cebb':colors[r.color],class:'circle-sector',tabindex:0,role:'button','aria-label':label,'data-row':i});
    path.append(svgNode('title',{},label));
    path.addEventListener('click',()=>{selectedCircleRow=i;renderCircleSelection();});
    path.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectedCircleRow=i;renderCircleSelection();}});
    chart.append(path);
    const option=el('option','',label);option.value=i;$('circle-row').append(option);
  });
  chart.append(svgNode('text',{x:220,y:194,'text-anchor':'middle',class:'circle-center-title'},'나의 하루'));
  chart.append(svgNode('text',{x:220,y:227,'text-anchor':'middle',class:'circle-center-total'},duration(plan.total)));
  chart.append(svgNode('text',{x:220,y:257,'text-anchor':'middle',class:'circle-center-note'},'24시간 기준'));
  if(!plan.rows[selectedCircleRow])selectedCircleRow=0;
  renderCircleSelection();
}
function renderCircleSelection() {
  if(!plan)return;
  const r=plan.rows[selectedCircleRow];if(!r)return;
  $('circle-row').value=selectedCircleRow;
  $('circle-task').textContent=r.name;
  $('circle-time').textContent=`${Scheduler.formatTime(r.start)} ~ ${Scheduler.formatTime(r.end)} · ${duration(r.duration)}${r.type==='task'&&done.includes(selectedCircleRow)?' · 완료':''}`;
  $('circle-done').hidden=r.type!=='task';
  setIconButton($('circle-done'),done.includes(selectedCircleRow)?'reset':'check',done.includes(selectedCircleRow)?'완료 취소':'완료로 표시');
  $('circle-done').setAttribute('aria-pressed',String(done.includes(selectedCircleRow)));
  document.querySelectorAll('.circle-sector').forEach(path=>{
    const index=Number(path.dataset.row),selected=index===selectedCircleRow;
    path.classList.toggle('selected',selected);path.classList.toggle('completed',done.includes(index));path.setAttribute('aria-pressed',String(selected));
  });
}
for(const view of ['list','circle'])$(`view-${view}`).addEventListener('click',()=>{
  flowView=view;renderFlowView();try{localStorage.setItem('dayflow-view-v1',view);}catch{}
});
$('circle-row').addEventListener('change',()=>{selectedCircleRow=Number($('circle-row').value);renderCircleSelection();});
$('circle-done').addEventListener('click',()=>setCompletion(selectedCircleRow,!done.includes(selectedCircleRow)));
function setIconButton(button,name,label) {
  if(button.dataset.iconName!==name){
    const icon=svgNode('svg',{class:'icon',viewBox:'0 0 24 24','aria-hidden':'true'});
    icon.append(svgNode('use',{href:`#icon-${name}`}));button.replaceChildren(icon);button.dataset.iconName=name;
  }
  button.setAttribute('aria-label',label);button.title=label;
}
for(const key of ['start','end','focus','rest']) {$(key).value=state.settings[key];$(key).addEventListener('change',()=>{state.settings[key]=['focus','rest'].includes(key)?Number($(key).value):$(key).value;update();});}
$('add-form').addEventListener('submit',e=>{e.preventDefault();const name=$('new-task').value.trim();if(!name)return;if(state.tasks.length>=30){toast('할 일은 최대 30개까지 추가할 수 있어요.');return;}state.tasks.push({id:crypto.randomUUID(),name,weight:3});$('new-task').value='';renderTasks();update();$('new-task').focus();});
$('generate').addEventListener('click',()=>{try{plan=Scheduler.createSchedule(state.tasks,state.settings);planVersion=2;builtFrom=signature();done=[];selectedCircleRow=0;save();renderPlan();$('error').textContent='';toast('나만의 하루 일정이 준비됐어요.');}catch(e){$('error').textContent=e.message;}});
function csvCell(v) {let text=String(v);if(/^[=+@\-\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
async function exportPlan(type) {
  if(!plan)return;
  const content=[['시작','종료','종류','할 일','분','완료'],...plan.rows.map((r,i)=>[Scheduler.formatTime(r.start),Scheduler.formatTime(r.end),r.type==='break'?'휴식':'집중',r.name,r.duration,r.type==='task'?(done.includes(i)?'완료':'미완료'):''])].map(row=>row.map(csvCell).join(',')).join('\r\n');
  try{if(window.desktop){const saved=await window.desktop.exportFile({type,content});if(saved)toast(`${type.toUpperCase()} 파일을 저장했어요.`);}else if(type==='pdf'){window.print();}else{const blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='Dayflow-일정표.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}catch{toast('파일 저장에 실패했어요. 저장 위치를 확인해주세요.');}
}
$('pdf').addEventListener('click',()=>exportPlan('pdf'));$('csv').addEventListener('click',()=>exportPlan('csv'));
renderTasks();update();renderPlan();

// The timer runs independently of the schedule and stores only local state.
let timerMode='focus', countdown=new DayflowTimer.Countdown(state.settings.focus*60), stopwatch=new DayflowTimer.Stopwatch();
try {
  const saved=JSON.parse(localStorage.getItem('dayflow-timer-v1'));
  if(saved && ['focus','rest','stopwatch'].includes(saved.mode) && Number.isInteger(saved.minutes) && saved.minutes>=1 && saved.minutes<=180) {
    timerMode=saved.mode;
    countdown=new DayflowTimer.Countdown(saved.minutes*60,saved.timer);
    stopwatch=new DayflowTimer.Stopwatch(saved.stopwatch);
  }
} catch {}
function saveTimer() {
  try { localStorage.setItem('dayflow-timer-v1',JSON.stringify({mode:timerMode,minutes:countdown.durationSeconds/60,timer:countdown.snapshot(),stopwatch:stopwatch.snapshot()})); }
  catch { toast('타이머 저장에 실패했어요.'); }
}
function activeTimer() { return timerMode==='stopwatch'?stopwatch:countdown; }
function renderTimer() {
  const active=activeTimer(),isStopwatch=timerMode==='stopwatch',running=active.status==='running';
  const seconds=isStopwatch?stopwatch.secondsElapsed:countdown.secondsLeft;
  const pad=value=>String(value).padStart(2,'0');
  $('timer-display').textContent=isStopwatch?`${pad(Math.floor(seconds/3600))}:${pad(Math.floor(seconds/60)%60)}:${pad(seconds%60)}`:`${pad(Math.floor(seconds/60))}:${pad(seconds%60)}`;
  $('timer-display').setAttribute('aria-label',isStopwatch?'경과 시간':'남은 시간');
  $('timer-status').textContent={idle:'',running:isStopwatch?'측정 중':timerMode==='focus'?'집중 중':'휴식 중',paused:'일시정지',finished:'완료'}[active.status];
  $('timer-status').hidden=active.status==='idle';
  setIconButton($('timer-toggle'),active.status==='running'?'pause':'play',{idle:'시작',running:'일시정지',paused:'계속하기',finished:'다시 시작'}[active.status]);
  $('timer-title').textContent={focus:'집중',rest:'휴식',stopwatch:'스톱워치'}[timerMode];
  document.querySelector('.timer').dataset.mode=timerMode;
  document.querySelector('.timer').dataset.status=active.status;
  $('timer-duration').hidden=isStopwatch;
  $('stopwatch-hint').hidden=!isStopwatch;
  $('timer-progress').hidden=isStopwatch;
  $('timer-progress').value=(1-countdown.remainingMs/(countdown.durationSeconds*1000))*100;
  for(const mode of ['focus','rest','stopwatch']) {
    $(`timer-${mode}`).setAttribute('aria-pressed',String(mode===timerMode));
    $(`timer-${mode}`).disabled=running;
  }
  $('timer-minutes').disabled=running;
}
function setTimerMinutes(value) {
  const minutes=Number(value);
  if(!Number.isInteger(minutes) || minutes<1 || minutes>180) {
    $('timer-error').textContent='1~180분 사이의 정수를 입력해주세요.';
    return false;
  }
  countdown.setDuration(minutes*60);
  $('timer-error').textContent='';
  saveTimer();renderTimer();return true;
}
for(const mode of ['focus','rest','stopwatch']) $(`timer-${mode}`).addEventListener('click',()=>{
  if(activeTimer().status==='running' || timerMode===mode)return;
  timerMode=mode;
  $('timer-error').textContent='';
  if(mode==='stopwatch') {saveTimer();renderTimer();return;}
  const minutes=mode==='focus'?state.settings.focus:(state.settings.rest || 5);
  $('timer-minutes').value=minutes;setTimerMinutes(minutes);
});
$('timer-minutes').value=countdown.durationSeconds/60;
$('timer-minutes').addEventListener('change',()=>setTimerMinutes($('timer-minutes').value));
$('timer-toggle').addEventListener('click',()=>{
  const active=activeTimer();
  if(active.status==='running')active.pause();
  else if(timerMode==='stopwatch')stopwatch.start();
  else {
    // Validate the visible value even if the user has not blurred the input yet.
    const value=Number($('timer-minutes').value);
    if(!Number.isInteger(value) || value<1 || value>180) { $('timer-error').textContent='1~180분 사이의 정수를 입력해주세요.';return; }
    if(value*60!==countdown.durationSeconds && !setTimerMinutes(value))return;
    countdown.start();
  }
  saveTimer();renderTimer();
});
$('timer-reset').addEventListener('click',()=>{
  activeTimer().reset();$('timer-minutes').value=countdown.durationSeconds/60;$('timer-error').textContent='';saveTimer();renderTimer();
});
setInterval(()=>{
  if(activeTimer().tick()) {saveTimer();toast(timerMode==='focus'?'집중 시간이 끝났어요. 잠깐 쉬어가세요.':'휴식 시간이 끝났어요. 다시 시작해볼까요?');}
  renderTimer();
},250);
renderTimer();
