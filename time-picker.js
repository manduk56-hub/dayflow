(function(root){
  let popup=null,activeInput=null;
  const pad=value=>String(value).padStart(2,'0');
  function close(restoreFocus=false){
    if(!popup)return;
    const input=activeInput;popup.remove();popup=null;activeInput=null;
    input.setAttribute('aria-expanded','false');
    if(restoreFocus)input.focus();
  }
  function attach(input,trigger,title){
    function open(){
      if(activeInput===input){close();return;}
      close();activeInput=input;
      let [hour,minute]=(input.value||'14:00').split(':').map(Number);
      const dialog=document.createElement('div');popup=dialog;
      dialog.className='time-picker-popup';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label',title);
      input.setAttribute('aria-expanded','true');
      const heading=document.createElement('div');heading.className='time-picker-heading';
      const name=document.createElement('strong');name.textContent=title;
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','시간 선택 닫기');dismiss.onclick=()=>close(true);
      heading.append(name,dismiss);dialog.append(heading);
      const columns=document.createElement('div');columns.className='time-picker-columns';dialog.append(columns);
      const groups=[];
      function refresh(){
        const values=[hour>=12?1:0,hour%12||12,minute];
        groups.forEach((group,index)=>group.buttons.forEach(button=>{
          const selected=Number(button.dataset.value)===values[index];
          button.setAttribute('aria-pressed',String(selected));button.tabIndex=selected?0:-1;
        }));
      }
      const options=[{label:'오전·오후',values:[0,1],text:value=>value?'오후':'오전'},
        {label:'시',values:Array.from({length:12},(_,i)=>i+1),text:pad},
        {label:'분',values:Array.from({length:60},(_,i)=>i),text:pad}];
      options.forEach((option,index)=>{
        const column=document.createElement('div'),label=document.createElement('span'),list=document.createElement('div');
        label.className='time-picker-label';label.textContent=option.label;list.className='time-picker-list';list.setAttribute('role','group');list.setAttribute('aria-label',option.label);
        const buttons=option.values.map(value=>{
          const button=document.createElement('button');button.type='button';button.textContent=option.text(value);button.dataset.value=value;
          button.onclick=()=>{
            if(index===0)hour=hour%12+value*12;
            else if(index===1)hour=value%12+(hour>=12?12:0);
            else minute=value;
            input.value=`${pad(hour)}:${pad(minute)}`;input.dispatchEvent(new Event('input',{bubbles:true}));refresh();
          };
          button.onkeydown=event=>{
            if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
            event.preventDefault();const current=buttons.indexOf(button);
            const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
            buttons[next].click();buttons[next].focus();
          };
          list.append(button);return button;
        });
        groups.push({list,buttons});column.append(label,list);columns.append(column);
      });
      const done=document.createElement('button');done.type='button';done.className='time-picker-done';done.textContent='선택 완료';done.onclick=()=>close(true);dialog.append(done);
      document.body.append(dialog);refresh();
      const rect=input.parentElement.getBoundingClientRect(),width=280;
      dialog.style.width=`${width}px`;
      dialog.style.left=`${Math.max(12,Math.min(rect.left,window.innerWidth-width-12))}px`;
      const height=dialog.getBoundingClientRect().height;
      dialog.style.top=`${Math.max(12,rect.bottom+8+height<=window.innerHeight-12?rect.bottom+8:rect.top-height-8)}px`;
      groups.forEach(group=>{const selected=group.buttons.find(button=>button.getAttribute('aria-pressed')==='true');group.list.scrollTop=selected.offsetTop-group.list.offsetTop-group.list.clientHeight/2+selected.offsetHeight/2;});
      groups[1].buttons.find(button=>button.getAttribute('aria-pressed')==='true').focus({preventScroll:true});
    }
    input.addEventListener('click',open);trigger.addEventListener('click',open);
    input.addEventListener('keydown',event=>{if(['Enter',' ','ArrowDown'].includes(event.key)){event.preventDefault();open();}});
  }
  document.addEventListener('pointerdown',event=>{if(popup&&!popup.contains(event.target)&&event.target!==activeInput&&!activeInput.parentElement.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(popup&&event.key==='Escape'){event.preventDefault();close(true);}});
  document.addEventListener('focusin',event=>{if(popup&&!popup.contains(event.target)&&event.target!==activeInput)close();});
  window.addEventListener('resize',()=>close());
  window.addEventListener('scroll',event=>{if(popup&&!popup.contains(event.target))close();},true);
  root.DayflowTimePicker={attach,close};
})(globalThis);
