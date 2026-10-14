
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const movies=[...(window.MOVIES||[])];
const subs=window.BUNDLED_SUBTITLES||{};
const LS={
  get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},
  set(k,v){localStorage.setItem(k,JSON.stringify(v))}
};
const state={filter:'all',sort:'curated',section:'home',selected:null,hero:0,search:'',searchIndex:-1};
const heroIds=['mulholland-drive-2001','vertigo-1958','teorema-1968','blue-velvet-1986','andrei-rublev-1966','rear-window-1954'];
const rooms=[
  {title:'A sala Lynch',subtitle:'Sonhos, subúrbios e identidades instáveis',ids:['mulholland-drive-2001','blue-velvet-1986','the-elephant-man-1980']},
  {title:'Obsessão & vertigem',subtitle:'Olhar, desejo, perseguição',ids:['vertigo-1958','rear-window-1954','psycho-drive','blow-out-1981']},
  {title:'O sagrado e o profano',subtitle:'Fé, culpa, transcendência',ids:['andrei-rublev-1966','teorema-1968','au-hasard-balthazar-1966','le-diable-probablement-1977']},
  {title:'Paris, amor e distância',subtitle:'Rohmer, Godard, Truffaut, Antonioni',ids:['breathless-1960','pauline-at-the-beach-1983','love-in-the-afternoon-1972','adele-h-1975']},
  {title:'Noite americana',subtitle:'Noir, mistério e paranoia',ids:['on-dangerous-ground-1951','laura-1944','his-girl-friday-1940','martin-1978']},
  {title:'À margem',subtitle:'Corpos, juventude e ruptura',ids:['christiane-f','bicho-de-sete-cabecas-2001','the-brown-bunny-2003','the-bunny-game-2010']}
];
const byId=id=>movies.find(m=>m.id===id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const favs=()=>LS.get('ic3_favs',[]);
const watched=()=>LS.get('ic3_watched',{});
const ratings=()=>LS.get('ic3_ratings',{});
const notes=()=>LS.get('ic3_notes',{});
const progresses=()=>LS.get('ic3_progress',{});
const isFav=id=>favs().includes(id);
const isWatched=id=>!!watched()[id];
const rating=id=>Number(ratings()[id]||0);
const note=id=>notes()[id]||'';
const progress=id=>progresses()[id]||{time:0,duration:0};
const pct=id=>{const p=progress(id);return p.duration>0?Math.min(100,Math.max(0,p.time/p.duration*100)):0};

function migrateLegacy(){
  if(localStorage.getItem('ic3_migrated'))return;
  const f=[],w={},r={},n={},p={};
  movies.forEach(m=>{
    if(localStorage.getItem('ic_fav_'+m.id)==='1')f.push(m.id);
    if(localStorage.getItem('ic_watched_'+m.id)==='1')w[m.id]=localStorage.getItem('ic_watched_at_'+m.id)||new Date().toISOString();
    const rv=Number(localStorage.getItem('ic_rating_'+m.id)||0);if(rv)r[m.id]=rv;
    const nv=localStorage.getItem('ic_note_'+m.id);if(nv)n[m.id]=nv;
    try{const pv=JSON.parse(localStorage.getItem('ic_progress_'+m.id)||'null');if(pv?.time)p[m.id]=pv}catch{}
  });
  if(f.length&&!LS.get('ic3_favs',[]).length)LS.set('ic3_favs',f);
  if(Object.keys(w).length&&!Object.keys(LS.get('ic3_watched',{})).length)LS.set('ic3_watched',w);
  if(Object.keys(r).length&&!Object.keys(LS.get('ic3_ratings',{})).length)LS.set('ic3_ratings',r);
  if(Object.keys(n).length&&!Object.keys(LS.get('ic3_notes',{})).length)LS.set('ic3_notes',n);
  if(Object.keys(p).length&&!Object.keys(LS.get('ic3_progress',{})).length)LS.set('ic3_progress',p);
  localStorage.setItem('ic3_migrated','1');
}

const setAccent=m=>{if(m?.accent)document.documentElement.style.setProperty('--accent',m.accent)};
const setFav=(id,val)=>{let a=favs().filter(x=>x!==id);if(val)a.push(id);LS.set('ic3_favs',a);return val};
const setWatched=(id,val)=>{const w=watched();if(val)w[id]=new Date().toISOString();else delete w[id];LS.set('ic3_watched',w);renderMiniStats();return val};
const setRating=(id,val)=>{const r=ratings();if(val)r[id]=Number(val);else delete r[id];LS.set('ic3_ratings',r)};
const setNote=(id,val)=>{const n=notes();if(val)n[id]=val;else delete n[id];LS.set('ic3_notes',n)};
const saveProgress=(id,time,duration)=>{const p=progresses();p[id]={time,duration,updatedAt:Date.now()};LS.set('ic3_progress',p)};

function provider(url=''){
  const u=url.toLowerCase();
  let m=url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i); if(m)return {name:'Google Drive',kind:'drive',embed:`https://drive.google.com/file/d/${m[1]}/preview`};
  m=url.match(/ok\.ru\/video\/(\d+)/i); if(m)return {name:'OK.ru',kind:'ok',embed:`https://ok.ru/videoembed/${m[1]}`};
  if(/\.(mp4|webm)(\?|#|$)/i.test(url))return {name:'Vídeo direto',kind:'video',embed:url};
  if(/\.m3u8(\?|#|$)/i.test(url))return {name:'HLS',kind:'hls',embed:url};
  return {name:'Fonte externa',kind:'external',embed:url};
}
function letterboxdUrl(m){return `https://letterboxd.com/search/${encodeURIComponent(`${m.title} ${m.year||''}`)}/`}

function renderHero(index=state.hero){
  const list=heroIds.map(byId).filter(Boolean); if(!list.length)return;
  state.hero=(index+list.length)%list.length; const m=list[state.hero]; setAccent(m);
  $('#heroTitle').textContent=m.title; $('#heroSynopsis').textContent=m.description||'';
  $('#heroMeta').innerHTML=[m.year,m.director,m.genre].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('');
  $('#heroBg').style.backgroundImage=`url("${m.poster}")`; $('#heroPoster').style.backgroundImage=`url("${m.poster}")`;
  $('#heroCaptionDirector').textContent=m.director||''; $('#heroCaptionYear').textContent=m.year||'';
  $('#heroIndex').textContent=`${String(state.hero+1).padStart(2,'0')} / ${String(list.length).padStart(2,'0')}`;
  $('#heroFavorite').classList.toggle('active',isFav(m.id)); $('#heroFavorite').textContent=isFav(m.id)?'♥':'♡';
  $('#heroWatch').onclick=()=>playMovie(m); $('#heroInfo').onclick=()=>openMovie(m.id); $('#heroPoster').onclick=()=>openMovie(m.id);
  $('#heroFavorite').onclick=()=>{setFav(m.id,!isFav(m.id));renderHero(state.hero);renderFilms()};
}
function renderRooms(){
  $('#roomsGrid').innerHTML=rooms.map((r,i)=>{
    const film=byId(r.ids[0]); return `<article class="room" data-room="${i}">
      <div class="room-bg" style="background-image:url('${esc(film?.poster||'')}')"></div><div class="room-count">${r.ids.length}</div>
      <div class="room-copy"><span>SALA ${String(i+1).padStart(2,'0')}</span><h3>${esc(r.title)}</h3><p>${esc(r.subtitle)}</p></div>
    </article>`
  }).join('');
  $$('.room').forEach(el=>el.onclick=()=>openRoom(Number(el.dataset.room)));
}
function openRoom(i){
  const r=rooms[i]; state.filter='room'; state.roomIds=r.ids; $('#collectionTitle').textContent=r.title;
  $$('.filter-button').forEach(b=>b.classList.remove('active')); renderFilms(); document.querySelector('#collection').scrollIntoView({behavior:'smooth'});
}
function currentList(){
  let list=[...movies];
  if(state.section==='favorites')list=list.filter(m=>isFav(m.id));
  if(state.filter==='unwatched')list=list.filter(m=>!isWatched(m.id));
  if(state.filter==='cc')list=list.filter(m=>m.hasCC);
  if(/^\d{4}s$/.test(state.filter))list=list.filter(m=>m.decade===state.filter);
  if(state.filter==='room')list=list.filter(m=>(state.roomIds||[]).includes(m.id));
  const q=norm(state.search);
  if(q)list=list.filter(m=>norm([m.title,m.director,m.genre,m.year,m.description].join(' ')).includes(q));
  if(state.sort==='title')list.sort((a,b)=>a.title.localeCompare(b.title));
  if(state.sort==='year-desc')list.sort((a,b)=>Number(b.year||0)-Number(a.year||0));
  if(state.sort==='year-asc')list.sort((a,b)=>Number(a.year||0)-Number(b.year||0));
  if(state.sort==='rating')list.sort((a,b)=>rating(b.id)-rating(a.id)||a.title.localeCompare(b.title));
  return list;
}
function cardHTML(m){
  const p=pct(m.id),r=rating(m.id);
  return `<article class="film-card" data-id="${esc(m.id)}">
    <div class="poster-shell">
      <div class="poster-image" style="background-image:url('${esc(m.poster)}')"></div><div class="poster-shade"></div>
      <div class="quick-actions">
        <button data-quick="fav" class="${isFav(m.id)?'on':''}" title="Favoritar">${isFav(m.id)?'♥':'♡'}</button>
        <button data-quick="play" title="Assistir">▶</button>
      </div>
      <div class="poster-badges">${m.hasCC?'<span class="cc">CC</span>':''}${isWatched(m.id)?'<span>VISTO</span>':''}</div>
      ${p>0&&p<96?`<div class="card-progress"><i style="width:${p}%"></i></div>`:''}
    </div>
    <div class="film-info"><h3>${esc(m.title)}</h3><p><span>${esc(m.director||m.genre||'Cinema')}</span><span>${r?`<b class="rating-mini">${'★'.repeat(r)}</b>`:esc(m.year||'')}</span></p></div>
  </article>`;
}
function renderFilms(){
  const list=currentList(); $('#filmGrid').innerHTML=list.map(cardHTML).join('');
  $('#collectionCount').textContent=`${list.length} ${list.length===1?'título':'títulos'}`; $('#emptyState').classList.toggle('hidden',!!list.length);
  $$('.film-card').forEach(c=>{
    c.onclick=e=>{const m=byId(c.dataset.id);const q=e.target.closest('[data-quick]');if(q){e.stopPropagation();if(q.dataset.quick==='fav'){setFav(m.id,!isFav(m.id));renderFilms()}else playMovie(m);return}openMovie(m.id)};
  });
}
function renderContinue(){
  const ps=progresses(); const ids=Object.keys(ps).filter(id=>byId(id)&&ps[id].time>20&&ps[id].duration>0&&pct(id)<96).sort((a,b)=>(ps[b].updatedAt||0)-(ps[a].updatedAt||0)).slice(0,8);
  $('#continueSection').classList.toggle('hidden',!ids.length);
  $('#continueRail').innerHTML=ids.map(id=>{const m=byId(id);return `<article class="continue-card" data-id="${id}">
    <div class="bg" style="background-image:url('${esc(m.poster)}')"></div><div class="mini" style="background-image:url('${esc(m.poster)}')"></div>
    <div class="continue-copy"><h3>${esc(m.title)}</h3><p>${Math.round(pct(id))}% assistido · ${esc(m.year||'')}</p><div class="continue-bar"><i style="width:${pct(id)}%"></i></div></div>
  </article>`}).join('');
  $$('.continue-card').forEach(c=>c.onclick=()=>playMovie(byId(c.dataset.id)));
}
function related(m){
  const sameDirector=movies.filter(x=>x.id!==m.id&&x.director&&x.director===m.director);
  const decade=movies.filter(x=>x.id!==m.id&&x.decade===m.decade&&!sameDirector.includes(x));
  return [...sameDirector,...decade].slice(0,6);
}
function openMovie(id,hash=true){
  const m=byId(id); if(!m)return; state.selected=m; setAccent(m);
  $('#detailPoster').style.backgroundImage=`url("${m.poster}")`; $('#dossierBg').style.backgroundImage=`url("${m.poster}")`;
  $('#detailTitle').textContent=m.title; $('#detailDirector').textContent=m.director?`Direção de ${m.director}`:'';
  $('#detailSynopsis').textContent=m.description||'Sem sinopse cadastrada.';
  const p=provider(m.url); $('#detailTags').innerHTML=[m.year,m.genre,p.name,m.hasCC?'CC disponível':null].filter(Boolean).map((x,i)=>`<span class="${i===0?'accent':''}">${esc(x)}</span>`).join('');
  $('#detailFavorite').classList.toggle('on',isFav(m.id)); $('#detailFavorite').textContent=isFav(m.id)?'♥ Favoritado':'♡ Favoritar';
  $('#detailWatched').classList.toggle('on',isWatched(m.id)); $('#detailWatched').textContent=isWatched(m.id)?'✓ Visto':'✓ Marcar visto';
  $('#sourceStatus').textContent=m.bundledSubtitle?'Legenda PT-BR incorporada.':(m.alternateSources?.length?'Há uma opção externa legendada.':'Legenda externa não cadastrada.');
  $('#subtitleBtn').classList.toggle('hidden',!m.bundledSubtitle); $('#sourceLink').href=m.url||'#';
  $('#alternateSources').innerHTML=(m.alternateSources||[]).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>`).join('');
  $('#movieNote').value=note(m.id); updateStars();
  $('#relatedRow').innerHTML=related(m).map(x=>`<article class="related-card" data-id="${x.id}"><div style="background-image:url('${esc(x.poster)}')"></div><span>${esc(x.title)}</span></article>`).join('');
  $$('.related-card').forEach(x=>x.onclick=()=>openMovie(x.dataset.id));
  if(hash)history.replaceState(null,'',`#movie=${encodeURIComponent(m.id)}`);
  const d=$('#movieDialog'); if(!d.open)d.showModal();
}
function updateStars(){
  if(!state.selected)return;const n=rating(state.selected.id);$$('#stars button').forEach(b=>b.classList.toggle('on',Number(b.dataset.rate)<=n));
}
function closeDialog(id){
  const d=document.getElementById(id);if(d?.open)d.close();
  if(id==='playerDialog')cleanupPlayer();
  if(id==='movieDialog'&&location.hash.startsWith('#movie='))history.replaceState(null,'',location.pathname+location.search);
}
function cleanupPlayer(){
  const v=$('#playerStage video'); if(v){try{v.pause()}catch{}}
  $('#playerStage').innerHTML='';
}
function playMovie(m=state.selected){
  if(!m)return;state.selected=m;setAccent(m);const p=provider(m.url);
  $('#playerTitle').textContent=m.title;$('#playerMeta').textContent=[m.year,m.director,p.name].filter(Boolean).join(' · ');
  $('#playerCC').classList.toggle('hidden',!m.bundledSubtitle);$('#playerExternal').onclick=()=>window.open(m.url,'_blank','noopener');
  const stage=$('#playerStage');stage.innerHTML='';
  if(p.kind==='drive'||p.kind==='ok'){
    stage.innerHTML=`<iframe src="${esc(p.embed)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
    $('#playerHint').textContent=`Reprodução via ${p.name}`;
  }else if(p.kind==='video'){
    const v=document.createElement('video');v.controls=true;v.autoplay=true;v.playsInline=true;v.src=p.embed;
    if(m.bundledSubtitle&&subs[m.bundledSubtitle]){const blob=new Blob([subs[m.bundledSubtitle]],{type:'text/vtt'});const track=document.createElement('track');track.kind='subtitles';track.label='Português';track.srclang='pt';track.src=URL.createObjectURL(blob);track.default=true;v.append(track)}
    const pr=progress(m.id);v.addEventListener('loadedmetadata',()=>{if(pr.time&&pr.time<v.duration-30)v.currentTime=pr.time});let t;
    v.addEventListener('timeupdate',()=>{clearTimeout(t);t=setTimeout(()=>saveProgress(m.id,v.currentTime,v.duration),600)});
    stage.append(v);$('#playerHint').textContent='Player INCONNU · progresso salvo';
  }else if(p.kind==='hls'){
    const v=document.createElement('video');v.controls=true;v.autoplay=true;v.playsInline=true;if(v.canPlayType('application/vnd.apple.mpegurl'))v.src=p.embed;else{stage.innerHTML=`<div style="color:#777;text-align:center"><p>Este navegador não reproduz HLS nativamente.</p><a href="${esc(m.url)}" target="_blank">Abrir fonte ↗</a></div>`}
    if(!stage.children.length)stage.append(v);$('#playerHint').textContent='HLS';
  }else{window.open(m.url,'_blank','noopener');return}
  const d=$('#playerDialog');if(!d.open)d.showModal();
}
function downloadSubtitle(m=state.selected){
  if(!m?.bundledSubtitle||!subs[m.bundledSubtitle])return;const blob=new Blob([subs[m.bundledSubtitle]],{type:'text/vtt'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`${m.title}.pt-BR.vtt`;a.click();setTimeout(()=>URL.revokeObjectURL(u),700)
}
function openRave(m=state.selected){if(!m)return;state.selected=m;$('#raveTitle').textContent=`${m.title} no Rave`;$('#raveSource').value=m.url||'';const d=$('#raveDialog');if(!d.open)d.showModal()}
async function copyText(s,msg='Copiado'){
  try{await navigator.clipboard.writeText(s);toast(msg)}catch{const t=document.createElement('textarea');t.value=s;document.body.append(t);t.select();document.execCommand('copy');t.remove();toast(msg)}
}
function filmUrl(m){return `${location.origin}${location.pathname}#movie=${encodeURIComponent(m.id)}`}
async function shareFilm(m=state.selected){
  const data={title:`${m.title} (${m.year||''})`,text:`${m.title}${m.year?` (${m.year})`:''} · INCONNU CINEMA`,url:filmUrl(m)};
  if(navigator.share){try{await navigator.share(data);return}catch(e){if(e?.name==='AbortError')return}}copyText(data.url,'Link copiado');
}

function searchOpen(){
  const d=$('#searchDialog');if(!d.open)d.showModal();$('#globalSearch').value='';state.search='';state.searchIndex=-1;renderSearch();setTimeout(()=>$('#globalSearch').focus(),40)
}
function searchClose(){closeDialog('searchDialog');state.search=''}
function searchList(){
  const q=norm(state.search);if(!q)return movies.slice(0,10);
  return movies.map(m=>{
    const title=norm(m.title),director=norm(m.director),genre=norm(m.genre),year=norm(m.year);
    let score=0;if(title===q)score+=100;if(title.startsWith(q))score+=55;if(title.includes(q))score+=35;if(director.includes(q))score+=22;if(genre.includes(q))score+=12;if(year.includes(q))score+=10;
    return {m,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.m).slice(0,14)
}
function renderSearch(){
  const list=searchList();$('#searchHint').textContent=state.search?`${list.length} resultado${list.length===1?'':'s'} para “${state.search}”`:'Sugestões da sua coleção';
  $('#searchResults').innerHTML=list.map((m,i)=>`<article class="search-item ${i===state.searchIndex?'active':''}" data-id="${m.id}" data-i="${i}">
    <div class="search-thumb" style="background-image:url('${esc(m.poster)}')"></div><div><h4>${esc(m.title)}</h4><p>${esc([m.year,m.director].filter(Boolean).join(' · '))}</p></div><span>${m.hasCC?'CC':''}</span>
  </article>`).join('');
  $$('.search-item').forEach(x=>x.onclick=()=>{searchClose();openMovie(x.dataset.id)})
}

function renderJournal(){
  const w=watched(),rs=ratings(),fs=favs();const vals=Object.values(rs).map(Number).filter(Boolean),total=movies.length,wc=Object.keys(w).filter(id=>byId(id)).length;
  $('#statTotal').textContent=total;$('#statWatched').textContent=wc;$('#statFavorites').textContent=fs.length;$('#statAverage').textContent=vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'—';
  const percent=total?Math.round(wc/total*100):0;$('#statPercent').textContent=`${percent}%`;$('#statProgress').style.width=`${percent}%`;
  const decades=[...new Set(movies.map(m=>m.decade))].sort();$('#decadeChart').innerHTML=decades.map(d=>{const all=movies.filter(m=>m.decade===d),seen=all.filter(m=>isWatched(m.id)).length,p=all.length?seen/all.length*100:0;return`<div class="decade-row"><span>${d}</span><div><i style="width:${p}%"></i></div><small>${seen}/${all.length}</small></div>`}).join('');
  const recent=Object.entries(w).filter(([id])=>byId(id)).sort((a,b)=>String(b[1]).localeCompare(String(a[1]))).slice(0,5);
  $('#lastWatched').innerHTML=recent.length?recent.map(([id,date])=>{const m=byId(id);return`<div class="last-row"><div style="background-image:url('${esc(m.poster)}')"></div><b>${esc(m.title)}</b><span>${new Date(date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span></div>`}).join(''):'<span style="color:#555;font-size:9px">Nenhum filme marcado ainda.</span>';
}
function openJournal(){renderJournal();const d=$('#journalDialog');if(!d.open)d.showModal()}
function exportJournal(){
  const data={version:3,exportedAt:new Date().toISOString(),favorites:favs(),watched:watched(),ratings:ratings(),notes:notes(),progress:progresses()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`inconnu-caderno-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),800);toast('Caderno exportado')
}
function importJournal(file){
  if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(d.favorites)LS.set('ic3_favs',d.favorites);if(d.watched)LS.set('ic3_watched',d.watched);if(d.ratings)LS.set('ic3_ratings',d.ratings);if(d.notes)LS.set('ic3_notes',d.notes);if(d.progress)LS.set('ic3_progress',d.progress);renderAll();renderJournal();toast('Caderno importado')}catch{toast('Arquivo inválido')}};r.readAsText(file)
}
function randomUnwatched(){
  const pool=movies.filter(m=>!isWatched(m.id));const src=pool.length?pool:movies;const m=src[Math.floor(Math.random()*src.length)];closeDialog('journalDialog');openMovie(m.id)
}
function renderMiniStats(){$('#watchedMini').textContent=Object.keys(watched()).filter(id=>byId(id)).length}
function setSection(section){
  state.section=section;state.filter='all';state.roomIds=[];$('.filter-button.active')?.classList.remove('active');$('[data-filter="all"]')?.classList.add('active');
  $$('.nav-link[data-section],.mobile-nav [data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
  if(section==='favorites')$('#collectionTitle').textContent='Favoritos';else $('#collectionTitle').textContent='A coleção inteira';
  renderFilms();
  if(section==='home')window.scrollTo({top:0,behavior:'smooth'});else $('#collection').scrollIntoView({behavior:'smooth',block:'start'})
}
function renderAll(){renderHero(state.hero);renderRooms();renderFilms();renderContinue();renderMiniStats();$('#footerCount').textContent=movies.length}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2200)}

function bind(){
  window.addEventListener('scroll',()=>$('#siteHeader').classList.toggle('scrolled',scrollY>40),{passive:true});
  $('[data-home]').onclick=()=>setSection('home');$$('[data-section]').forEach(b=>b.onclick=()=>setSection(b.dataset.section));
  $('#searchToggle').onclick=searchOpen;$('#mobileSearch').onclick=searchOpen;$('#randomBtn').onclick=()=>openMovie(movies[Math.floor(Math.random()*movies.length)].id);
  $('#journalBtn').onclick=openJournal;$('#journalNav').onclick=openJournal;$('#mobileJournal').onclick=openJournal;
  $('#heroNext').onclick=()=>renderHero(state.hero+1);
  $('#sortSelect').onchange=e=>{state.sort=e.target.value;renderFilms()};
  $$('.filter-button').forEach(b=>b.onclick=()=>{$$('.filter-button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.filter=b.dataset.filter;state.roomIds=[];$('#collectionTitle').textContent='A coleção inteira';renderFilms()});
  $$('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));
  $('#detailWatch').onclick=()=>playMovie();$('#detailFavorite').onclick=()=>{const m=state.selected,set=setFav(m.id,!isFav(m.id));$('#detailFavorite').classList.toggle('on',set);$('#detailFavorite').textContent=set?'♥ Favoritado':'♡ Favoritar';renderFilms();renderHero(state.hero)};
  $('#detailWatched').onclick=()=>{const m=state.selected,set=setWatched(m.id,!isWatched(m.id));$('#detailWatched').classList.toggle('on',set);$('#detailWatched').textContent=set?'✓ Visto':'✓ Marcar visto';renderFilms()};
  $('#letterboxdBtn').onclick=()=>window.open(letterboxdUrl(state.selected),'_blank','noopener');$('#raveBtn').onclick=()=>openRave();$('#shareBtn').onclick=()=>shareFilm();$('#subtitleBtn').onclick=()=>downloadSubtitle();
  $$('#stars button').forEach(b=>b.onclick=()=>{setRating(state.selected.id,Number(b.dataset.rate));updateStars();renderFilms();toast(`Nota ${b.dataset.rate}/5`)});
  $('#clearRating').onclick=()=>{setRating(state.selected.id,0);updateStars();renderFilms()};
  let nt;$('#movieNote').oninput=e=>{clearTimeout(nt);$('#noteStatus').textContent='salvando…';nt=setTimeout(()=>{setNote(state.selected.id,e.target.value);$('#noteStatus').textContent='salvo neste navegador'},250)};
  $('#playerCC').onclick=()=>downloadSubtitle();$('#playerWatched').onclick=()=>{if(state.selected){setWatched(state.selected.id,true);renderFilms();toast('Marcado como visto')}};
  $('#copyRaveSource').onclick=()=>copyText($('#raveSource').value,'Fonte copiada');$('#openRave').onclick=()=>{copyText($('#raveSource').value,'Fonte copiada');window.open('https://rave.io/','_blank','noopener')};
  $('#exportBtn').onclick=exportJournal;$('#journalExport').onclick=exportJournal;$('#journalImport').onclick=()=>$('#journalFile').click();$('#journalFile').onchange=e=>{importJournal(e.target.files?.[0]);e.target.value=''};$('#randomUnwatched').onclick=randomUnwatched;
  $('#globalSearch').oninput=e=>{state.search=e.target.value;state.searchIndex=-1;renderSearch()};
  $('#globalSearch').onkeydown=e=>{const list=searchList();if(e.key==='ArrowDown'){e.preventDefault();state.searchIndex=Math.min(list.length-1,state.searchIndex+1);renderSearch()}if(e.key==='ArrowUp'){e.preventDefault();state.searchIndex=Math.max(0,state.searchIndex-1);renderSearch()}if(e.key==='Enter'&&list.length){e.preventDefault();const i=state.searchIndex<0?0:state.searchIndex;searchClose();openMovie(list[i].id)}};
  [$('#movieDialog'),$('#journalDialog'),$('#raveDialog')].forEach(d=>d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d.id)}));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if($('#searchDialog').open)searchClose();else $$('dialog[open]').forEach(d=>closeDialog(d.id));return}
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    if(e.key==='/'){e.preventDefault();searchOpen()}if(e.key.toLowerCase()==='r'){e.preventDefault();openMovie(movies[Math.floor(Math.random()*movies.length)].id)}if(e.key.toLowerCase()==='s'){e.preventDefault();openJournal()}
  });
}
function init(){
  migrateLegacy();
  const day=Math.floor(Date.now()/86400000);state.hero=day%heroIds.length;renderAll();bind();
  const id=decodeURIComponent((location.hash.match(/^#movie=(.+)$/)||[])[1]||'');if(id&&byId(id))setTimeout(()=>openMovie(id,false),50);
  window.addEventListener('hashchange',()=>{const x=decodeURIComponent((location.hash.match(/^#movie=(.+)$/)||[])[1]||'');if(x&&byId(x))openMovie(x,false)})
}
init();
