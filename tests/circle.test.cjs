const test=require('node:test');const assert=require('node:assert/strict');
const {point,sectorPath}=require('../circle.js');
test('24시간 시계는 0시 위, 6시 오른쪽, 12시 아래, 18시 왼쪽이다',()=>{
  const expected=[[220,70],[370,220],[220,370],[70,220]];
  for(let i=0;i<4;i++)point(i*360,150).forEach((v,j)=>assert.ok(Math.abs(v-expected[i][j])<1e-8));
});
test('자정을 넘는 구간은 다음 날도 같은 시각 위치로 이어진다',()=>{
  const a=point(1470,150),b=point(30,150);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8));
  const path=sectorPath(1380,1500);assert.ok(path.includes('A 150 150 0 0 1'));assert.ok(!path.includes('NaN'));
  assert.equal((path.match(/A /g)||[]).length,2);
});
test('짧은 구간, 반나절 이상의 구간과 하루 전체를 정확한 호로 표시한다',()=>{
  assert.ok(sectorPath(0,1).includes('A 150 150 0 0 1'));
  assert.ok(sectorPath(0,1000).includes('A 150 150 0 1 1'));
  assert.equal((sectorPath(0,1440).match(/A /g)||[]).length,4);
  for(const [a,b]of [[0,0],[1,0],[0,1441],[NaN,10]])assert.throws(()=>sectorPath(a,b));
});
