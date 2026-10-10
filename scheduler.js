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
  function createSchedule(tasks, settings, options = {}) {
    if (!Array.isArray(tasks) || !tasks.length) throw new Error('할 일을 하나 이상 추가해주세요.');
    if (tasks.some(t => !String(t.name || '').trim() || !Number.isInteger(t.weight) || t.weight < 0 || t.weight > 10)) throw new Error('할 일의 이름과 비중(0~10)을 확인해주세요.');
    if (new Set(tasks.map(t => t.id)).size !== tasks.length) throw new Error('할 일 ID가 중복되었습니다.');
    const sum = tasks.reduce((a,t) => a+t.weight, 0);
    if (!sum) throw new Error('적어도 하나의 비중을 1 이상으로 설정해주세요.');
    const start = minutes(settings.start);
    let end = minutes(settings.end);
    if (end === start) throw new Error('시작·종료 시간을 다르게 설정해주세요.');
    if (end < start) end += 1440;
    const focus = Number(settings.focus), rest = Number(settings.rest);
    if (!Number.isInteger(focus) || focus < 10 || focus > 120 || !Number.isInteger(rest) || rest < 0 || rest > 60) throw new Error('집중은 10~120분, 휴식은 0~60분으로 설정해주세요.');
    // First build time slots. Breaks belong to the available window, including a final break.
    const slots = []; let cursor = start, work = 0, breakTime = 0;
    while (cursor < end) {
      const duration = Math.min(focus, end-cursor);
      slots.push({ type: 'work', start: cursor, duration }); work += duration; cursor += duration;
      if (rest && cursor < end) {
        const duration = Math.min(rest, end-cursor);
        slots.push({ type: 'break', start: cursor, duration }); breakTime += duration; cursor += duration;
      }
    }
    // Largest remainder allocation conserves every minute and resolves ties by task order.
    const allocations = tasks.map(t => ({ ...t, minutes: Math.floor(work*t.weight/sum), fraction: work*t.weight/sum % 1 }));
    let extra = work-allocations.reduce((a,t) => a+t.minutes,0);
    const ranked = allocations.filter(t => t.weight > 0).slice().sort((a,b) => b.fraction-a.fraction);
    for (let i=0; i<extra; i++) ranked[i].minutes++;
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
        rows.push({ type:'task', taskId:allocations[taskIndex].id, name:allocations[taskIndex].name, color:taskIndex%6, start:at, end:at+duration, duration });
        remaining[taskIndex] -= duration; left -= duration; at += duration;
      }
    }
    return { start,end,total:end-start,work,breakTime,allocations:allocations.map(({fraction,...t}) => t),rows };
  }
  const api = { createSchedule, formatTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scheduler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
