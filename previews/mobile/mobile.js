// Review-only organization of the existing controls, using the real studio.
(() => {
  document.getElementById('libraryButton').setAttribute('aria-label','作品');
  const settings=document.querySelector('.settings'),title=settings.querySelector('.settings-title');
  const tabs=document.createElement('div');tabs.className='mobile-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','摄影棚控制');
  const groups=[['outfits','穿搭',[document.getElementById('wardrobe')]],['responses','动作',[document.getElementById('responseSection')]],['atmosphere','氛围',[settings.querySelector('[aria-label="摄影场景"]'),settings.querySelector('.studio-light'),document.getElementById('advancedSettings')]]];
  const buttons=[],panels=[];
  function select(index){
    buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});
  }
  for(const [key,label,contents] of groups){
    const i=buttons.length,button=document.createElement('button'),panel=document.createElement('div');
    button.type='button';button.textContent=label;button.id='mobile-tab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls','mobile-panel-'+key);
    panel.id='mobile-panel-'+key;panel.className='mobile-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
    contents.forEach(node=>panel.append(node));buttons.push(button);panels.push(panel);tabs.append(button);
    button.addEventListener('click',()=>select(i));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;select(next);buttons[next].focus();});
  }
  title.after(tabs);settings.append(...panels);select(0);
})();
