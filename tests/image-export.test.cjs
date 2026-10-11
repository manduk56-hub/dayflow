const test=require('node:test'),assert=require('node:assert/strict');
const {copyPlanImage}=require('../image-export.cjs');
function setup(failure=false){
  const events={writes:0,destroyed:false};
  const image={isEmpty:()=>false,getSize:()=>({width:1000,height:2400})};
  class BrowserWindow{
    constructor(options){events.options=options;this.webContents={
      setWindowOpenHandler(){},
      async executeJavaScript(code){return code.includes('scrollHeight')?2400:undefined;},
      async capturePage(rect,options){events.rect=rect;events.captureOptions=options;if(failure)throw new Error('capture failed');return image;}
    };}
    async loadURL(url){events.document=decodeURIComponent(url.split(',').slice(1).join(','));}
    setContentSize(width,height){events.size={width,height};}
    destroy(){events.destroyed=true;}
  }
  return {events,dependencies:{BrowserWindow,clipboard:{writeImage(value){assert.equal(value,image);events.writes++;}}}};
}
test('전체 높이로 이미지 복사하고 숨겨진 창을 정리한다',async()=>{
  const {events,dependencies}=setup();
  assert.deepEqual(await copyPlanImage(dependencies,'<section class="plan">일정</section>'),{width:1000,height:2400});
  assert.equal(events.rect.height,2400);assert.equal(events.size.height,2400);assert.equal(events.writes,1);
  assert.equal(events.options.show,false);assert.equal(events.captureOptions.stayHidden,true);assert.equal(events.destroyed,true);
  assert.ok(events.document.includes('data:font/woff2;base64,'));assert.ok(events.document.includes('script-src \'none\''));
});
test('캡처에 실패해도 클립보드를 바꾸지 않고 창을 정리한다',async()=>{
  const {events,dependencies}=setup(true);
  await assert.rejects(()=>copyPlanImage(dependencies,'<section>일정</section>'),/capture failed/);
  assert.equal(events.writes,0);assert.equal(events.destroyed,true);
  await assert.rejects(()=>copyPlanImage(dependencies,null));
});
