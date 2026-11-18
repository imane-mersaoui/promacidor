/* Point d’envoi du formulaire : renseigner l’URL de votre API (POST JSON).
   Laissé vide, le formulaire ouvre la messagerie avec la demande pré-remplie. */
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
/* Défilement auto : bureau uniquement, désactivé si l’utilisateur réduit les animations */
const canAuto=matchMedia('(min-width:761px)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  /* Sans API : la messagerie s’ouvre avec la demande pré-remplie, puis la confirmation s’affiche */
  const names={nom:'Nom complet',fonction:'Fonction',societe:'Société',pays:'Pays',ville:'Ville',categories:'Catégories distribuées',pdv:'Points de vente servis',zones:'Zones couvertes',tel:'Téléphone',email:'E-mail'};
  const body=Object.entries(data).map(([k,v])=>names[k]+' : '+(v||'—')).join('\n');
  window.location.href='mailto:'+CONTACT_EMAIL+'?subject='+encodeURIComponent('Candidature partenaire de distribution — '+data.societe)+'&body='+encodeURIComponent(body);
  reset();showThanks();
});
