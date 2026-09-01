(()=>{
  const STORAGE_KEY='sapio:compass-visible';
  const button=document.querySelector('#compassToggle');
  const compass=document.querySelector('#compass');
  if(!button||!compass)return;
  const stored=localStorage.getItem(STORAGE_KEY);
  let visible=stored===null?true:stored==='true';
  function render(){
    compass.hidden=!visible;
    button.setAttribute('aria-pressed',visible?'true':'false');
    button.textContent=visible?'COMPASS ON':'COMPASS OFF';
  }
  button.addEventListener('click',()=>{
    visible=!visible;
    localStorage.setItem(STORAGE_KEY,String(visible));
    render();
  });
  render();
})();