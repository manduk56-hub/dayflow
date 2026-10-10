(function(root) {
  function point(minute, radius) {
    const angle=(minute / 1440)*Math.PI*2-Math.PI/2;
    return [220+radius*Math.cos(angle),220+radius*Math.sin(angle)];
  }
  function sectorPath(start,end) {
    const duration=end-start;
    if(!Number.isFinite(start) || !Number.isFinite(end) || duration<=0 || duration>1440)throw new Error('원형 구간의 시간을 확인해주세요.');
    const a=point(start,150),b=point(end,150),c=point(end,96),d=point(start,96),large=duration>720?1:0;
    if(duration===1440){
      const mid=point(start+720,150),innerMid=point(start+720,96);
      return `M ${a} A 150 150 0 0 1 ${mid} A 150 150 0 0 1 ${b} L ${c} A 96 96 0 0 0 ${innerMid} A 96 96 0 0 0 ${d} Z`;
    }
    return `M ${a} A 150 150 0 ${large} 1 ${b} L ${c} A 96 96 0 ${large} 0 ${d} Z`;
  }
  const api={point,sectorPath};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.DayflowCircle=api;
})(typeof globalThis!=='undefined'?globalThis:this);
