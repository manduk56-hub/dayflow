const test=require('node:test');
const assert=require('node:assert/strict');
const {Countdown,Stopwatch}=require('../timer.js');

test('시작, 일시정지, 재개 및 초기화는 남은 시간을 보존한다',()=>{
  let now=1000;const timer=new Countdown(60,null,()=>now);
  timer.start();now+=12500;timer.tick();assert.equal(timer.secondsLeft,48);
  timer.pause();const paused=timer.remainingMs;now+=120000;timer.tick();assert.equal(timer.remainingMs,paused);
  timer.start();now+=7500;timer.tick();assert.equal(timer.secondsLeft,40);
  timer.reset();assert.equal(timer.status,'idle');assert.equal(timer.secondsLeft,60);
});
test('백그라운드 지연 후에도 실제 경과 시간으로 종료하며 완료는 한 번만 발생한다',()=>{
  let now=0;const timer=new Countdown(60,null,()=>now);timer.start();
  now=125000;assert.equal(timer.tick(),true);assert.equal(timer.secondsLeft,0);assert.equal(timer.status,'finished');
  assert.equal(timer.tick(),false);timer.pause();assert.equal(timer.status,'finished');
  timer.start();assert.equal(timer.secondsLeft,60);assert.equal(timer.status,'running');
});
test('재실행 시 실행 중인 마감 시간과 일시정지 상태를 복원한다',()=>{
  let now=0;const timer=new Countdown(60,null,()=>now);timer.start();now=10000;
  const resumed=new Countdown(60,timer.snapshot(),()=>now);assert.equal(resumed.secondsLeft,50);assert.equal(resumed.status,'running');
  resumed.pause();now=30000;
  const paused=new Countdown(60,resumed.snapshot(),()=>now);assert.equal(paused.secondsLeft,50);assert.equal(paused.status,'paused');
  now=61000;const expired=new Countdown(60,timer.snapshot(),()=>now);assert.equal(expired.secondsLeft,0);assert.equal(expired.status,'finished');
});
test('잘못된 시간과 저장 데이터는 타이머를 손상시키지 않는다',()=>{
  for(const invalid of [0,-1,10801,NaN,1.5])assert.throws(()=>new Countdown(invalid));
  const timer=new Countdown(60,{durationSeconds:60,status:'running',remainingMs:60000,deadline:Infinity});
  assert.equal(timer.status,'idle');assert.equal(timer.secondsLeft,60);
});

test('스톱워치는 정지 시간을 제외하고 재개하며 초기화할 수 있다',()=>{
  let now=1000;const watch=new Stopwatch(null,()=>now);
  watch.start();now+=12345;watch.tick();assert.equal(watch.secondsElapsed,12);
  watch.pause();now+=60000;watch.tick();assert.equal(watch.elapsedMs,12345);
  watch.start();now+=8655;watch.tick();assert.equal(watch.secondsElapsed,21);
  watch.reset();assert.equal(watch.secondsElapsed,0);assert.equal(watch.status,'idle');
});
test('스톱워치는 앱 재실행과 백그라운드 지연 후에도 실제 경과 시간을 복원한다',()=>{
  let now=1000;const watch=new Stopwatch(null,()=>now);watch.start();
  now+=3723000;const restored=new Stopwatch(watch.snapshot(),()=>now);
  assert.equal(restored.secondsElapsed,3723);assert.equal(restored.status,'running');
  restored.pause();now+=120000;const paused=new Stopwatch(restored.snapshot(),()=>now);
  assert.equal(paused.secondsElapsed,3723);assert.equal(paused.status,'paused');
});
test('스톱워치의 중복 시작과 잘못된 저장 데이터는 측정값을 바꾸지 않는다',()=>{
  let now=0;const watch=new Stopwatch(null,()=>now);watch.start();now=10000;watch.start();watch.tick();
  assert.equal(watch.secondsElapsed,10);
  const invalid=new Stopwatch({status:'running',accumulatedMs:-1,startedAt:0},()=>now);
  assert.equal(invalid.status,'idle');assert.equal(invalid.secondsElapsed,0);
});
