// Desktop writes finish before acknowledging the save; migrate the previous browser store.
const localState = {
  getItem(key) {
    if (!window.desktop?.storage) return localStorage.getItem(key);
    const saved = window.desktop.storage.getItem(key);
    if (saved !== null) return saved;
    const legacy = localStorage.getItem(key);
    if (legacy !== null) window.desktop.storage.setItem(key, legacy);
    return legacy;
  },
  setItem(key, value) {
    if (window.desktop?.storage) window.desktop.storage.setItem(key, value);
    else localStorage.setItem(key, value);
  },
  setItems(values) {
    if(window.desktop?.storage?.setItems)window.desktop.storage.setItems(values);
    else for(const [key,value]of Object.entries(values))this.setItem(key,value);
  }
};
const $ = id => document.getElementById(id);
const colors = ['#7560b2','#b77735','#367f77','#b05c83','#637d42','#b85e48'];
const defaults = { tasks:[{id:'project',name:'프로젝트',weight:5},{id:'english',name:'영어 공부',weight:3},{id:'reading',name:'독서',weight:2}], settings:{start:'14:00',end:'18:00',focus:50,rest:10} };
let state = structuredClone(defaults), plan = null, done = [], builtFrom = '', planVersion = 2, toastTimer;
let flowView='list', selectedCircleRow=0,copyingPlanImage=false,downloadingPlanImage=false;
let planDate=DayflowHistory.dateKey(),historyRecords={},historyReady=true;
let observedToday=planDate;
let historyDate=planDate,historyMonth=planDate.slice(0,7);
let datePlans={},plansReady=true,activeTab="goals";
const mainTabs=['goals','calendar'];
const tabPanels={goals:'goals-panel',calendar:'history'};
try{datePlans=DayflowPlanner.readPlans(localState.getItem("dayflow-plans-v1"));}catch{plansReady=false;}
let scheduleAlarm=new DayflowAlarm.ScheduleAlarm(),alarmSource='',alarmSound=true,alarmAudio=null,lastAlarmSaved=0;
try{const saved=JSON.parse(localState.getItem('dayflow-alarm-v1'));if(saved){scheduleAlarm=new DayflowAlarm.ScheduleAlarm(saved.alarm);alarmSource=saved.source||'';alarmSound=saved.sound!==false;}}catch{}
try{historyRecords=DayflowHistory.readRecords(localState.getItem('dayflow-history-v1'));}catch{historyReady=false;}
let savedItems=[];
try{const items=JSON.parse(localState.getItem('dayflow-saved-items-v1'));if(Array.isArray(items))savedItems=items.filter(t=>t.type==='fixed'&&typeof t.name==='string'&&Number.isInteger(t.durationMinutes)&&t.durationMinutes>0&&t.durationMinutes<=1439);}catch{}
let savedTasks=[];
try{const items=JSON.parse(localState.getItem('dayflow-saved-tasks-v1'));if(Array.isArray(items))savedTasks=items.filter(t=>t&&typeof t.name==='string'&&(t.type==='duration'?Number.isInteger(t.durationMinutes)&&t.durationMinutes>0&&t.durationMinutes<=1439:(!t.type||t.type==='weighted')&&Number.isInteger(t.weight)&&t.weight>=0&&t.weight<=10));}catch{}
try { if(localState.getItem('dayflow-view-v1')==='circle')flowView='circle'; } catch {}
try {
  const last = JSON.parse(localState.getItem('dayflow-v1'));
  const saved = last && datePlans[last.planDate] ? {...datePlans[last.planDate],planDate:last.planDate} : last;
  if (saved && Array.isArray(saved.tasks) && saved.settings) {
    if(DayflowHistory.validDate(saved.planDate))planDate=saved.planDate;
    if(saved.tasks.length<=30 && saved.tasks.every(t=>typeof t.id==='string'&&typeof t.name==='string'))state = { tasks:saved.tasks, settings:saved.settings };
    try{if (saved.planState) { planVersion=saved.scheduleVersion===2?2:1; plan = Scheduler.createSchedule(saved.planState.tasks,saved.planState.settings,{alignBreaks:planVersion===2}); builtFrom=JSON.stringify(saved.planState); done=Array.isArray(saved.done)?saved.done:[]; }}catch{}
  }
} catch {}
historyDate=planDate;historyMonth=planDate.slice(0,7);
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,3500); }
function save(historyChange=null) {
  let saved=true;
  const snapshot={...state,planState:builtFrom?JSON.parse(builtFrom):null,done,scheduleVersion:planVersion,planDate};
  try {
    if(!plansReady)throw new Error('날짜별 저장 파일을 읽지 못했습니다.');
    const next=DayflowPlanner.put(datePlans,planDate,snapshot);
    localState.setItems({'dayflow-plans-v1':JSON.stringify(next),'dayflow-v1':JSON.stringify(snapshot)});datePlans=next;
  } catch { saved=false;toast('자동 저장에 실패했어요. 저장 공간을 확인해주세요.'); }
  if(plan&&historyReady&&plansReady){
    const next=DayflowHistory.updateRecord(historyRecords,planDate,plan,done,JSON.parse(builtFrom).settings,historyChange);
    try{localState.setItem('dayflow-history-v1',JSON.stringify(next));historyRecords=next;$('history-error').textContent='';}
    catch{$('history-error').textContent='하루 기록 저장에 실패했어요. 저장 공간을 확인해주세요.';}
  }
  renderHistory();
  return saved;
}
function selectPlanDate(date){
  if(!DayflowHistory.validDate(date)){ $('goal-date').value=planDate;return; }
  if(date===planDate)return;
  if(!save()){ $('goal-date').value=planDate;return; }
  finishTaskDrag(false);
  const saved=datePlans[date]||DayflowPlanner.fromRecord(historyRecords[date]);
  state=saved?structuredClone({tasks:saved.tasks,settings:saved.settings}):{tasks:[],settings:structuredClone(state.settings)};
  plan=null;done=[];builtFrom='';planVersion=2;selectedCircleRow=0;planDate=date;
  if(saved?.planState){
    try{planVersion=saved.scheduleVersion===2?2:1;plan=Scheduler.createSchedule(saved.planState.tasks,saved.planState.settings,{alignBreaks:planVersion===2});builtFrom=JSON.stringify(saved.planState);done=[...saved.done];}catch{}
  }
  for(const key of ['start','end','focus','rest'])$(key).value=state.settings[key];
  $('allocation-unit').value=state.settings.allocationUnit??1;
  $('new-task').value='';$('new-fixed-name').value='';$('new-fixed-start').value='';
  historyDate=date;historyMonth=date.slice(0,7);
  renderTasks();update(true);renderPlan();
}
function setMainTab(tab){
  DayflowTimePicker.close();DayflowMonthPicker.close();DayflowDatePicker.close();
  activeTab=tab;
  for(const name of mainTabs){const button=$('tab-'+name);button.setAttribute('aria-selected',String(name===tab));button.tabIndex=name===tab?0:-1;$(tabPanels[name]).hidden=name!==tab;}
  if(tab==='calendar')renderHistory();
  renderHeaderDate();
  window.scrollTo(0,0);
}
function syncToday(){
  const today=DayflowHistory.dateKey();
  if(today===observedToday)return;
  const selectedHistoryDate=historyDate,selectedHistoryMonth=historyMonth;
  // Follow the local day only while editing today; keep explicitly selected dates.
  const keepOvernight=DayflowHistory.activeOvernight(planDate,state.settings);
  if(planDate===observedToday&&!keepOvernight){
    DayflowTimePicker.close();DayflowMonthPicker.close();DayflowDatePicker.close();
    selectPlanDate(today);
    if(planDate!==today)return; // Retry later if saving the previous day failed.
  }
  if(selectedHistoryDate===observedToday&&!keepOvernight){historyDate=today;historyMonth=today.slice(0,7);}
  else{historyDate=selectedHistoryDate;historyMonth=selectedHistoryMonth;}
  observedToday=today;
  renderHistory();
}
function renderHeaderDate(){
  const date=activeTab==='calendar'?historyDate:planDate;
  const weekday=['일','월','화','수','목','금','토'][new Date(date+'T00:00:00').getDay()];
  $('header-date-label').textContent=activeTab==='calendar'?'선택한 날짜':'일정 시작 날짜';
  $('header-date').dateTime=date;
  $('header-date').textContent=`${date.replaceAll('-','.')} (${weekday})${date===DayflowHistory.dateKey()?' · 오늘':''}`;
}
for(const tab of mainTabs){
  $('tab-'+tab).addEventListener('click',()=>setMainTab(tab));
  $('tab-'+tab).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const index=mainTabs.indexOf(tab),next=event.key==='Home'?mainTabs[0]:event.key==='End'?mainTabs.at(-1):mainTabs[(index+(event.key==='ArrowRight'?1:mainTabs.length-1))%mainTabs.length];setMainTab(next);$('tab-'+next).focus();}});
}
$('goal-date').value=planDate;
DayflowDatePicker.attach($('goal-date'),$('goal-date-picker'));
$('goal-date').addEventListener('change',()=>{
  const date=$('goal-date').value;
  if(!DayflowHistory.validDate(date)){ $('goal-date').value=historyDate;return; }
  historyDate=date;historyMonth=date.slice(0,7);renderHistory();
});
$('edit-history-date').addEventListener('click',()=>{selectPlanDate(historyDate);if(planDate===historyDate){setMainTab('goals');$('new-task').focus();window.scrollTo(0,0);}});
function duration(n) { return n>=60 ? `${Math.floor(n/60)}시간${n%60?' '+n%60+'분':''}` : `${n}분`; }
function planDateRange(date,start,end){
  const last=DayflowHistory.dateAtMinute(date,end);
  return `${date.replaceAll('-','.')} ${Scheduler.formatTime(start)} → ${last.replaceAll('-','.')} ${Scheduler.formatTime(end%1440)}`;
}
function el(tag, className, text) { const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node; }
function signature() { return JSON.stringify(state); }
function renderStale() {
  $('stale').hidden=!plan || (planVersion===2 && builtFrom===signature());
  $('stale').textContent='입력을 확인해주세요. 현재 일정은 마지막으로 계산한 결과입니다.';
  $('pdf').disabled=$('csv').disabled=!!plan && builtFrom!==signature();
  $('copy-image').disabled=copyingPlanImage||!plan||builtFrom!==signature();
  $('download-image').disabled=downloadingPlanImage||!plan||builtFrom!==signature();
  renderScheduleAlarm();
}
function applyLivePlan(nextPlan) {
  // Keep completion only for the same task and unchanged time slot.
  const rowKey=row=>JSON.stringify([row.taskId,row.start,row.end,row.kind||'weighted']);
  const completed=new Set(done.map(i=>plan?.rows[i]).filter(row=>row?.type==='task').map(rowKey));
  done=nextPlan.rows.flatMap((row,i)=>row.type==='task'&&completed.has(rowKey(row))?[i]:[]);
  plan=nextPlan;planVersion=2;builtFrom=signature();
  selectedCircleRow=Math.min(selectedCircleRow,Math.max(0,plan.rows.length-1));
  renderPlan();
}
function update(initial=false) {
  $('error').textContent='';
  $('task-count').textContent=`${state.tasks.filter(t=>t.type!=='fixed').length}개`;
  $('fixed-count').textContent=`${state.tasks.filter(t=>t.type==='fixed').length}개`;
  try { const preview=Scheduler.createSchedule(state.tasks,state.settings); $('window-note').textContent=preview.end>=1440?`${duration(preview.total)} · ${DayflowHistory.dateAtMinute(planDate,preview.end).replaceAll('-','.')} 종료`:`${duration(preview.total)} · 당일 종료`;
    $('task-list').querySelectorAll('.share').forEach(node=>{const allocation=preview.allocations.find(t=>t.id===node.closest('.task').dataset.taskId);node.textContent=`${allocation.minutes}분`;node.title='비중에 따른 배정 시간';});
    if(plan&&(!initial||(planVersion===2&&builtFrom!==signature())))applyLivePlan(preview);
  } catch(e) { $('window-note').textContent=e.message; $('error').textContent=e.message;$('task-list').querySelectorAll('.share').forEach(n=>n.textContent='—'); }
  renderStale();save();
}
let taskDrag=null;
function clearDragMarkers() {
  document.querySelectorAll('#task-list > .task, #fixed-list > .task').forEach(row=>{row.classList.remove('dragging');row.style.removeProperty('transform');});
  document.body.classList.remove('task-reordering');
}
function beginTaskDrag() {
  const drag=taskDrag,rect=drag.row.getBoundingClientRect(),style=getComputedStyle(drag.row);
  drag.layout=Array.from(drag.list.children).map(node=>{
    const bounds=node.getBoundingClientRect();return {node,top:bounds.top+window.scrollY,height:bounds.height};
  });
  drag.fromIndex=drag.layout.findIndex(item=>item.node===drag.row);drag.targetIndex=drag.fromIndex;
  drag.offsetY=drag.startY-rect.top;drag.baseLeft=rect.left;drag.baseTop=rect.top;drag.height=rect.height;
  const ghost=drag.row.cloneNode(true);ghost.classList.add('drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');
  ghost.style.width=`${rect.width}px`;ghost.style.height=`${rect.height}px`;
  ghost.style.left=`${rect.left}px`;ghost.style.top=`${rect.top}px`;
  ghost.style.paddingTop=style.paddingTop;ghost.style.paddingBottom=style.paddingBottom;
  document.body.append(ghost);drag.ghost=ghost;
  drag.active=true;drag.row.classList.add('dragging');document.body.classList.add('task-reordering');scrollTaskDrag();
}
function updateTaskDropPosition() {
  if(!taskDrag?.active)return;
  const drag=taskDrag,rect=drag.list.getBoundingClientRect();
  const ghostTop=drag.y-drag.offsetY,center=ghostTop+window.scrollY+drag.height/2;
  drag.ghost.style.transform=`translate(${drag.x-drag.startX}px,${ghostTop-drag.baseTop}px)`;
  drag.canDrop=drag.x>=rect.left-32 && drag.x<=rect.right+32 && drag.y>=rect.top-32 && drag.y<=rect.bottom+32;
  const others=drag.layout.filter(item=>item.node!==drag.row);
  const index=others.filter(item=>center>item.top+item.height/2).length;
  if(index===drag.targetIndex)return;
  drag.targetIndex=index;
  const order=others.slice();order.splice(index,0,drag.layout[drag.fromIndex]);
  let top=drag.layout[0].top;
  for(const item of order){item.node.style.transform=`translateY(${top-item.top}px)`;top+=item.height;}
}
function scrollTaskDrag() {
  if(!taskDrag?.active)return;
  const rect=taskDrag.list.getBoundingClientRect();
  const inside=taskDrag.x>=rect.left-32 && taskDrag.x<=rect.right+32;
  const amount=inside?(taskDrag.y<64?-12:taskDrag.y>window.innerHeight-64?12:0):0;
  if(amount)window.scrollBy(0,amount);
  updateTaskDropPosition();taskDrag.frame=requestAnimationFrame(scrollTaskDrag);
}
function finishTaskDrag(commit) {
  if(!taskDrag)return;
  const drag=taskDrag;taskDrag=null;cancelAnimationFrame(drag.frame);
  if(drag.handle.hasPointerCapture(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
  clearDragMarkers();
  if(commit && drag.active && drag.canDrop){
    moveTask(drag.id,drag.targetIndex,true);
  }
  if(drag.ghost){
    let target=Array.from(drag.list.children).find(row=>row.dataset.taskId===drag.id)?.getBoundingClientRect();
    if(!commit || !drag.canDrop)target={left:drag.baseLeft,top:drag.layout[drag.fromIndex].top-window.scrollY};
    if(target && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      const settle=drag.ghost.animate([
        {transform:drag.ghost.style.transform,opacity:1},
        {transform:`translate(${target.left-drag.baseLeft}px,${target.top-drag.baseTop}px)`,opacity:0}
      ],{duration:160,easing:'ease-out',fill:'forwards'});
      settle.onfinish=()=>drag.ghost.remove();
    }else drag.ghost.remove();
  }
}
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&taskDrag){event.preventDefault();finishTaskDrag(false);}});
function moveTask(taskId,toIndex,focusHandle=false) {
  const task=state.tasks.find(task=>task.id===taskId);if(!task)return;
  const fixed=task.type==='fixed',list=$(fixed?'fixed-list':'task-list');
  const indices=state.tasks.map((t,i)=>(t.type==='fixed')===fixed?i:-1).filter(i=>i>=0);
  const tasks=indices.map(i=>state.tasks[i]),fromIndex=tasks.indexOf(task);
  if(toIndex<0 || toIndex>=tasks.length || fromIndex===toIndex)return;
  tasks.splice(fromIndex,1);tasks.splice(toIndex,0,task);
  indices.forEach((index,i)=>{state.tasks[index]=tasks[i];});
  renderTasks();update();
  $('reorder-status').textContent=`${task.name}, ${toIndex+1}번째로 이동`;
  if(focusHandle)list.children[toIndex].querySelector('.drag-handle').focus({preventScroll:true});
}
function renderTasks() {
  $('task-list').replaceChildren();$('fixed-list').replaceChildren();
  $('empty-tasks').hidden=state.tasks.some(t=>t.type!=='fixed');
  $('empty-fixed').hidden=state.tasks.some(t=>t.type==='fixed');
  state.tasks.forEach((task,i)=> {
    const list=$(task.type==='fixed'?'fixed-list':'task-list'),listIndex=list.children.length;
    const row=el('div','task'), top=el('div','task-top'), dot=el('span','dot'); dot.style.background=colors[i%6];row.dataset.taskId=task.id;
    const name=el('input','task-name'); name.value=task.name; name.maxLength=80; name.setAttribute('aria-label',`할 일 ${i+1} 이름`);
    name.addEventListener('input',()=>{task.name=name.value;update();});
    const handle=el('button','drag-handle');handle.type='button';handle.title='드래그해서 순서 이동';handle.setAttribute('aria-label',`${task.name} 순서 이동`);handle.setAttribute('aria-describedby','drag-help');
    const grip=svgNode('svg',{class:'icon',viewBox:'0 0 24 24','aria-hidden':'true'});
    for(const x of [8,16])for(const y of [5,12,19])grip.append(svgNode('rect',{x:x-1.5,y:y-1.5,width:3,height:3,fill:'currentColor',stroke:'none'}));handle.append(grip);
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0 || taskDrag)return;
      event.preventDefault();handle.focus({preventScroll:true});handle.setPointerCapture(event.pointerId);
      taskDrag={id:task.id,handle,row,list,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false,frame:0};
    });
    handle.addEventListener('pointermove',event=>{
      if(!taskDrag || event.pointerId!==taskDrag.pointerId)return;
      taskDrag.x=event.clientX;taskDrag.y=event.clientY;
      if(!taskDrag.active && Math.hypot(event.clientX-taskDrag.startX,event.clientY-taskDrag.startY)>=6){
        beginTaskDrag();
      }
      updateTaskDropPosition();
    });
    handle.addEventListener('pointerup',event=>{if(taskDrag?.pointerId===event.pointerId)finishTaskDrag(true);});
    handle.addEventListener('pointercancel',()=>finishTaskDrag(false));
    handle.addEventListener('lostpointercapture',()=>finishTaskDrag(false));
    handle.addEventListener('keydown',event=>{
      if(event.key!=='ArrowUp' && event.key!=='ArrowDown')return;
      event.preventDefault();moveTask(task.id,listIndex+(event.key==='ArrowUp'?-1:1),true);
    });
    const remove=el('button','remove','×'); remove.title='삭제';remove.setAttribute('aria-label',`${task.name} 삭제`);
    remove.addEventListener('click',()=>{state.tasks.splice(i,1);renderTasks();update();});
    top.append(dot,name);
    if(task.type!=='fixed') {
      const mode=el('select','task-allocation-mode');mode.setAttribute('aria-label',`${task.name} 시간 배분 방식`);
      for(const [value,label] of [['weighted','비중'],['duration','직접 시간']]){const option=el('option','',label);option.value=value;mode.append(option);}
      mode.value=task.type==='duration'?'duration':'weighted';
      mode.addEventListener('change',()=>{task.type=mode.value;if(task.type==='duration'&&!Number.isInteger(task.durationMinutes))task.durationMinutes=30;if(task.type==='weighted'&&!Number.isInteger(task.weight))task.weight=3;renderTasks();update();});
      top.append(mode);
      const remember=el('button','save-item');remember.type='button';setIconButton(remember,'save',`${task.name} 자주 쓰는 할 일로 저장`);
      remember.addEventListener('click',()=>saveTaskItem(task));top.append(remember);
    }
    top.append(remove);
    if(task.type==='fixed'){
      const controls=el('div','fixed-fields task-fixed-fields'),durationLabel=el('label','','분'),timeLabel=el('label','','시작 (선택)');
      const input=el('input');input.type='number';input.min=1;input.max=1439;input.value=task.durationMinutes;input.setAttribute('aria-label',`${task.name} 소요 시간 (분)`);
      input.addEventListener('input',()=>{task.durationMinutes=input.value===''?null:Number(input.value);update();});durationLabel.append(input);
      const time=el('input');time.type='time';time.value=task.startTime||'';time.setAttribute('aria-label',`${task.name} 시작 시각 (선택)`);
      time.addEventListener('input',()=>{task.startTime=time.value;update();});timeLabel.append(time);
      const remember=el('button','save-item');remember.type='button';setIconButton(remember,'save','자주 쓰는 항목으로 저장');
      remember.addEventListener('click',()=>saveFixedItem(task));
      const share=el('span','share');share.hidden=true;
      controls.append(durationLabel,timeLabel,remember,share);
      const content=el('div','task-content');content.append(top,controls);row.append(handle,content);list.append(row);return;
    }
    if(task.type==='duration') {
      const controls=el('div','direct-time-fields'),label=el('label','','직접 시간 (분)'),input=el('input');
      input.type='number';input.min=1;input.max=1439;input.value=task.durationMinutes;input.setAttribute('aria-label',`${task.name} 직접 시간 (분)`);
      input.addEventListener('input',()=>{task.durationMinutes=input.value===''?null:Number(input.value);update();});label.append(input);
      const share=el('span','share');controls.append(label,share);
      const content=el('div','task-content');content.append(top,controls);row.append(handle,content);list.append(row);return;
    }
    const controls=el('div','slider-row'), slider=el('input'); slider.type='range'; slider.min='0';slider.max='10';slider.step='1';slider.value=task.weight;slider.setAttribute('aria-label',`${task.name} 비중`);
    const badge=el('span','weight',task.weight), share=el('span','share');badge.title='시간 투자 비중 (0은 제외)';
    slider.addEventListener('input',()=>{task.weight=Number(slider.value);badge.textContent=task.weight;update();});
    controls.append(slider,badge,share);const content=el('div','task-content');content.append(top,controls);row.append(handle,content);list.append(row);
  });
}
function renderPlan() {
  $('plan-heading-title').textContent=plan?`일정 · ${planDate.replaceAll('-','.')}${plan.end>=1440?` → ${DayflowHistory.dateAtMinute(planDate,plan.end).replaceAll('-','.')}`:''}`:'일정';
  $('plan-heading-title').title=plan?planDateRange(planDate,plan.start,plan.end):'';
  $('plan-empty').hidden=!!plan; $('plan-content').hidden=!plan; if(!plan)return;
  $('total').textContent=duration(plan.total);$('work').textContent=duration(plan.work);$('break').textContent=duration(plan.breakTime);
  $('fixed-metric').hidden=!plan.fixedTime;$('fixed-total').textContent=duration(plan.fixedTime||0);document.querySelector('.metrics').classList.toggle('has-fixed',!!plan.fixedTime);
  $('allocation-bar').replaceChildren();$('allocation-legend').replaceChildren();
  function allocationSegment(name,minutes,color,isBreak=false) {
    const label=`${name} · ${minutes}분`,bar=el('span','allocation-segment');
    bar.style.width=`${minutes/plan.total*100}%`;bar.style.background=color;
    if(isBreak)bar.classList.add('allocation-break');
    bar.dataset.label=label;bar.tabIndex=0;bar.setAttribute('aria-label',label);
    const barLabel=el('span','allocation-label',name);
    bar.append(barLabel);$('allocation-bar').append(bar);
    const legend=el('span'),dot=el('i','dot');dot.style.background=color;
    legend.append(dot,document.createTextNode(`${name} ${minutes}분`));$('allocation-legend').append(legend);
  }
  plan.allocations.forEach((t,i)=>{if(t.minutes)allocationSegment(t.name,t.minutes,colors[i%6]);});
  if(plan.breakTime)allocationSegment('휴식',plan.breakTime,DayflowPalette.current.variables['--theme-break'],true);
  if(plan.idleTime)allocationSegment('빈 시간',plan.idleTime,DayflowPalette.current.variables['--theme-idle'],true);
  $('timeline').replaceChildren();
  plan.rows.forEach((r,i)=>{
    const row=el('div',`timeline-row ${r.type==='break'||r.type==='idle'?'break':''} ${r.kind==='fixed'?'fixed-row':''} ${done.includes(i)?'done':''}`), time=el('div','time-label',Scheduler.formatTime(r.start));time.append(el('small',``, `— ${Scheduler.formatTime(r.end)}`));
    if(plan.end>=1440){const startDate=DayflowHistory.dateAtMinute(planDate,r.start),endDate=DayflowHistory.dateAtMinute(planDate,r.end);time.prepend(el('small','time-date',`${startDate.slice(5).replace('-','.')} ${startDate!==endDate?'→ '+endDate.slice(5).replace('-','.'):''}`));}
    const block=el(r.type==='task'?'label':'div','block');if(r.type==='task') {block.style.borderLeftColor=colors[r.color]; const check=el('input');check.type='checkbox';check.checked=done.includes(i);check.setAttribute('aria-label',`${r.name} ${Scheduler.formatTime(r.start)} 완료`);check.addEventListener('change',()=>setCompletion(i,check.checked));block.append(check);}
    block.append(el('span','name',r.type==='break'?'휴식':r.name),el('span','duration',`${r.kind==='fixed'?'고정 · ':''}${r.duration}분`));row.append(time,block);$('timeline').append(row);
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
  save({row:plan.rows[index],checked});renderProgress();renderCircleSelection();
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
  chart.append(svgNode('circle',{cx:220,cy:220,r:150,fill:DayflowPalette.current.variables['--theme-idle']}));
  for(let hour=0;hour<24;hour++){
    const major=hour%3===0,a=DayflowCircle.point(hour*60,major?162:166),b=DayflowCircle.point(hour*60,174);
    chart.append(svgNode('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:major?DayflowPalette.current.variables['--theme-muted']:DayflowPalette.current.variables['--theme-line'],'stroke-width':major?2:1}));
    if(major){const p=DayflowCircle.point(hour*60,195);chart.append(svgNode('text',{x:p[0],y:p[1],'text-anchor':'middle','dominant-baseline':'middle',class:'circle-hour'},`${hour}시`));}
  }
  $('circle-row').replaceChildren();
  plan.rows.forEach((r,i)=>{
    const label=`${Scheduler.formatTime(r.start)} ~ ${Scheduler.formatTime(r.end)} · ${r.name} · ${r.duration}분`;
    const path=svgNode('path',{d:DayflowCircle.sectorPath(r.start,r.end),fill:r.type==='break'?DayflowPalette.current.variables['--theme-break']:r.type==='idle'?DayflowPalette.current.variables['--theme-idle']:colors[r.color],class:'circle-sector',tabindex:0,role:'button','aria-label':label,'data-row':i});
    path.append(svgNode('title',{},label));
    path.addEventListener('click',()=>{selectedCircleRow=i;renderCircleSelection();});
    path.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectedCircleRow=i;renderCircleSelection();}});
    chart.append(path);
    const option=el('option','',label);option.value=i;$('circle-row').append(option);
  });
  chart.append(svgNode('circle',{cx:220,cy:220,r:44,class:'circle-center','aria-hidden':'true'}));
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
  flowView=view;renderFlowView();try{localState.setItem('dayflow-view-v1',view);}catch{}
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
for(const key of ['start','end','focus','rest']) {$(key).value=state.settings[key];$(key).addEventListener('input',()=>{state.settings[key]=['focus','rest'].includes(key)?Number($(key).value):$(key).value;update();});}
for(const key of ['start','end']){
  DayflowTimePicker.attach($(key),$(key+'-picker'),key==='start'?'시작 시간':'종료 시간');
}
$('allocation-unit').value=state.settings.allocationUnit??1;
$('allocation-unit').addEventListener('change',()=>{state.settings.allocationUnit=Number($('allocation-unit').value);update();});
function addTask(task){
  if(state.tasks.length>=30){toast('할 일은 최대 30개까지 추가할 수 있어요.');return false;}
  state.tasks.push({...task,id:crypto.randomUUID()});renderTasks();update();return true;
}
function renderSavedItems(){
  for(const [items,selectId,addId,removeId]of [[savedItems,'saved-item-select','add-saved-item','remove-saved-item'],[savedTasks,'saved-task-select','add-saved-task','remove-saved-task']]){
    const select=$(selectId),selected=select.value;select.replaceChildren();
    if(!items.length){const option=el('option','','아직 저장한 항목이 없어요');option.value='';select.append(option);}
    items.forEach((item,i)=>{const detail=item.type==='fixed'?`${item.durationMinutes}분${item.startTime?' · '+item.startTime:''}`:item.type==='duration'?`직접 시간 ${item.durationMinutes}분`:`비중 ${item.weight}`;const option=el('option','',`${item.name} · ${detail}`);option.value=i;select.append(option);});
    if(items.length)select.value=String(Math.min(Number(selected)||0,items.length-1));
    select.disabled=$(addId).disabled=$(removeId).disabled=!items.length;
  }
}
function storeSavedItems(next,isTask=false){
  try{localState.setItem(isTask?'dayflow-saved-tasks-v1':'dayflow-saved-items-v1',JSON.stringify(next));}
  catch{toast('항목 저장에 실패했어요.');return false;}
  if(isTask)savedTasks=next;else savedItems=next;
  renderSavedItems();return true;
}
function saveLibraryItem(task,isTask){
  if(!task.name.trim()){toast('이름을 먼저 입력해주세요.');return;}
  const timed=!isTask||task.type==='duration';
  if(timed&&(!Number.isInteger(task.durationMinutes)||task.durationMinutes<1||task.durationMinutes>1439)){toast('소요 시간은 1~1439분으로 입력해주세요.');return;}
  if(!timed&&(!Number.isInteger(task.weight)||task.weight<0||task.weight>10)){toast('비중은 0~10으로 입력해주세요.');return;}
  const item={name:task.name.trim(),type:isTask?(timed?'duration':'weighted'):'fixed',...(timed?{durationMinutes:task.durationMinutes}:{weight:task.weight}),...(!isTask?{startTime:task.startTime||''}:{})};
  const next=[...(isTask?savedTasks:savedItems)],previous=next.findIndex(t=>t.name===item.name);
  if(previous>=0)next[previous]=item;
  else{if(next.length>=30){toast('저장한 항목은 최대 30개까지 보관할 수 있어요.');return;}next.push(item);}
  if(storeSavedItems(next,isTask)){$(isTask?'saved-tasks':'saved-items').open=true;$(isTask?'saved-task-select':'saved-item-select').value=String(previous>=0?previous:next.length-1);toast(`${item.name} 항목을 저장했어요.`);}
}
function saveFixedItem(task){saveLibraryItem(task,false);}
function saveTaskItem(task){saveLibraryItem(task,true);}
$('add-form').addEventListener('submit',e=>{
  e.preventDefault();const name=$('new-task').value.trim();if(!name)return;
  if(addTask({name,weight:3})){$('new-task').value='';$('new-task').focus();}
});
$('add-fixed-form').addEventListener('submit',e=>{
  e.preventDefault();const name=$('new-fixed-name').value.trim();if(!name)return;
  const task={name,type:'fixed',durationMinutes:Number($('new-duration').value),startTime:$('new-fixed-start').value};
  if(!Number.isInteger(task.durationMinutes)||task.durationMinutes<1||task.durationMinutes>1439){toast('소요 시간은 1~1439분으로 입력해주세요.');return;}
  if(addTask(task)){$('new-fixed-name').value='';$('new-fixed-start').value='';$('new-fixed-name').focus();}
});
$('add-saved-item').addEventListener('click',()=>{const item=savedItems[Number($('saved-item-select').value)];if(item)addTask(item);});
$('remove-saved-item').addEventListener('click',()=>{const index=Number($('saved-item-select').value);if(savedItems[index])storeSavedItems(savedItems.filter((_,i)=>i!==index));});
$('add-saved-task').addEventListener('click',()=>{const item=savedTasks[Number($('saved-task-select').value)];if(item)addTask(item);});
$('remove-saved-task').addEventListener('click',()=>{const index=Number($('saved-task-select').value);if(savedTasks[index])storeSavedItems(savedTasks.filter((_,i)=>i!==index),true);});
renderSavedItems();
$('generate').addEventListener('click',()=>{try{plan=Scheduler.createSchedule(state.tasks,state.settings);planVersion=2;builtFrom=signature();done=[];selectedCircleRow=0;save();renderPlan();$('error').textContent='';toast('나만의 하루 일정이 준비됐어요.');}catch(e){$('error').textContent=e.message;}});
function csvCell(v) {let text=String(v);if(/^[=+@\-\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
function planImageHTML(){
  const source=document.querySelector('.plan'),copy=source.cloneNode(true);
  for(const [key,value]of Object.entries(DayflowPalette.current.variables))copy.style.setProperty(key,value);
  const paletteStyle=getComputedStyle(document.documentElement);
  for(const key of ['--bg','--paper','--ink','--muted','--green','--line','--shadow','--c0','--c1','--c2','--c3','--c4','--c5'])copy.style.setProperty(key,paletteStyle.getPropertyValue(key));
  // Checked is a live property; carry it into the serialized snapshot as well.
  source.querySelectorAll('input[type=checkbox]').forEach((input,index)=>copy.querySelectorAll('input[type=checkbox]')[index].toggleAttribute('checked',input.checked));
  copy.querySelectorAll('.export-actions,.flow-view-switch,.circle-details,.stale').forEach(node=>node.remove());
  if(flowView==='circle')copy.querySelector('#timeline').before(copy.querySelector('#circle-view'));
  return document.querySelector('.icon-defs').outerHTML+copy.outerHTML;
}
async function exportPlan(type) {
  if(!plan)return;
  const content=[['시작','종료','종류','할 일','분','완료'],...plan.rows.map((r,i)=>[Scheduler.formatTime(r.start),Scheduler.formatTime(r.end),r.kind==='fixed'?'고정 시간':r.type==='break'?'휴식':r.type==='idle'?'빈 시간':'집중',r.name,r.duration,r.type==='task'?(done.includes(i)?'완료':'미완료'):''])].map(row=>row.map(csvCell).join(',')).join('\r\n');
  try{if(window.desktop){const saved=await window.desktop.exportFile({type,content,html:type==='pdf'?planImageHTML():undefined});if(saved)toast(`${type.toUpperCase()} 파일을 저장했어요.`);}else if(type==='pdf'){window.print();}else{const blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='Dayflow-일정표.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}catch{toast('파일 저장에 실패했어요. 저장 위치를 확인해주세요.');}
}
$('copy-image').addEventListener('click',async()=>{
  if(!plan||builtFrom!==signature()||copyingPlanImage)return;
  if(!window.desktop?.copyPlanImage){toast('이미지 복사는 Dayflow 프로그램에서 사용할 수 있어요.');return;}
  copyingPlanImage=true;renderStale();$('copy-image').textContent='복사 중…';
  try{
    await window.desktop.copyPlanImage(planImageHTML());
    toast('전체 일정표 이미지를 복사했어요. Ctrl+V로 붙여넣으세요.');
  }catch{toast('이미지 복사에 실패했어요. 다시 시도해주세요.');}
  finally{copyingPlanImage=false;$('copy-image').textContent='이미지 복사';renderStale();}
});
$('pdf').addEventListener('click',()=>exportPlan('pdf'));$('csv').addEventListener('click',()=>exportPlan('csv'));
$('download-image').addEventListener('click',async()=>{
  if(!plan||builtFrom!==signature()||downloadingPlanImage)return;
  if(!window.desktop?.exportFile){toast('이미지 다운로드는 Dayflow 프로그램에서 사용할 수 있어요.');return;}
  downloadingPlanImage=true;renderStale();$('download-image').textContent='저장 중…';
  try{
    const saved=await window.desktop.exportFile({type:'png',html:planImageHTML()});
    if(saved)toast('전체 일정표 이미지를 PNG로 저장했어요.');
  }catch{toast('이미지 저장에 실패했어요. 저장 위치를 확인해주세요.');}
  finally{downloadingPlanImage=false;$('download-image').textContent='이미지 다운로드';renderStale();}
});
function renderHistory(){
  $('goal-date').value=historyDate;
  renderHeaderDate();
  if(!plansReady)$('history-error').textContent='날짜별 일정을 읽지 못했어요. 기존 데이터를 보호하기 위해 저장을 중단했어요.';
  if(!historyReady)$('history-error').textContent='저장된 하루 기록을 읽지 못했어요. 기존 기록을 보호하기 위해 기록 저장을 중단했어요.';
  const today=DayflowHistory.dateKey();$('history-month').value=historyMonth;DayflowMonthPicker.display($('history-month'),$('history-month-label'));
  const calendar=$('history-calendar'),views=new Map(DayflowHistory.monthDays(historyMonth).map(date=>[date,DayflowHistory.dayView(historyRecords,date)]));calendar.replaceChildren();
  for(const date of DayflowHistory.monthDays(historyMonth)){
    const view=views.get(date),draft=datePlans[date],stats=view.stats,hasRecord=!!historyRecords[date]||view.sourceDates.length>0,continued=view.sourceDates.some(source=>source!==date),button=el('button','history-day',Number(date.slice(8)));
    button.type='button';button.dataset.date=date;button.dataset.heat=stats.focus>=240?4:stats.focus>=120?3:stats.focus>=60?2:stats.focus>0?1:0;
    button.classList.toggle('other-month',!date.startsWith(historyMonth));button.classList.toggle('has-record',hasRecord||!!draft?.tasks.length);button.classList.toggle('is-today',date===today);
    button.setAttribute('aria-pressed',String(date===historyDate));button.setAttribute('aria-label',`${date}${date===today?' 오늘':''}, ${hasRecord?`완료 ${stats.count}구간, 집중 ${stats.focus}분${continued?' · 전날부터 이어진 일정':''}`:draft?.tasks.length?`목표 ${draft.tasks.length}개`:'일정 없음'}`);
    button.title=button.getAttribute('aria-label');
    button.addEventListener('click',()=>{historyDate=date;historyMonth=date.slice(0,7);renderHistory();$('history-calendar').querySelector(`[data-date="${date}"]`)?.focus({preventScroll:true});});calendar.append(button);
  }
  const monthViews=[...views].filter(([date])=>date.startsWith(historyMonth)),monthFocus=monthViews.reduce((sum,[,view])=>sum+view.stats.focus,0),recordDays=monthViews.filter(([date,view])=>historyRecords[date]||view.sourceDates.length).length;
  $('history-month-summary').textContent=`이번 달 기록 ${recordDays}일 · 완료 집중 ${duration(monthFocus)}`;
  $('history-date').textContent=`${historyDate.replaceAll('-','.')} 일정`;
  const view=DayflowHistory.dayView(historyRecords,historyDate),stats=view.stats,list=$('history-completed'),timeline=$('history-timeline'),hasRecord=!!historyRecords[historyDate]||view.sourceDates.length>0;list.replaceChildren();timeline.replaceChildren();
  $('history-plan').hidden=!view.rows.length;
  $('history-plan').querySelector('summary').textContent='이 날짜의 일정 · 자정 기준';
  const links=$('history-linked-plans');links.replaceChildren();links.hidden=true;
  for(const sourceDate of view.sourceDates.filter(date=>date!==historyDate)){
    links.hidden=false;
    const button=el('button','secondary',`${sourceDate.replaceAll('-','.')}에 시작한 밤샘 일정 편집`);button.type='button';
    button.addEventListener('click',()=>{selectPlanDate(sourceDate);if(planDate===sourceDate){setMainTab('goals');window.scrollTo(0,0);}});links.append(button);
  }
  if(!hasRecord){
    const tasks=datePlans[historyDate]?.tasks||[];
    $('history-summary').textContent=tasks.length?`목표 ${tasks.length}개 · 아직 시간표를 만들지 않았어요.`:'아직 일정이 없어요. 목표와 약속을 추가해보세요.';
    tasks.forEach(task=>list.append(el('p','helper',task.name||'이름 없는 목표')));return;
  }
  const continued=view.sourceDates.some(date=>date!==historyDate);
  $('history-summary').textContent=`완료 ${stats.count}구간 · 집중 ${duration(stats.focus)}${stats.fixed?` · 고정 ${duration(stats.fixed)}`:''}${continued?' · 전날부터 이어진 일정 포함':''}`;
  if(continued)links.prepend(el('p','helper','밤샘 일정의 수정·완료 체크는 시작한 날짜에서 이어서 해요. 이 날짜의 시간만 나누어 표시해요.'));
  if(!historyRecords[historyDate]&&datePlans[historyDate]?.tasks.length){
    list.append(el('p','helper',`이 날짜의 목표 ${datePlans[historyDate].tasks.length}개 · 아직 시간표를 만들지 않았어요.`));
    datePlans[historyDate].tasks.forEach(task=>list.append(el('p','helper',task.name||'이름 없는 목표')));
  }
  if(!stats.count)list.append(el('p','helper','일정이 저장됐어요. 완료한 구간을 체크하면 여기에 기록돼요.'));
  for(const item of view.completed){
    const row=item.row,entry=el('div','history-entry');entry.append(el('strong','',`✓ ${row.name}`),el('span','',`${Scheduler.formatTime(row.start)} ~ ${Scheduler.formatTime(row.end)} · ${row.kind==='fixed'?'고정 · ':''}${duration(row.duration)}${item.sourceDate!==historyDate?' · 전날 시작':''}`));list.append(entry);
  }
  view.rows.forEach(({row,done,sourceDate})=>{const entry=el('div','history-entry history-planned');entry.append(el('strong','',`${done?'✓ ':''}${row.type==='break'?'휴식':row.name}`),el('span','',`${Scheduler.formatTime(row.start)} ~ ${Scheduler.formatTime(row.end)} · ${duration(row.duration)}${sourceDate!==historyDate?' · 전날 시작':''}`));timeline.append(entry);});
}
function changeHistoryMonth(offset){
  const date=new Date(historyMonth+'-01T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+offset);
  if(date.getUTCFullYear()<1900||date.getUTCFullYear()>9999)return;
  historyMonth=date.toISOString().slice(0,7);historyDate=historyMonth+'-01';renderHistory();
}
DayflowMonthPicker.attach($('history-month'),$('history-month-picker'));
$('history-prev').addEventListener('click',()=>changeHistoryMonth(-1));
$('history-next').addEventListener('click',()=>changeHistoryMonth(1));
$('history-month').addEventListener('change',()=>{const value=$('history-month').value;if(DayflowHistory.validDate(value+'-01')){historyMonth=value;historyDate=value+'-01';renderHistory();}});
$('history-today').addEventListener('click',()=>{historyDate=DayflowHistory.dateKey();historyMonth=historyDate.slice(0,7);renderHistory();});
renderTasks();update(true);renderPlan();
// Save the restored date before opening today's independent goals and completion.
if(!DayflowHistory.activeOvernight(planDate,state.settings))selectPlanDate(observedToday);
setInterval(syncToday,1000);
window.addEventListener('focus',syncToday);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncToday();});

function saveAlarm(){
  try{localState.setItem('dayflow-alarm-v1',JSON.stringify({alarm:scheduleAlarm.snapshot(),source:alarmSource,sound:alarmSound}));lastAlarmSaved=Date.now();}
  catch{toast('일정 알람 상태를 저장하지 못했어요.');}
}
function prepareAlarmAudio(){
  if(!alarmAudio)alarmAudio=new AudioContext();
  return alarmAudio.resume();
}
function playAlarmSound(){
  if(!alarmSound)return;
  try{
    if(!alarmAudio||alarmAudio.state!=='running')return;
    const start=alarmAudio.currentTime;
    [880,660,880,660,880,660].forEach((frequency,i)=>{
      const oscillator=alarmAudio.createOscillator(),gain=alarmAudio.createGain(),at=start+i*.5;
      oscillator.type='triangle';
      oscillator.frequency.value=frequency;oscillator.connect(gain);gain.connect(alarmAudio.destination);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.65,at+.02);
      gain.gain.setValueAtTime(.65,at+.3);gain.gain.exponentialRampToValueAtTime(.001,at+.42);
      oscillator.start(at);oscillator.stop(at+.44);
    });
  }catch{toast('알림 소리를 재생하지 못했어요.');}
}
function notifyAlarm(ended){
  if(!ended.length)return;
  const next=scheduleAlarm.current,last=ended.at(-1);
  const message=next?`${last.type==='break'?'휴식':last.name} 시간이 끝났어요. 다음: ${next.type==='break'?'휴식':next.name} ${duration(next.duration)}`:'오늘 일정 알람이 모두 끝났어요.';
  playAlarmSound();toast(message);
  window.desktop?.notifyAlarm?.({message}).catch(()=>{});
  saveAlarm();
}
function renderScheduleAlarm(){
  const active=scheduleAlarm.status==='running'||scheduleAlarm.status==='paused',current=scheduleAlarm.current;
  const button=$('alarm-toggle');button.textContent={idle:'일정 알람 시작',running:'일시정지',paused:'계속하기',finished:'다시 시작'}[scheduleAlarm.status];
  button.disabled=!active&&(!plan||builtFrom!==signature());$('alarm-stop').disabled=!active;
  $('alarm-sound').checked=alarmSound;
  const status=active?`${scheduleAlarm.index+1}/${scheduleAlarm.rows.length} · ${current.type==='break'?'휴식':current.name}${scheduleAlarm.status==='paused'?' · 일시정지':''}`:scheduleAlarm.status==='finished'?'모든 구간이 끝났어요.':'목표와 휴식을 순서대로 진행해요.';
  if($('alarm-current').textContent!==status)$('alarm-current').textContent=status;
  const seconds=scheduleAlarm.secondsLeft;
  $('alarm-display').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const next=active?scheduleAlarm.rows[scheduleAlarm.index+1]:null;
  $('alarm-next').textContent=next?`다음 · ${next.type==='break'?'휴식':next.name} ${duration(next.duration)}`:'';
  document.querySelector('.schedule-alarm').dataset.status=scheduleAlarm.status;
  document.querySelector('.schedule-alarm').dataset.kind=current?.type||'';
  for(const [i,row] of [...$('timeline').children].entries())row.classList.toggle('alarm-active',active&&alarmSource===builtFrom&&DayflowHistory.rowKey(plan.rows[i])===DayflowHistory.rowKey(current));
}
$('alarm-toggle').addEventListener('click',()=>{
  if(scheduleAlarm.status==='running'){notifyAlarm(scheduleAlarm.pause());}
  else{
    if(alarmSound)prepareAlarmAudio().catch(()=>toast('알림 소리를 켜지 못했어요. PC 소리 설정을 확인해주세요.'));
    if(scheduleAlarm.status==='paused')scheduleAlarm.resume();
    else{
      if(!plan||builtFrom!==signature())return;
      scheduleAlarm.start(plan.rows);alarmSource=builtFrom;
    }
  }
  saveAlarm();renderScheduleAlarm();
});
$('alarm-stop').addEventListener('click',()=>{scheduleAlarm.stop();saveAlarm();renderScheduleAlarm();});
$('alarm-sound').addEventListener('change',()=>{alarmSound=$('alarm-sound').checked;if(alarmSound)prepareAlarmAudio().catch(()=>{});saveAlarm();});
$('alarm-test-sound').addEventListener('click',()=>{prepareAlarmAudio().then(()=>{const savedSound=alarmSound;alarmSound=true;playAlarmSound();alarmSound=savedSound;}).catch(()=>toast('소리를 재생하지 못했어요.'));});
setInterval(()=>{
  notifyAlarm(scheduleAlarm.tick());renderScheduleAlarm();
  if(scheduleAlarm.status==='running'&&Date.now()-lastAlarmSaved>=5000)saveAlarm();
},250);
window.addEventListener('beforeunload',()=>{save();scheduleAlarm.tick();saveAlarm();});
renderScheduleAlarm();

DayflowPalette.initialize(localState,palette=>{colors.splice(0,colors.length,...palette.colors);renderTasks();renderPlan();renderHistory();renderScheduleAlarm();});
