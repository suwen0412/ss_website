/* The same original sections power both routes; toolkit scripts remain intact. */
(() => {
  const query=new URLSearchParams(location.search);
  if(query.get('embedded')!=='1')return;
  const allowed=['home','research','publications','teaching','news','toolkit','contact'];
  document.documentElement.classList.add('embedded-view');
  function select(id){
    if(!allowed.includes(id))return;
    document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('embedded-section',s.id===id));
    window.scrollTo(0,0);
    if(window.parent!==window)window.parent.postMessage({type:'garden-section',section:id},location.origin);
  }
  select(allowed.includes(query.get('section'))?query.get('section'):'home');
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link)return;
    const dest=new URL(link.href,location.href);
    if(dest.origin!==location.origin)return;
    if(dest.pathname.endsWith('/game.html')){
      event.preventDefault();
      window.parent.postMessage({type:'garden-landmark',landmark:dest.searchParams.get('landmark')||'home'},location.origin);
    }else if(dest.pathname===location.pathname&&allowed.includes(dest.hash.slice(1))){
      event.preventDefault();
      if(query.get('adventure')==='3d')window.parent.postMessage({type:'garden-open-request',section:dest.hash.slice(1)},location.origin);
      else select(dest.hash.slice(1));
    }
  });
  window.addEventListener('load',()=>window.scrollTo(0,0),{once:true});
})();
