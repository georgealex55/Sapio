(()=>{
  const STORAGE_KEY='sapio:compass-visible';
  const button=document.querySelector('#compassToggle');
  const compass=document.querySelector('#compass');
  if(button&&compass){
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
  }

  // Load final Explore tuning after the core snap application has initialized.
  if(!document.querySelector('link[data-sapio-fine-tune]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='fine-tune.css';
    link.dataset.sapioFineTune='true';
    document.head.appendChild(link);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(document.querySelector('script[data-sapio-fine-tune]'))return;
    const script=document.createElement('script');
    script.src='fine-tune.js';
    script.dataset.sapioFineTune='true';
    document.body.appendChild(script);
  },{once:true});
})();