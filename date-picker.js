(function(root){
  let popup=null,activeInput=null;
  function close(restoreFocus=false){
    if(!popup)return;
    const input=activeInput;popup.remove();popup=null;activeInput=null;
    input.setAttribute('aria-expanded','false');
    input.parentElement.querySelector('button').setAttribute('aria-expanded','false');
    if(restoreFocus)input.focus();
  }
  const allowed=date=>root.DayflowHistory.validDate(date)&&date>='1900-01-01'&&date<='9999-12-31';
  const key=date=>date.toISOString().slice(0,10);
  function button(text,label){const node=document.createElement('button');node.type='button';node.textContent=text;if(label)node.setAttribute('aria-label',label);return node;}
  function attach(input,trigger){
    function open(){
      if(activeInput===input){close();return;}
      close();root.DayflowTimePicker.close();root.DayflowMonthPicker.close();activeInput=input;
      const selected=allowed(input.value)?input.value:root.DayflowHistory.dateKey();
      let month=selected.slice(0,7),monthsView=false;
      const dialog=document.createElement('div');popup=dialog;dialog.className='time-picker-popup date-picker-popup';
      dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','날짜 선택');
      input.setAttribute('aria-expanded','true');trigger.setAttribute('aria-expanded','true');
      const heading=document.createElement('div');heading.className='time-picker-heading';
      const title=document.createElement('strong');title.textContent='날짜 선택';
      const dismiss=button('×','날짜 선택 닫기');dismiss.onclick=()=>close(true);heading.append(title,dismiss);
      const nav=document.createElement('div');nav.className='month-picker-year date-picker-nav';
      const previous=button('‹','이전 달'),next=button('›','다음 달'),monthTitle=button('');monthTitle.className='date-picker-month';
      nav.append(previous,monthTitle,next);
      const weekdays=document.createElement('div');weekdays.className='history-weekdays';weekdays.setAttribute('aria-hidden','true');
      for(const day of ['일','월','화','수','목','금','토']){const label=document.createElement('span');label.textContent=day;weekdays.append(label);}
      const grid=document.createElement('div');grid.className='history-calendar date-picker-days';grid.setAttribute('role','group');grid.setAttribute('aria-label','날짜');
      const months=document.createElement('div');months.className='month-picker-grid';months.setAttribute('role','group');months.setAttribute('aria-label','월');
      const today=button('오늘 날짜 선택');today.className='time-picker-done';today.onclick=()=>choose(root.DayflowHistory.dateKey());
      dialog.append(heading,nav,weekdays,grid,months,today);
      function choose(date){if(!allowed(date))return;input.value=date;input.dispatchEvent(new Event('change',{bubbles:true}));close(true);}
      function position(){
        const rect=input.getBoundingClientRect(),width=dialog.offsetWidth,height=dialog.offsetHeight;
        dialog.style.left=`${Math.max(12,Math.min(rect.left,window.innerWidth-width-12))}px`;
        dialog.style.top=`${Math.max(12,rect.bottom+8+height<=window.innerHeight-12?rect.bottom+8:rect.top-height-8)}px`;
      }
      function render(focusDate=null){
        const [year,number]=month.split('-').map(Number);
        monthTitle.textContent=monthsView?`${year}년 · 월 선택`:`${year}년 ${number}월 ▾`;
        monthTitle.setAttribute('aria-label',monthsView?'날짜 달력으로 돌아가기':'연도와 월 선택');
        previous.setAttribute('aria-label',monthsView?'이전 연도':'이전 달');next.setAttribute('aria-label',monthsView?'다음 연도':'다음 달');
        previous.disabled=monthsView?year<=1900:month<='1900-01';next.disabled=monthsView?year>=9999:month>='9999-12';
        weekdays.hidden=grid.hidden=monthsView;months.hidden=!monthsView;
        grid.replaceChildren();months.replaceChildren();
        for(const date of root.DayflowHistory.monthDays(month)){
          const day=button(String(Number(date.slice(8))),date);day.className='history-day';day.dataset.date=date;
          day.disabled=!allowed(date);day.classList.toggle('other-month',!date.startsWith(month));day.classList.toggle('is-today',date===root.DayflowHistory.dateKey());
          day.setAttribute('aria-pressed',String(date===selected));if(date===root.DayflowHistory.dateKey())day.setAttribute('aria-current','date');
          day.tabIndex=date===(focusDate||(selected.startsWith(month)?selected:month+'-01'))?0:-1;
          day.onclick=()=>choose(date);
          day.onkeydown=event=>{
            const shifts={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
            if(!(event.key in shifts)&&event.key!=='Home'&&event.key!=='End')return;
            event.preventDefault();const target=new Date(date+'T00:00:00Z');
            target.setUTCDate(target.getUTCDate()+(event.key==='Home'?-target.getUTCDay():event.key==='End'?6-target.getUTCDay():shifts[event.key]));
            const targetDate=key(target);if(!allowed(targetDate))return;month=targetDate.slice(0,7);render(targetDate);
          };
          grid.append(day);
        }
        for(let index=1;index<=12;index++){
          const option=button(`${index}월`);option.setAttribute('aria-pressed',String(index===number));
          option.onclick=()=>{month=`${year}-${String(index).padStart(2,'0')}`;monthsView=false;render(month+'-01');};
          option.onkeydown=event=>{const shifts={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3};if(event.key in shifts){event.preventDefault();months.children[(index-1+shifts[event.key]+12)%12].focus();}};
          months.append(option);
        }
        position();if(focusDate)grid.querySelector(`[data-date="${focusDate}"]`)?.focus({preventScroll:true});
      }
      function move(offset){const date=new Date(month+'-01T00:00:00Z');if(monthsView)date.setUTCFullYear(date.getUTCFullYear()+offset);else date.setUTCMonth(date.getUTCMonth()+offset);if(!allowed(key(date)))return;month=key(date).slice(0,7);render();}
      previous.onclick=()=>move(-1);next.onclick=()=>move(1);
      monthTitle.onclick=()=>{monthsView=!monthsView;render();if(monthsView)months.querySelector('[aria-pressed=true]').focus({preventScroll:true});else grid.querySelector('[tabindex="0"]').focus({preventScroll:true});};
      document.body.append(dialog);render(selected);
    }
    input.addEventListener('click',open);trigger.addEventListener('click',open);
    input.addEventListener('keydown',event=>{if(['Enter',' ','ArrowDown'].includes(event.key)){event.preventDefault();open();}});
  }
  document.addEventListener('pointerdown',event=>{if(popup&&!popup.contains(event.target)&&!activeInput.parentElement.contains(event.target))close();});
  document.addEventListener('focusin',event=>{if(popup&&!popup.contains(event.target)&&!activeInput.parentElement.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(popup&&event.key==='Escape'){event.preventDefault();close(true);}});
  window.addEventListener('resize',()=>close());window.addEventListener('scroll',event=>{if(popup&&!popup.contains(event.target))close();},true);
  root.DayflowDatePicker={attach,close};
})(globalThis);
