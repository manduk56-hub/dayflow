(function(root) {
  function minutes(time) {
    if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) throw new Error('시작·종료 시간을 입력해주세요.');
    const [h,m] = time.split(':').map(Number);
    if (h > 23 || m > 59) throw new Error('올바른 시간을 입력해주세요.');
    return h * 60 + m;
  }
  function formatTime(value) {
    const day = Math.floor(value / 1440), t = value % 1440;
    return `${day ? '다음 날 ' : ''}${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
  }
  function createWeightedSchedule(tasks, settings, options = {}) {
    if (!Array.isArray(tasks) || !tasks.length) throw new Error('할 일을 하나 이상 추가해주세요.');
    if (tasks.some(t => !String(t.name || '').trim() || (t.type==='duration'
      ? !Number.isInteger(t.durationMinutes)||t.durationMinutes<1||t.durationMinutes>1439
      : !Number.isInteger(t.weight)||t.weight<0||t.weight>10))) throw new Error('할 일의 이름, 비중(0~10), 직접 시간(1~1439분)을 확인해주세요.');
    if (new Set(tasks.map(t => t.id)).size !== tasks.length) throw new Error('할 일 ID가 중복되었습니다.');
    const sum = tasks.reduce((a,t) => a+(t.type==='duration'?0:t.weight), 0);
    const directTime=tasks.reduce((a,t)=>a+(t.type==='duration'?t.durationMinutes:0),0);
    if (!sum && !directTime) throw new Error('적어도 하나의 비중을 1 이상으로 설정해주세요.');
    const start = minutes(settings.start);
    let end = minutes(settings.end);
    if (end === start) throw new Error('시작·종료 시간을 다르게 설정해주세요.');
    if (end < start) end += 1440;
    const focus = Number(settings.focus), rest = Number(settings.rest);
    if (!Number.isInteger(focus) || focus < 10 || focus > 120 || !Number.isInteger(rest) || rest < 0 || rest > 60) throw new Error('집중은 10~120분, 휴식은 0~60분으로 설정해주세요.');
    const allocationUnit=Number(settings.allocationUnit??1);
    if(![1,5,10].includes(allocationUnit))throw new Error('비중 배정 단위는 1분, 5분, 10분 중 선택해주세요.');
    // First build time slots. Breaks belong to the available window, including a final break.
    const slots = []; let cursor = start, work = 0, breakTime = 0;
    while (cursor < end && (sum || work<directTime)) {
      const duration = Math.min(focus, end-cursor,sum?Infinity:directTime-work);
      slots.push({ type: 'work', start: cursor, duration }); work += duration; cursor += duration;
      if (rest && cursor < end && (sum || work<directTime)) {
        const duration = Math.min(rest, end-cursor);
        slots.push({ type: 'break', start: cursor, duration }); breakTime += duration; cursor += duration;
      }
    }
    // Largest remainder allocation conserves every minute and resolves ties by task order.
    if(work<directTime)throw new Error('직접 설정한 작업 시간과 휴식을 전체 시간 안에 배치할 수 없어요. 작업 시간을 줄이거나 전체 시간을 늘려주세요.');
    const distributable=work-directTime;
    const units=Math.floor(distributable/allocationUnit);
    const allocations = tasks.map(t => t.type==='duration'
      ? {...t,minutes:t.durationMinutes,fraction:0}
      : ({ ...t, minutes: sum?Math.floor(units*t.weight/sum)*allocationUnit:0, fraction: sum?units*t.weight/sum % 1:0 }));
    const remainder=distributable%allocationUnit;
    const extra=(work-remainder-allocations.reduce((a,t) => a+t.minutes,0))/allocationUnit;
    const ranked = allocations.filter(t => t.type!=='duration' && t.weight > 0).slice().sort((a,b) => b.fraction-a.fraction);
    for (let i=0; i<extra; i++) ranked[i].minutes+=allocationUnit;
    // Preserve every minute; only the last positive-weight task gets the tail.
    const lastWeighted=allocations.findLast(t=>t.type!=='duration'&&t.weight>0);
    if(lastWeighted)lastWeighted.minutes+=remainder;
    // Keep allocations and the break budget, but move nearby breaks to task boundaries.
    // Focus is a target: a full focus interval may vary by at most 20%.
    const tolerance = Math.floor(focus / 5);
    const boundaries = []; let allocated = 0;
    for (const task of allocations) {
      allocated += task.minutes;
      if (task.minutes && allocated < work) boundaries.push(allocated);
    }
    let plannedSlots = slots;
    if (options.alignBreaks === false) {
      // Restore existing saved schedules without moving their completion checkboxes.
      plannedSlots = slots;
    } else if (!rest) {
      plannedSlots = [{ type:'work', start, duration:work }];
    } else {
      plannedSlots = []; let usedWork = 0, scheduledAt = start, nominalWork = 0;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        let duration = slot.duration;
        if (slot.type === 'work') {
          nominalWork += slot.duration;
          let cut = nominalWork;
          // The last work interval ends at the original total, even with a final break.
          if (nominalWork < work) {
            const nearby = boundaries.filter(b => Math.abs(b - nominalWork) <= tolerance
              && b > usedWork && b - usedWork >= focus - tolerance
              && b - usedWork <= focus + tolerance);
            nearby.sort((a,b) => Math.abs(a - nominalWork) - Math.abs(b - nominalWork) || a-b);
            if (nearby.length) cut = nearby[0];
          }
          duration = cut - usedWork;
          usedWork = cut;
        }
        plannedSlots.push({ type:slot.type, start:scheduledAt, duration });
        scheduledAt += duration;
      }
    }
    const remaining = allocations.map(t => t.minutes), rows = []; let taskIndex = 0;
    for (const slot of plannedSlots) {
      if (slot.type === 'break') { rows.push({ type:'break', name:'잠깐 쉬어가기', start:slot.start, end:slot.start+slot.duration, duration:slot.duration }); continue; }
      let at = slot.start, left = slot.duration;
      while (left > 0) {
        while (remaining[taskIndex] === 0) taskIndex++;
        const duration = Math.min(left, remaining[taskIndex]);
        rows.push({ type:'task', ...(allocations[taskIndex].type==='duration'?{kind:'duration'}:{}),taskId:allocations[taskIndex].id, name:allocations[taskIndex].name, color:taskIndex%6, start:at, end:at+duration, duration });
        remaining[taskIndex] -= duration; left -= duration; at += duration;
      }
    }
    const idleTime=end-(rows.at(-1)?.end||start);
    if(idleTime)rows.push({type:'idle',name:'빈 시간',start:end-idleTime,end,duration:idleTime});
    return { start,end,total:end-start,work,breakTime,fixedTime:0,idleTime,allocations:allocations.map(({fraction,...t}) => t),rows };
  }
  function createSchedule(tasks,settings,options={}) {
    if(!Array.isArray(tasks) || !tasks.some(t=>t.type==='fixed'))return createWeightedSchedule(tasks,settings,options);
    if(tasks.some(t=>!String(t.name||'').trim() || (t.type==='fixed'||t.type==='duration'
      ? !Number.isInteger(t.durationMinutes)||t.durationMinutes<1||t.durationMinutes>1439
      : !Number.isInteger(t.weight)||t.weight<0||t.weight>10)))throw new Error('고정 시간은 1~1439분, 비중은 0~10으로 입력해주세요.');
    if(new Set(tasks.map(t=>t.id)).size!==tasks.length)throw new Error('할 일 ID가 중복되었습니다.');
    const start=minutes(settings.start);let end=minutes(settings.end);
    if(end===start)throw new Error('시작·종료 시간을 다르게 설정해주세요.');
    if(end<start)end+=1440;
    const fixed=tasks.filter(t=>t.type==='fixed'),weighted=tasks.filter(t=>t.type!=='fixed');
    const fixedTime=fixed.reduce((sum,t)=>sum+t.durationMinutes,0),available=end-start-fixedTime;
    if(available<0)throw new Error(`고정 시간이 전체 시간보다 ${fixedTime-(end-start)}분 많아요.`);
    // Validate rhythm even when the day contains only fixed activities.
    createWeightedSchedule([{id:'validate',name:'검증',weight:1}],{...settings,start:'00:00',end:'00:01'},options);
    const colorOf=id=>tasks.findIndex(t=>t.id===id)%6;
    const anchors=fixed.filter(t=>t.startTime).map(t=>{
      let at=minutes(t.startTime);if(end>1440 && at<start)at+=1440;
      if(at<start || at+t.durationMinutes>end)throw new Error(`${t.name}의 고정 시각이 전체 시간 밖에 있어요.`);
      return {type:'task',kind:'fixed',taskId:t.id,name:t.name,color:colorOf(t.id),start:at,end:at+t.durationMinutes,duration:t.durationMinutes};
    }).sort((a,b)=>a.start-b.start);
    for(let i=1;i<anchors.length;i++)if(anchors[i].start<anchors[i-1].end)throw new Error(`${anchors[i-1].name}와 ${anchors[i].name}의 시간이 겹쳐요.`);
    const directTime=weighted.reduce((sum,t)=>sum+(t.type==='duration'?t.durationMinutes:0),0);
    const hasWork=weighted.some(t=>t.type==='duration'||t.weight>0);
    function place(queue) {
      const rows=[];let cursor=start,anchorIndex=0,idleTime=0;
      const idleUntil=to=>{if(to>cursor){rows.push({type:'idle',name:'빈 시간',start:cursor,end:to,duration:to-cursor});idleTime+=to-cursor;cursor=to;}};
      const takeAnchor=()=>{const a=anchors[anchorIndex++];rows.push({...a});cursor=a.end;};
      for(const item of queue){
        let left=item.duration;
        while(left>0){
          const next=anchors[anchorIndex];
          if(next && cursor===next.start){takeAnchor();continue;}
          const limit=next?next.start:end,gap=limit-cursor;
          if(item.kind==='fixed' && left>gap){
            if(!next)return null;
            idleUntil(limit);takeAnchor();continue;
          }
          if(gap<=0)return null;
          const duration=Math.min(left,gap);
          rows.push({...item,start:cursor,end:cursor+duration,duration});cursor+=duration;left-=duration;
        }
      }
      while(anchorIndex<anchors.length){idleUntil(anchors[anchorIndex].start);takeAnchor();}
      idleUntil(end);return {rows,idleTime};
    }
    // A duration-only activity stays whole and follows list order. If an anchor
    // leaves a gap too small for it, reserve that gap as idle and reduce work.
    for(let budget=hasWork?available:0;budget>=0;budget--){
      if(directTime && !budget)throw new Error('직접 설정한 작업 시간과 휴식을 전체 시간 안에 배치할 수 없어요.');
      const base=budget?createWeightedSchedule(weighted,{...settings,start:'00:00',end:formatTime(budget)},options):null;
      const grouped=new Map();let previousId=null;
      for(const row of base?.rows||[]){
        if(row.type==='idle')continue;
        if(row.type==='task')previousId=row.taskId;
        if(!grouped.has(previousId))grouped.set(previousId,[]);
        grouped.get(previousId).push({...row,color:row.type==='task'?colorOf(row.taskId):undefined});
      }
      const queue=[];
      for(const task of tasks){
        if(task.type==='fixed'){if(!task.startTime)queue.push({type:'task',kind:'fixed',taskId:task.id,name:task.name,color:colorOf(task.id),duration:task.durationMinutes});}
        else queue.push(...(grouped.get(task.id)||[]));
      }
      const placed=place(queue);if(!placed)continue;
      const allocations=tasks.map(t=>({...t,minutes:t.type==='fixed'?t.durationMinutes:(base?.allocations.find(a=>a.id===t.id)?.minutes||0)}));
      return {start,end,total:end-start,work:base?.work||0,breakTime:base?.breakTime||0,fixedTime,idleTime:placed.idleTime,allocations,rows:placed.rows};
    }
    throw new Error('고정 시간 항목을 연속으로 배치할 공간이 없어요. 시작 시각이나 목록 순서를 바꿔주세요.');
  }
  const api = { createSchedule, formatTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scheduler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
