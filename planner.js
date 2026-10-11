(function(root) {
  const history = typeof module !== 'undefined' && module.exports ? require('./history.js') : root.DayflowHistory;
  function validSnapshot(value) {
    return value && Array.isArray(value.tasks) && value.tasks.length <= 30 &&
      value.tasks.every(task => task && typeof task.id === 'string' && typeof task.name === 'string') &&
      value.settings && typeof value.settings === 'object' && !Array.isArray(value.settings) &&
      (!value.planState || (Array.isArray(value.planState.tasks) && value.planState.settings)) &&
      Array.isArray(value.done);
  }
  function readPlans(raw) {
    if (!raw) return {};
    const plans = JSON.parse(raw);
    if (!plans || typeof plans !== 'object' || Array.isArray(plans) ||
        Object.entries(plans).some(([date, value]) => !history.validDate(date) || !validSnapshot(value))) {
      throw new Error('날짜별 일정 저장 형식이 올바르지 않습니다.');
    }
    return plans;
  }
  function put(plans, date, snapshot) {
    if (!history.validDate(date) || !validSnapshot(snapshot)) throw new Error('올바른 날짜와 일정을 입력해주세요.');
    return { ...plans, [date]: structuredClone(snapshot) };
  }
  function fromRecord(record) {
    if (!record) return null;
    const tasks = (record.plan.allocations || []).map(({minutes, fraction, ...task}) => task);
    for (const row of record.plan.rows.filter(row => row.kind === 'fixed')) {
      if (!tasks.some(task => task.id === row.taskId)) tasks.push({id:row.taskId,name:row.name,type:'fixed',durationMinutes:row.duration,startTime: `${String(Math.floor(row.start % 1440 / 60)).padStart(2,'0')}:${String(row.start % 60).padStart(2,'0')}`});
    }
    const state = { tasks, settings: structuredClone(record.settings) };
    return { ...state, planState: structuredClone(state), done: [...record.done], scheduleVersion: 2 };
  }
  const api = { readPlans, put, fromRecord };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DayflowPlanner = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
