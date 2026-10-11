(function(root){
  class ScheduleAlarm {
    constructor(saved=null,now=Date.now){
      this.now=now;this.stop();
      if(saved&&['running','paused'].includes(saved.status)&&Array.isArray(saved.rows)&&saved.rows.length>0&&saved.rows.every(row=>row&&['task','break','idle'].includes(row.type)&&typeof row.name==='string'&&Number.isInteger(row.duration)&&row.duration>0&&row.duration<=1440)&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<saved.rows.length&&Number.isFinite(saved.remainingMs)&&saved.remainingMs>0&&saved.remainingMs<=saved.rows[saved.index].duration*60000){
        this.rows=structuredClone(saved.rows);this.index=saved.index;this.remainingMs=saved.remainingMs;this.status='paused';
      }
    }
    stop(){this.rows=[];this.index=0;this.remainingMs=0;this.deadline=null;this.status='idle';}
    start(rows){
      if(!Array.isArray(rows)||!rows.length||rows.some(r=>!['task','break','idle'].includes(r.type)||typeof r.name!=='string'||!Number.isInteger(r.duration)||r.duration<1||r.duration>1440))throw new Error('유효한 일정을 먼저 만들어주세요.');
      this.rows=structuredClone(rows);this.index=0;this.remainingMs=this.current.duration*60000;this.deadline=this.now()+this.remainingMs;this.status='running';
    }
    get current(){return this.rows[this.index]||null;}
    get secondsLeft(){return Math.ceil(this.remainingMs/1000);}
    tick(){
      const ended=[];if(this.status!=='running')return ended;
      const now=this.now();
      while(now>=this.deadline){
        ended.push(structuredClone(this.current));this.index++;
        if(!this.current){this.status='finished';this.remainingMs=0;this.deadline=null;return ended;}
        this.deadline+=this.current.duration*60000;
      }
      this.remainingMs=this.deadline-now;return ended;
    }
    pause(){const ended=this.tick();if(this.status==='running'){this.status='paused';this.deadline=null;}return ended;}
    resume(){if(this.status==='paused'){this.deadline=this.now()+this.remainingMs;this.status='running';}}
    snapshot(){return {status:this.status,rows:structuredClone(this.rows),index:this.index,remainingMs:this.remainingMs};}
  }
  const api={ScheduleAlarm};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DayflowAlarm=api;
})(typeof globalThis!=='undefined'?globalThis:this);
