/* Point d’envoi du formulaire : renseigner l’URL de votre API (POST JSON).
   Laissé vide, le popup de confirmation s’affiche mais rien n’est envoyé. */
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "office@promasidor-dz.com";

/* Cartes marques */
document.documentElement.classList.add('js');
const deck=document.getElementById('deck');
const cards=[...deck.querySelectorAll('.card')];
cards.forEach((c,i)=>{
  c.style.setProperty('--i',i);
  const bar=document.createElement('span');bar.className='bar';c.appendChild(bar);
});
function activate(c,fromUser){
  cards.forEach(x=>{const on=x===c;x.classList.toggle('active',on);x.querySelector('.hit').setAttribute('aria-expanded',on)});
  if(fromUser){const h=c.querySelector('h3');h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}
}
cards.forEach(c=>c.querySelector('.hit').addEventListener('click',()=>{
  deck.classList.remove('auto'); /* l’utilisateur prend la main : on arrête le défilement */
  activate(c,true);
}));
/* Survol : la carte s’ouvre dès que la souris passe dessus (le clic marche aussi) */
let hoverT,lockUntil=0;
cards.forEach(c=>{
  c.addEventListener('mouseenter',()=>{
    if(c.classList.contains('active')||Date.now()<lockUntil)return; /* pas de nouvelle ouverture pendant l’animation */
    clearTimeout(hoverT);
    hoverT=setTimeout(()=>{deck.classList.remove('auto');activate(c,false);lockUntil=Date.now()+450},100); /* petit délai : évite d’ouvrir les cartes simplement traversées */
  });
  c.addEventListener('mouseleave',()=>clearTimeout(hoverT));
});
/* Défilement auto : bureau uniquement, désactivé si l’utilisateur réduit les animations */
const canAuto=matchMedia('(min-width:1001px)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
deck.addEventListener('animationend',e=>{
  if(e.animationName!=='bar'||!deck.classList.contains('auto'))return;
  const i=cards.findIndex(c=>c.classList.contains('active'));
  activate(cards[(i+1)%cards.length],false);
});
/* Entrée en éventail quand la section arrive à l’écran */
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){
    deck.classList.add('in');
    if(canAuto)setTimeout(()=>deck.classList.add('auto'),900);
    io.disconnect();
  }})},{threshold:.35});
  io.observe(deck);
}else{deck.classList.add('in')}

/* Carte interactive */
const FLAGS={"AO": "assets/flags/ao.svg", "BF": "assets/flags/bf.svg", "BI": "assets/flags/bi.svg", "BJ": "assets/flags/bj.svg", "BW": "assets/flags/bw.svg", "CD": "assets/flags/cd.svg", "CF": "assets/flags/cf.svg", "CG": "assets/flags/cg.svg", "CI": "assets/flags/ci.svg", "CM": "assets/flags/cm.svg", "DJ": "assets/flags/dj.svg", "DZ": "assets/flags/dz.svg", "EG": "assets/flags/eg.svg", "ER": "assets/flags/er.svg", "ET": "assets/flags/et.svg", "GA": "assets/flags/ga.svg", "GH": "assets/flags/gh.svg", "GM": "assets/flags/gm.svg", "GN": "assets/flags/gn.svg", "GQ": "assets/flags/gq.svg", "GW": "assets/flags/gw.svg", "KE": "assets/flags/ke.svg", "KM": "assets/flags/km.svg", "LR": "assets/flags/lr.svg", "LS": "assets/flags/ls.svg", "LY": "assets/flags/ly.svg", "MA": "assets/flags/ma.svg", "MG": "assets/flags/mg.svg", "ML": "assets/flags/ml.svg", "MR": "assets/flags/mr.svg", "MW": "assets/flags/mw.svg", "MZ": "assets/flags/mz.svg", "NA": "assets/flags/na.svg", "NE": "assets/flags/ne.svg", "NG": "assets/flags/ng.svg", "RW": "assets/flags/rw.svg", "SD": "assets/flags/sd.svg", "SL": "assets/flags/sl.svg", "SN": "assets/flags/sn.svg", "SO": "assets/flags/so.svg", "SS": "assets/flags/ss.svg", "ST": "assets/flags/st.svg", "SZ": "assets/flags/sz.svg", "TD": "assets/flags/td.svg", "TG": "assets/flags/tg.svg", "TN": "assets/flags/tn.svg", "TZ": "assets/flags/tz.svg", "UG": "assets/flags/ug.svg", "ZA": "assets/flags/za.svg", "ZM": "assets/flags/zm.svg", "ZW": "assets/flags/zw.svg"};
(function(){
  const map=document.getElementById('map');if(!map)return;
  const pin=document.getElementById('pin'),img=pin.querySelector('img'),tn=pin.querySelector('b'),ts=pin.querySelector('em');
  const paths=[...map.querySelectorAll('.c[data-a2]')];
  const LABEL={p:'Zone de présence',o:'Prochain marché'};
  const home=paths.find(p=>p.dataset.a2==='DZ');
  /* décalage des drapeaux (unités de la carte) pour coller à la maquette */
  const OFF={TN:[6,-8],LY:[10,-38],EG:[0,-36],MR:[-8,-8]};
  const pos=p=>{const o=OFF[p.dataset.a2]||[0,0];return [+p.dataset.cx+o[0],+p.dataset.cy+o[1]]};
  /* drapeaux en verre posés en permanence sur les prochains marchés */
  const glass=paths.filter(p=>p.dataset.s==='o').map((p,i)=>{
    const [x,y]=pos(p);
    const g=document.createElement('span');g.className='gpin';g.dataset.a2=p.dataset.a2;
    g.style.setProperty('--x',((x-100)/800*100)+'%');g.style.setProperty('--y',(y/1080*100)+'%');g.style.setProperty('--k',i);
    g.innerHTML='<span class="flag"><img alt=""></span>';g.querySelector('img').src=FLAGS[p.dataset.a2]||'';
    g.setAttribute('aria-hidden','true');map.appendChild(g);return g;
  });
  let current=null;
  function show(p){
    if(!p||current===p)return;
    if(current)current.classList.remove('is-hover');
    current=p;p.classList.add('is-hover');
    p.parentNode.appendChild(p); /* passe devant ses voisins */
    const [cx,cy]=pos(p);
    glass.forEach(g=>g.classList.toggle('hide',g.dataset.a2===p.dataset.a2));
    pin.style.setProperty('--x',((cx-100)/800*100)+'%');
    pin.style.setProperty('--y',(cy/1080*100)+'%');
    const below=cy<300; /* nord : l’étiquette passe sous le drapeau pour ne pas masquer les drapeaux voisins */
    pin.classList.toggle('below',below);
    pin.classList.toggle('left',!below&&cx>(map.clientWidth<480?470:620));
    pin.dataset.s=p.dataset.s||'';
    img.src=FLAGS[p.dataset.a2]||'';
    tn.textContent=p.dataset.name;
    ts.textContent=LABEL[p.dataset.s]||'';ts.hidden=!LABEL[p.dataset.s];
    pin.classList.remove('pop');void pin.offsetWidth;pin.classList.add('pop');
  }
  paths.forEach(p=>{
    p.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show(p)});
    p.addEventListener('click',()=>show(p));
    p.addEventListener('focus',()=>show(p));
  });
  map.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')show(home)});
  /* Légende : survol = aperçu, clic = filtre */
  const btns=[...document.querySelectorAll('.legend [data-f]')];
  btns.forEach(b=>{
    const f=b.dataset.f;
    b.addEventListener('pointerenter',()=>{map.dataset.focus=f});
    b.addEventListener('pointerleave',()=>{const on=btns.find(x=>x.classList.contains('on'));if(on)map.dataset.focus=on.dataset.f;else delete map.dataset.focus});
    b.addEventListener('click',()=>{
      const on=!b.classList.contains('on');
      btns.forEach(x=>{x.classList.remove('on');x.setAttribute('aria-pressed','false')});
      if(on){b.classList.add('on');b.setAttribute('aria-pressed','true');map.dataset.focus=f}else delete map.dataset.focus;
    });
  });
  /* Entrée animée quand la carte arrive à l’écran */
  const start=()=>{
    map.classList.add('in');
    const delay=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1500;
    setTimeout(()=>{pin.classList.add('on');show(home)},delay);
    Object.values(FLAGS).forEach(u=>{const i=new Image();i.src=u}); /* précharge les drapeaux */
  };
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){start();io.disconnect()}},{threshold:.3});
    io.observe(map);
  }else start();
})();

