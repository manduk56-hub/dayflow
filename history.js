(function(root){
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
  function dateKey(date=new Date()) {
    const parts=Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function validDate(key){
    if(typeof key!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(key))return false;
    const date=new Date(key+'T00:00:00Z');return !isNaN(date)&&date.toISOString().slice(0,10)===key;
  }
  function monthDays(month){
    if(!/^\d{4}-\d{2}$/.test(month)||!validDate(month+'-01'))throw new Error('올바른 월을 선택해주세요.');
    const first=new Date(month+'-01T00:00:00Z');
    const last=new Date(first);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
    const count=Math.ceil((first.getUTCDay()+last.getUTCDate())/7)*7;
    const start=new Date(first);start.setUTCDate(1-first.getUTCDay());
    return Array.from({length:count},(_,i)=>{const date=new Date(start);date.setUTCDate(start.getUTCDate()+i);return date.toISOString().slice(0,10);});
  }
  function rowKey(row){return JSON.stringify([row.taskId,row.start,row.end,row.kind||'weighted']);}
  function validRow(row){return row&&['task','break','idle'].includes(row.type)&&typeof row.name==='string'&&Number.isInteger(row.start)&&Number.isInteger(row.end)&&row.end>row.start&&row.duration===row.end-row.start&&(row.type!=='task'||typeof row.taskId==='string');}
  function readRecords(raw){
    if(!raw)return {};
    const records=JSON.parse(raw);
    if(!records||typeof records!=='object'||Array.isArray(records))throw new Error('기록 형식 오류');
    for(const [date,record] of Object.entries(records)){
      if(!validDate(date)||!record||record.date!==date||!Array.isArray(record.plan?.rows)||!record.plan.rows.every(validRow)||!Array.isArray(record.completed)||!record.completed.every(item=>validRow(item.row)&&item.row.type==='task'&&item.key===rowKey(item.row))||!Array.isArray(record.done))throw new Error('기록 형식 오류');
    }
    return records;
  }
  function updateRecord(records,date,plan,done,settings,change=null,now=new Date()){
    if(!validDate(date))throw new Error('기록 날짜 오류');
    const completed=new Map((records[date]?.completed||[]).map(item=>[item.key,structuredClone(item)]));
    if(change&&!change.checked)completed.delete(rowKey(change.row));
    for(const index of done){const row=plan.rows[index];if(row?.type==='task'){
      const key=rowKey(row);if(!completed.has(key))completed.set(key,{key,row:structuredClone(row),checkedAt:now.toISOString()});
    }}
    return {...records,[date]:{date,plan:structuredClone(plan),settings:structuredClone(settings),done:[...done],completed:[...completed.values()],updatedAt:now.toISOString()}};
  }
  function summary(record){
    const completed=record?.completed||[];
    return {count:completed.length,focus:completed.filter(i=>i.row.kind!=='fixed').reduce((sum,i)=>sum+i.row.duration,0),fixed:completed.filter(i=>i.row.kind==='fixed').reduce((sum,i)=>sum+i.row.duration,0)};
  }
  const api={dateKey,validDate,monthDays,rowKey,readRecords,updateRecord,summary};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DayflowHistory=api;
})(typeof globalThis!=='undefined'?globalThis:this);
