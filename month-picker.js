(function(root){
  let popup=null,activeTrigger=null;
  function close(restoreFocus=false){
    if(!popup)return;
    const trigger=activeTrigger;popup.remove();popup=null;activeTrigger=null;
    trigger.setAttribute('aria-expanded','false');if(restoreFocus)trigger.focus();
  }
  function display(input,label){const [year,month]=input.value.split('-');label.textContent=`${year}년 ${Number(month)}월`;}
  function attach(input,trigger){
    trigger.addEventListener('click',()=>{
      if(activeTrigger===trigger){close();return;}
      close();root.DayflowTimePicker.close();activeTrigger=trigger;
      const [selectedYear,selectedMonth]=input.value.split('-').map(Number);let year=selectedYear;
      const dialog=document.createElement('div');popup=dialog;dialog.className='time-picker-popup month-picker-popup';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','조회 연도와 월 선택');
      trigger.setAttribute('aria-expanded','true');
      const heading=document.createElement('div');heading.className='time-picker-heading';
      const title=document.createElement('strong');title.textContent='월 선택';
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','월 선택 닫기');dismiss.onclick=()=>close(true);heading.append(title,dismiss);dialog.append(heading);
      const navigation=document.createElement('div');navigation.className='month-picker-year';
      const previous=document.createElement('button'),next=document.createElement('button'),yearLabel=document.createElement('strong');
      for(const [button,label,text]of [[previous,'이전 연도','‹'],[next,'다음 연도','›']]){button.type='button';button.setAttribute('aria-label',label);button.textContent=text;}
      yearLabel.setAttribute('aria-live','polite');navigation.append(previous,yearLabel,next);dialog.append(navigation);
      const grid=document.createElement('div');grid.className='month-picker-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label','월');dialog.append(grid);
      const buttons=Array.from({length:12},(_,index)=>{
        const month=index+1,button=document.createElement('button');button.type='button';button.textContent=`${month}월`;button.dataset.month=month;
        button.onclick=()=>{input.value=`${year}-${String(month).padStart(2,'0')}`;input.dispatchEvent(new Event('change',{bubbles:true}));close(true);};
        button.onkeydown=event=>{const shifts={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3};if(event.key in shifts){event.preventDefault();buttons[(index+shifts[event.key]+12)%12].focus();}else if(event.key==='Home'||event.key==='End'){event.preventDefault();buttons[event.key==='Home'?0:11].focus();}};
        grid.append(button);return button;
      });
      function render(){yearLabel.textContent=`${year}년`;previous.disabled=year<=1900;next.disabled=year>=9999;buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(year===selectedYear&&index+1===selectedMonth)));}
      previous.onclick=()=>{year--;render();};next.onclick=()=>{year++;render();};
      document.body.append(dialog);render();
      const rect=trigger.getBoundingClientRect(),width=292,height=dialog.getBoundingClientRect().height;
      dialog.style.width=`${width}px`;dialog.style.left=`${Math.max(12,Math.min(rect.left,window.innerWidth-width-12))}px`;
      dialog.style.top=`${Math.max(12,rect.bottom+8+height<=window.innerHeight-12?rect.bottom+8:rect.top-height-8)}px`;
      buttons[selectedMonth-1].focus({preventScroll:true});
    });
  }
  document.addEventListener('pointerdown',event=>{if(popup&&!popup.contains(event.target)&&!activeTrigger.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(popup&&event.key==='Escape'){event.preventDefault();close(true);}});
  document.addEventListener('focusin',event=>{if(popup&&!popup.contains(event.target)&&!activeTrigger.contains(event.target))close();});
  window.addEventListener('resize',()=>close());window.addEventListener('scroll',event=>{if(popup&&!popup.contains(event.target))close();},true);
  root.DayflowMonthPicker={attach,display,close};
})(globalThis);