/* Popup de confirmation */
const thanks=document.getElementById('thanks');
function showThanks(){
  if(typeof thanks.showModal==='function')thanks.showModal();else thanks.setAttribute('open','');
}
thanks.querySelector('.x').addEventListener('click',()=>thanks.close());
thanks.addEventListener('click',e=>{ /* clic en dehors de la carte = fermer */
  const r=thanks.querySelector('.thanks-card').getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)thanks.close();
});

/* Formulaire */
const form=document.getElementById('lead'),status=document.getElementById('status');
const labels={nom:'votre nom',societe:'le nom de la société',pays:'le pays',tel:'un numéro de téléphone',email:'une adresse e-mail'};
function check(inp){
  const err=inp.parentElement.querySelector('.err');let msg='';
  const v=inp.value.trim();
  if(inp.required&&!v)msg='Indiquez '+(labels[inp.name]||'ce champ')+'.';
  else if(inp.type==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))msg='Adresse e-mail incomplète, ex. : nom@societe.com';
  else if(inp.type==='tel'&&v&&v.replace(/\D/g,'').length<8)msg='Numéro trop court : au moins 8 chiffres.';
  err.textContent=msg;inp.setAttribute('aria-invalid',msg?'true':'false');return !msg;
}
form.querySelectorAll('input').forEach(i=>i.addEventListener('blur',()=>{if(i.value||i.getAttribute('aria-invalid')==='true')check(i)}));
form.addEventListener('submit',async e=>{
  e.preventDefault();
  const inputs=[...form.querySelectorAll('input')];
  const bad=inputs.filter(i=>!check(i));
  if(bad.length){bad[0].focus();status.textContent='Vérifiez les champs signalés.';return}
  const data=Object.fromEntries(new FormData(form));
  const btn=form.querySelector('button');
  const reset=()=>{form.reset();inputs.forEach(i=>{i.removeAttribute('aria-invalid');i.parentElement.querySelector('.err').textContent=''});status.textContent=''};
  if(FORM_ENDPOINT){
    btn.disabled=true;btn.textContent='Envoi…';
    try{
      const r=await fetch(FORM_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      if(!r.ok)throw new Error(r.status);
      reset();showThanks();
    }catch(err){status.textContent='Envoi impossible pour le moment. Réessayez ou écrivez à '+CONTACT_EMAIL+'.'}
    finally{btn.disabled=false;btn.textContent='Envoyer ma demande'}
    return;
  }
  /* Sans API configurée : affichage de la confirmation uniquement (aucun envoi) */
  console.warn('FORM_ENDPOINT vide : la demande n’est envoyée nulle part.',data);
  reset();showThanks();
});
