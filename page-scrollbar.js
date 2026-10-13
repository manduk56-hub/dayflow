'use strict';
(()=>{
  const rail=document.createElement('div'),thumb=document.createElement('div');
  rail.className='page-scrollbar';thumb.className='page-scrollbar-thumb';
  thumb.tabIndex=0;thumb.setAttribute('role','scrollbar');
  thumb.setAttribute('aria-label','페이지 스크롤');thumb.setAttribute('aria-orientation','vertical');
  thumb.setAttribute('aria-controls','dayflow-content');thumb.setAttribute('aria-valuemin','0');
  rail.append(thumb);document.body.append(rail);
  let drag=null,frame=0;
  function metrics(){
    const root=document.scrollingElement,range=Math.max(0,root.scrollHeight-root.clientHeight);
    const height=rail.clientHeight,size=Math.min(height,Math.max(36,height*root.clientHeight/root.scrollHeight));
    return {root,range,size,travel:Math.max(0,height-size)};
  }
  function refresh(){
    frame=0;
    // Measure the rail while visible, including when the previous tab did not scroll.
    rail.hidden=false;
    const {root,range,size,travel}=metrics();
    rail.hidden=range<=0;
    thumb.style.height=size+'px';thumb.style.transform=`translateY(${range?root.scrollTop/range*travel:0}px)`;
    thumb.setAttribute('aria-valuemax',String(range));thumb.setAttribute('aria-valuenow',String(Math.round(root.scrollTop)));
  }
  function queue(){if(!frame)frame=requestAnimationFrame(refresh);}
  thumb.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const {root,range,travel}=metrics();if(!range||!travel)return;
    event.preventDefault();thumb.focus({preventScroll:true});
    drag={id:event.pointerId,y:event.clientY,top:root.scrollTop,range,travel};
    thumb.setPointerCapture(event.pointerId);thumb.classList.add('dragging');
  });
  thumb.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    document.scrollingElement.scrollTop=drag.top+(event.clientY-drag.y)*drag.range/drag.travel;
    queue();
  });
  function stop(){drag=null;thumb.classList.remove('dragging');}
  thumb.addEventListener('pointerup',stop);thumb.addEventListener('pointercancel',stop);thumb.addEventListener('lostpointercapture',stop);
  thumb.addEventListener('keydown',event=>{
    const {root,range}=metrics(),page=root.clientHeight*.9;
    const targets={ArrowDown:root.scrollTop+40,ArrowUp:root.scrollTop-40,PageDown:root.scrollTop+page,PageUp:root.scrollTop-page,Home:0,End:range};
    if(!(event.key in targets))return;
    event.preventDefault();root.scrollTop=targets[event.key];queue();
  });
  window.addEventListener('scroll',queue,{passive:true});window.addEventListener('resize',queue);
  new ResizeObserver(queue).observe(document.body);
  new MutationObserver(queue).observe(document.querySelector('main'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  refresh();
})();
