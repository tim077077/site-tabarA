/* =====================================================================
   Tineret R5 — app shell + views, wired to Supabase (R5API / R5AUTH).
   Cinematic/vintage. Falls back to demo data offline.
   ===================================================================== */
(function () {
  "use strict";
  var view = document.getElementById("view");
  var tabbar = document.getElementById("tabbar");
  var D = window.R5DATA;
  var EVENTS = [];
  var chatUnsub = null;

  // ---- theme toggle ----------------------------------------------- //
  (function themeInit(){
    var btn = document.getElementById("themeToggle"); if (!btn) return;
    function cur(){ return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"; }
    function apply(){ btn.textContent = cur()==="light" ? "☾" : "☀"; var m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", cur()==="light"?"#e7dbc0":"#17110b"); }
    btn.addEventListener("click", function(){ var n = cur()==="light"?"dark":"light"; if(n==="dark") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme","light"); try{localStorage.setItem("r5-theme",n);}catch(e){} apply(); });
    apply();
  })();

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function el(h){ var t=document.createElement("template"); t.innerHTML=h.trim(); return t.content.firstElementChild; }
  function toast(msg){ var t=el('<div style="position:fixed;left:50%;transform:translateX(-50%);bottom:82px;z-index:9995;background:var(--card-2);border:1px solid var(--line-2);color:var(--cream);padding:12px 18px;border-radius:8px;box-shadow:var(--shadow);max-width:90%;font-size:.92rem">'+esc(msg)+'</div>'); document.body.appendChild(t); setTimeout(function(){ t.style.transition="opacity .3s"; t.style.opacity="0"; setTimeout(function(){t.remove();},300); }, 2600); }
  function upcoming(){ return EVENTS.filter(function(e){return !e.past;}).sort(function(a,b){return new Date(a.starts_at||0)-new Date(b.starts_at||0);}); }
  function past(){ return EVENTS.filter(function(e){return e.past;}).sort(function(a,b){return new Date(b.starts_at||0)-new Date(a.starts_at||0);}); }
  function evById(id){ return EVENTS.find(function(e){return e.id===id||e.slug===id;}); }
  function dparts(iso){ var d=new Date(iso||Date.now()); var m=["IAN","FEB","MAR","APR","MAI","IUN","IUL","AUG","SEP","OCT","NOV","DEC"]; return {d:d.getDate(), m:m[d.getMonth()]}; }
  function posterBg(e){ return e.cover_url ? ('background:#140e08 center/cover no-repeat url("'+encodeURI(e.cover_url)+'")') : ('background:'+(e.grad||'linear-gradient(155deg,#3a2c17,#140e08)')); }

  // ---- router ----------------------------------------------------- //
  var state = { route: "home", param: null };
  function parseHash(){
    var h=(location.hash||"").replace(/^#\/?/,""); var parts=h.split("/");
    if(parts[0]==="event"&&parts[1]) return {route:"event",param:decodeURIComponent(parts[1])};
    var known=["home","events","gallery","profile","admin"];
    return {route: known.indexOf(parts[0])>=0?parts[0]:"home", param:null};
  }
  function navigate(route,param){ var h="#"+route+(param?("/"+encodeURIComponent(param)):""); if(location.hash===h){ var s=parseHash(); state.route=s.route; state.param=s.param; window.scrollTo(0,0); render(); } else location.hash=h; }
  window.addEventListener("hashchange", function(){ var s=parseHash(); state.route=s.route; state.param=s.param; window.scrollTo(0,0); render(); });
  tabbar.querySelectorAll("a").forEach(function(a){ a.addEventListener("click", function(){ navigate(a.dataset.route); }); });
  function setTab(){ tabbar.querySelectorAll("a").forEach(function(a){ a.classList.toggle("on", a.dataset.route===state.route || (state.route==="event"&&a.dataset.route==="events")); }); }

  function cleanup(){ if(chatUnsub){ chatUnsub(); chatUnsub=null; } var cb=document.querySelector(".chat-bar"); if(cb) cb.remove(); }
  function render(){
    cleanup(); setTab();
    if(state.route==="home") return renderHome();
    if(state.route==="events") return renderEvents();
    if(state.route==="event") return renderEvent(state.param);
    if(state.route==="gallery") return renderGallery();
    if(state.route==="profile") return renderProfile();
    if(state.route==="admin") return renderAdmin();
  }

  // ---- posters / rows --------------------------------------------- //
  function posterCard(e){
    var card=el('<div class="poster'+(e.past?" past":"")+'"><div class="bg" style="'+posterBg(e)+'"></div><div class="grain-s"></div>'+
      '<span class="corner tl"></span><span class="corner tr"></span>'+
      (e.tag?'<span class="tag">'+esc(e.tag)+'</span>':(e.past?'<span class="tag">Arhivă</span>':''))+
      '<div class="content"><div class="kicker">'+esc(e.kicker||"")+'</div><h3>'+esc(e.title)+'</h3>'+
      '<div class="meta"><span>📅 '+esc(e.dateLabel||"")+'</span></div><div class="meta"><span>📍 '+esc(e.location||"")+'</span></div></div></div>');
    card.addEventListener("click", function(){ navigate("event", e.slug||e.id); });
    return card;
  }
  function eventRow(e){ var dp=dparts(e.starts_at); var row=el('<div class="evrow"><div class="date"><div class="d">'+dp.d+'</div><div class="m">'+dp.m+'</div></div><div class="grow"><h3>'+esc(e.title)+'</h3><div class="sub">'+esc(e.location||"")+'</div></div><div class="chev">›</div></div>'); row.addEventListener("click", function(){ navigate("event", e.slug||e.id); }); return row; }

  // ---- HOME ------------------------------------------------------- //
  function renderHome(){
    var up=upcoming(), featured=up[0];
    view.innerHTML='<div class="letterbox"></div><section class="hero">'+
      '<div class="eyebrow center" style="justify-content:center">Regiunea 5 · Arad</div>'+
      '<div class="crest"><div class="ring"></div><div class="ring inner"></div><div class="mono"><b>R</b>5</div></div>'+
      '<h1>Tineret <span>R5</span></h1><div class="tagline">chemați la mai mult</div>'+
      '<div class="fives">'+D.identity.fives.map(function(f){return '<span><b>'+f[1]+'</b> '+esc(f[0])+'</span>';}).join("")+'</div></section>';
    if(featured){ view.insertAdjacentHTML("beforeend",'<div class="section-h"><div><div class="eyebrow">Urmează</div><h2>Nu rata</h2></div></div>'); var w=el('<div class="stack"></div>'); w.appendChild(posterCard(featured)); view.appendChild(w); }
    view.insertAdjacentHTML("beforeend",'<div class="section-h"><div><div class="eyebrow">Program</div><h2>Evenimente</h2></div><span class="more" data-go="events">Toate ›</span></div>');
    var list=el('<div></div>'); up.slice(1).forEach(function(e){ list.appendChild(eventRow(e)); });
    if(up.length<=1) list.innerHTML='<div class="empty"><div class="ic">✦</div><p>Curând mai multe evenimente</p></div>';
    view.appendChild(list);
    view.insertAdjacentHTML("beforeend",'<div class="divider-orn">✦ ✦ ✦</div>');
    view.insertAdjacentHTML("beforeend",'<div class="section-h"><div><div class="eyebrow">Amintiri</div><h2>Din galerie</h2></div><span class="more" data-go="gallery">Vezi tot ›</span></div>');
    var strip=el('<div class="gallery" id="home-gallery"></div>'); view.appendChild(strip);
    R5API.getPhotos(null); // warm
    homeGallery(strip);
    view.insertAdjacentHTML("beforeend",'<div class="center" style="padding:40px 24px 24px;color:var(--dim)"><div class="eyebrow center" style="justify-content:center;margin-bottom:10px">Rămâi conectat</div><p class="muted" style="font-size:.9rem">@tineret_r5 · Regiunea 5 Arad</p></div>');
    bindGo();
  }
  function homeGallery(strip){
    var pv=past(); if(!pv.length){ placeholderTiles(strip,9); return; }
    Promise.all(pv.slice(0,3).map(function(e){ return R5API.getPhotos(e.id); })).then(function(arrs){
      var urls=[]; arrs.forEach(function(a){ a.forEach(function(p){ urls.push(p.url); }); });
      if(!urls.length){ placeholderTiles(strip,9); return; }
      strip.innerHTML=""; urls.slice(0,9).forEach(function(u){ strip.appendChild(photoTile(u)); });
    }).catch(function(){ placeholderTiles(strip,9); });
  }

  // ---- EVENTS ----------------------------------------------------- //
  function renderEvents(){
    view.innerHTML='<div class="letterbox"></div><div class="section-h" style="margin-top:26px"><div><div class="eyebrow">Program</div><h2>Evenimente</h2></div></div>';
    var up=upcoming(), pv=past();
    var w=el('<div class="stack"></div>'); up.forEach(function(e){ w.appendChild(posterCard(e)); });
    if(!up.length) w.innerHTML='<div class="empty"><div class="ic">✦</div><p>Niciun eveniment programat</p></div>';
    view.appendChild(w);
    if(pv.length){ view.insertAdjacentHTML("beforeend",'<div class="section-h" style="margin-top:34px"><div><div class="eyebrow">Arhivă</div><h2>Au fost</h2></div></div>'); var w2=el('<div class="stack"></div>'); pv.forEach(function(e){ w2.appendChild(posterCard(e)); }); view.appendChild(w2); }
  }

  // ---- EVENT DETAIL ----------------------------------------------- //
  function renderEvent(id){
    var e=evById(id); if(!e){ navigate("events"); return; }
    view.innerHTML='<div class="back-fab" id="back">‹</div>'+
      '<section class="detail-hero"><div class="bg" style="'+posterBg(e)+'"></div><div class="grain-s" style="position:absolute;inset:0;z-index:1;opacity:.07"></div>'+
      '<div class="content"><div class="kicker" style="font-family:var(--poster);letter-spacing:.2em;color:#e6c877;text-transform:uppercase;font-size:.82rem">'+esc(e.kicker||"")+'</div><h1>'+esc(e.title)+'</h1><div class="muted" style="margin-top:6px">'+esc(e.dateLabel||"")+'</div></div></section>'+
      '<div class="segs" id="segs"><button data-s="info" class="on">Info</button><button data-s="chat">Chat</button><button data-s="poze">Poze</button></div><div id="seg-body"></div>';
    document.getElementById("back").addEventListener("click", function(){ navigate("events"); });
    var segs=document.getElementById("segs");
    segs.querySelectorAll("button").forEach(function(b){ b.addEventListener("click", function(){ segs.querySelectorAll("button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); seg(e,b.dataset.s); }); });
    seg(e,"info");
  }
  function seg(e, which){
    cleanup(); var box=document.getElementById("seg-body"); if(!box) return;
    if(which==="info"){
      box.innerHTML='<div class="info-list"><div class="row"><div class="ic">📅</div><div><div class="k">Data</div><div class="v">'+esc(e.dateLabel||"—")+'</div></div></div>'+
        '<div class="row"><div class="ic">📍</div><div><div class="k">Locație</div><div class="v">'+esc(e.location||"—")+'</div></div></div></div>'+
        '<div class="prose">'+(e.about||"").split("\n").filter(Boolean).map(function(p){return '<p>'+esc(p)+'</p>';}).join("")+'</div>';
    } else if(which==="chat"){ segChat(e, box); }
    else { segPhotos(e, box); }
  }

  // ---- CHAT (live) ------------------------------------------------ //
  function segChat(e, box){
    box.innerHTML='<div class="chat" id="chat"><div class="center muted" style="padding:20px;font-size:.85rem">Se încarcă…</div></div>';
    var chat=document.getElementById("chat");
    R5API.getMessages(e.id).then(function(msgs){
      chat.innerHTML=""; var me=R5AUTH.user();
      if(!msgs.length) chat.innerHTML='<div class="center muted" style="padding:24px;font-size:.9rem">Niciun mesaj încă. Fii primul care întreabă ceva 🙂</div>';
      msgs.forEach(function(m){ chat.appendChild(msgEl(m, me)); });
      chat.scrollIntoView(false);
      chatUnsub=R5API.subscribeMessages(e.id, function(m){ var mine=R5AUTH.user(); chat.appendChild(msgEl(m, mine)); window.scrollTo(0,document.body.scrollHeight); });
    });
    var me=R5AUTH.user();
    var bar=el('<div class="chat-bar"><div class="inner"><input id="chat-in" '+(me?'placeholder="Scrie un mesaj…"':'placeholder="Autentifică-te ca să scrii…" disabled')+' /><button id="chat-send" '+(me?'':'disabled')+'>➤</button></div></div>');
    document.body.appendChild(bar);
    if(!me){ chat.insertAdjacentHTML("beforeend",'<div class="center" style="padding:14px"><button class="btn btn-gold btn-sm" id="chat-login">Conectează-te ca să scrii</button></div>'); var cl=document.getElementById("chat-login"); cl&&cl.addEventListener("click", function(){ navigate("profile"); }); return; }
    var input=document.getElementById("chat-in"), send=document.getElementById("chat-send");
    function submit(){ var v=(input.value||"").trim(); if(!v) return; input.value=""; R5API.sendMessage(e.id, v).then(function(r){ if(!r.ok) toast("Nu s-a trimis. Încearcă din nou."); }); }
    send.addEventListener("click", submit);
    input.addEventListener("keydown", function(ev){ if(ev.key==="Enter") submit(); });
  }
  function msgEl(m, me){
    var mine = me && m.user_id===me.id;
    var t=new Date(m.created_at||Date.now()); var hh=("0"+t.getHours()).slice(-2)+":"+("0"+t.getMinutes()).slice(-2);
    return el('<div class="msg'+(mine?" me":"")+'"><div class="who">'+esc(m.author_name||"Anonim")+'</div><div class="bubble">'+esc(m.body)+'</div><div class="time">'+hh+'</div></div>');
  }

  // ---- PHOTOS ----------------------------------------------------- //
  function photoTile(url){ return el('<div class="tile"><div class="g" style="background:#140e08 center/cover no-repeat url(\''+encodeURI(url)+'\')"></div></div>'); }
  function placeholderTiles(box, n){ var grads=["#2a3a2a","#3a2c17","#3a1f1f","#26303a","#2f3a1f","#332742"]; box.innerHTML=""; for(var i=0;i<n;i++){ box.appendChild(el('<div class="tile"><div class="g" style="background:linear-gradient(150deg,'+grads[i%grads.length]+',#140e08)"></div></div>')); } }
  function segPhotos(e, box){
    box.innerHTML='<div class="center muted" style="padding:20px;font-size:.85rem">Se încarcă…</div>';
    R5API.getPhotos(e.id).then(function(ph){
      box.innerHTML="";
      if(R5AUTH.isAdmin()){ var up=el('<div style="padding:12px 20px"><label class="btn btn-outline btn-sm btn-block" style="cursor:pointer">＋ Adaugă poze<input type="file" accept="image/*" multiple hidden id="pf"></label></div>'); box.appendChild(up); up.querySelector("#pf").addEventListener("change", function(ev){ uploadPhotos(e, ev.target.files, function(){ seg(e,"poze"); }); }); }
      if(!ph.length){ box.appendChild(el('<div class="empty"><div class="ic">◈</div><p>Încă nu sunt poze</p></div>')); return; }
      var g=el('<div class="gallery" style="margin-top:8px"></div>'); ph.forEach(function(p){ g.appendChild(photoTile(p.url)); }); box.appendChild(g);
    });
  }
  function uploadPhotos(e, files, done){
    var arr=Array.prototype.slice.call(files); if(!arr.length) return; toast("Se încarcă "+arr.length+" poze…");
    (function next(i){ if(i>=arr.length){ toast("Gata!"); done&&done(); return; } R5API.uploadPhoto(e.id, arr[i]).then(function(){ next(i+1); }).catch(function(){ next(i+1); }); })(0);
  }

  // ---- GALLERY ---------------------------------------------------- //
  function renderGallery(){
    view.innerHTML='<div class="letterbox"></div><div class="section-h" style="margin-top:26px"><div><div class="eyebrow">Amintiri</div><h2>Galerie</h2></div></div><div id="gwrap"></div>';
    var wrap=document.getElementById("gwrap"); var pv=past();
    if(!pv.length){ wrap.innerHTML='<div class="empty"><p style="font-size:1rem">Nicio amintire încă</p></div>'; return; }
    pv.forEach(function(e){
      var head=el('<div style="padding:10px 20px 6px"><span class="chip">'+esc(e.title)+'</span></div>'); wrap.appendChild(head);
      var g=el('<div class="gallery" style="margin-bottom:18px"></div>'); wrap.appendChild(g);
      R5API.getPhotos(e.id).then(function(ph){ if(!ph.length){ g.remove(); head.innerHTML='<div style="padding:0 20px" class="muted"><span class="chip">'+esc(e.title)+' · fără poze</span></div>'; return; } ph.forEach(function(p){ g.appendChild(photoTile(p.url)); }); });
    });
  }

  // ---- PROFILE ---------------------------------------------------- //
  function renderProfile(){
    var u=R5AUTH.user();
    var authBlock = u
      ? '<div class="card" style="margin:0 20px;display:flex;align-items:center;gap:14px">'+(u.avatar?'<img src="'+esc(u.avatar)+'" style="width:52px;height:52px;border-radius:50%;border:1px solid var(--line-2)">':'<div class="crest" style="width:52px;height:52px;margin:0"><div class="mono" style="font-size:1.2rem">'+esc((u.name||"?")[0])+'</div></div>')+'<div class="grow"><div style="font-family:var(--serif);font-style:italic;font-size:1.3rem">'+esc(u.name)+'</div><div class="muted" style="font-size:.82rem">'+esc(u.email||"")+(R5AUTH.isAdmin()?' · Organizator':'')+'</div></div></div>'
      : '<div style="padding:0 20px"><button class="btn btn-gold btn-block" id="g-login">Autentifică-te cu Google</button>'+
        '<div class="center muted" style="margin:14px 0 8px;font-size:.8rem">sau cu email</div>'+
        '<div style="display:flex;gap:8px"><input id="mail" placeholder="email@exemplu.ro" style="flex:1;background:var(--card);border:1px solid var(--line-2);border-radius:8px;padding:12px 14px;color:var(--cream)"><button class="btn btn-outline btn-sm" id="m-login">Trimite</button></div>'+
        (R5API.demo?'<p class="center muted" style="font-size:.78rem;margin-top:12px">Autentificarea funcționează pe site-ul publicat.</p>':'')+'</div>';

    view.innerHTML='<div class="letterbox"></div><section class="hero" style="padding-bottom:20px"><div class="crest" style="margin-top:26px"><div class="ring"></div><div class="ring inner"></div><div class="mono"><b>R</b>5</div></div><h1 style="font-size:2.4rem">Tineret R5</h1><div class="tagline">Regiunea 5 · Arad</div></section>'+
      '<div style="padding:8px 0 4px">'+authBlock+'</div><div class="rule" style="margin-top:20px"></div>'+
      (R5AUTH.isAdmin()?'<div class="set-list" style="border-top:none"><button class="set-row" id="go-admin"><span class="ic">✎</span><span class="grow">Panou organizator</span><span class="chev">›</span></button></div>':'')+
      '<div class="section-h"><div><div class="eyebrow">Cine suntem</div><h2>Cei 5 R</h2></div></div>'+
      '<div class="info-list">'+D.identity.fives.map(function(f){return '<div class="row"><div class="ic">'+f[1]+'</div><div><div class="v" style="font-family:var(--serif);font-style:italic;font-size:1.2rem">'+esc(f[0])+'</div></div></div>';}).join("")+'</div>'+
      '<div class="section-h" style="margin-bottom:8px"><div><div class="eyebrow">Cont</div><h2>Setări</h2></div></div><div class="set-list">'+
        '<button class="set-row" id="privacy"><span class="ic">🛡️</span><span class="grow">Confidențialitate</span><span class="chev">›</span></button>'+
        (u?'<button class="set-row" id="logout"><span class="ic">⤶</span><span class="grow">Deconectează-te</span><span class="chev">›</span></button>':'')+
        (u?'<button class="set-row danger" id="del"><span class="ic">🗑</span><span class="grow">Șterge contul</span><span class="chev">›</span></button>':'')+
      '</div><div class="center" style="padding:28px 24px;color:var(--dim)"><p class="muted">@tineret_r5</p><p style="font-size:.78rem;margin-top:4px">Tineret Regiunea 5 Arad</p></div>';

    var gl=document.getElementById("g-login"); gl&&gl.addEventListener("click", function(){ if(R5API.demo){ confirmSheet({title:"În curând",body:"Autentificarea cu Google funcționează pe site-ul publicat (după configurarea Google).",confirm:"Am înțeles",onConfirm:function(){}}); return;} R5AUTH.signInWithGoogle(); });
    var ml=document.getElementById("m-login"); ml&&ml.addEventListener("click", function(){ var em=(document.getElementById("mail").value||"").trim(); if(!em){ return; } R5AUTH.signInWithEmail(em).then(function(r){ if(r&&r.ok!==false) confirmSheet({title:"Verifică email-ul",body:"Ți-am trimis un link de conectare pe "+em+".",confirm:"OK",onConfirm:function(){}}); else toast("Nu s-a putut trimite."); }); });
    var ga=document.getElementById("go-admin"); ga&&ga.addEventListener("click", function(){ navigate("admin"); });
    document.getElementById("privacy").addEventListener("click", function(){ confirmSheet({title:"Confidențialitate",body:"Datele tale (nume și poză de la Google, mesajele din chat) sunt folosite doar în aplicație. Îți poți șterge contul oricând din Setări → Șterge contul.",confirm:"Am înțeles",onConfirm:function(){}}); });
    var lo=document.getElementById("logout"); lo&&lo.addEventListener("click", function(){ confirmSheet({title:"Deconectare",body:"Vrei să te deconectezi?",confirm:"Deconectează-te",onConfirm:function(){ R5AUTH.logout().then(function(){ navigate("profile"); }); }}); });
    var dl=document.getElementById("del"); dl&&dl.addEventListener("click", deleteAccount);
  }

  // ---- ADMIN ------------------------------------------------------ //
  function renderAdmin(){
    if(!R5AUTH.isAdmin()){ navigate("profile"); return; }
    view.innerHTML='<div class="back-fab" id="back" style="position:sticky;top:14px;margin:14px 0 0 14px">‹</div><div class="section-h" style="margin-top:6px"><div><div class="eyebrow">Organizator</div><h2>Evenimente</h2></div></div>'+
      '<div style="padding:0 20px"><button class="btn btn-gold btn-block" id="new-ev">＋ Eveniment nou</button></div><div id="adm-list"></div>';
    document.getElementById("back").addEventListener("click", function(){ navigate("profile"); });
    document.getElementById("new-ev").addEventListener("click", function(){ eventEditor(null); });
    var box=document.getElementById("adm-list");
    var all=EVENTS.slice().sort(function(a,b){ return new Date(b.starts_at||0)-new Date(a.starts_at||0); });
    if(!all.length) box.innerHTML='<div class="empty"><p>Niciun eveniment</p></div>';
    all.forEach(function(e){
      var row=el('<div class="evrow"><div class="grow"><h3 style="font-size:1.35rem">'+esc(e.title)+'</h3><div class="sub">'+esc(e.dateLabel||"")+(e.past?' · arhivă':'')+'</div></div><span class="chip" style="cursor:pointer">Editează</span></div>');
      row.querySelector(".chip").addEventListener("click", function(){ eventEditor(e); });
      box.appendChild(row);
    });
  }
  function eventEditor(e){
    var isNew=!e; e=e||{};
    var grads=["linear-gradient(155deg,#2a3a2a,#0f1410)","linear-gradient(155deg,#3a2c17,#120c07)","linear-gradient(155deg,#3a1f1f,#120909)","linear-gradient(155deg,#26303a,#0d1116)","linear-gradient(155deg,#2f3a1f,#10130a)","linear-gradient(155deg,#332742,#120c1a)"];
    var startLocal = e.starts_at ? new Date(e.starts_at).toISOString().slice(0,16) : "";
    var o=el('<div class="overlay"><div class="sheet" style="max-height:92vh;overflow:auto"><div class="grab"></div>'+
      '<h3>'+(isNew?"Eveniment nou":"Editează")+'</h3>'+
      field("Titlu","ev-title",e.title||"")+field("Etichetă mică (kicker)","ev-kicker",e.kicker||"")+
      field("Data (text afișat)","ev-date",e.dateLabel||"")+
      '<label class="fl">Data & ora (pt. sortare)</label><input class="fi" id="ev-start" type="datetime-local" value="'+startLocal+'">'+
      field("Locație","ev-loc",e.location||"")+field("Etichetă colț (ex: Nou)","ev-tag",e.tag||"")+
      '<label class="fl">Descriere</label><textarea class="fi" id="ev-about" rows="4">'+esc(e.about||"")+'</textarea>'+
      '<label class="fl">Culoare afiș</label><div id="ev-grads" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+grads.map(function(gr,i){return '<button class="gswatch" data-g="'+esc(gr)+'" style="width:44px;height:56px;border-radius:6px;border:2px solid '+((e.grad===gr)?'var(--gold)':'transparent')+';background:'+gr+'"></button>';}).join("")+'</div>'+
      '<label class="fl" style="display:flex;align-items:center;gap:10px;margin-bottom:16px"><input type="checkbox" id="ev-arch" '+(e.archived?"checked":"")+'> Arhivat (eveniment trecut)</label>'+
      '<button class="btn btn-gold btn-block" id="ev-save">'+(isNew?"Creează":"Salvează")+'</button>'+
      (isNew?'':'<button class="btn btn-danger btn-block" id="ev-del" style="margin-top:8px">Șterge evenimentul</button>')+
      '<button class="btn btn-ghost btn-block" id="ev-cancel" style="margin-top:8px">Anulează</button></div></div>');
    o.addEventListener("click", function(ev){ if(ev.target===o) o.remove(); });
    document.body.appendChild(o);
    var chosenGrad=e.grad||grads[1];
    o.querySelectorAll(".gswatch").forEach(function(b){ b.addEventListener("click", function(){ o.querySelectorAll(".gswatch").forEach(function(x){x.style.borderColor="transparent";}); b.style.borderColor="var(--gold)"; chosenGrad=b.dataset.g; }); });
    o.querySelector("#ev-cancel").addEventListener("click", function(){ o.remove(); });
    var del=o.querySelector("#ev-del"); del&&del.addEventListener("click", function(){ confirmSheet({title:"Ștergi evenimentul?",body:"Se șterge definitiv, cu tot cu poze și mesaje.",confirm:"Șterge",danger:true,onConfirm:function(){ R5API.deleteEvent(e.id).then(function(r){ if(r.ok){ o.remove(); reloadEvents(function(){ navigate("admin"); }); toast("Șters."); } else toast("Eroare la ștergere."); }); }}); });
    o.querySelector("#ev-save").addEventListener("click", function(){
      var start=o.querySelector("#ev-start").value;
      var payload={ id:e.id, title:(o.querySelector("#ev-title").value||"").trim(), kicker:o.querySelector("#ev-kicker").value.trim(),
        dateLabel:o.querySelector("#ev-date").value.trim(), starts_at: start? new Date(start).toISOString():null,
        location:o.querySelector("#ev-loc").value.trim(), tag:o.querySelector("#ev-tag").value.trim()||null,
        about:o.querySelector("#ev-about").value, grad:chosenGrad, archived:o.querySelector("#ev-arch").checked };
      if(!payload.title){ toast("Pune un titlu."); return; }
      R5API.saveEvent(payload).then(function(r){ if(r.ok){ o.remove(); reloadEvents(function(){ navigate("admin"); }); toast("Salvat."); } else toast("Eroare la salvare."); });
    });
  }
  function field(label,id,val){ return '<label class="fl">'+esc(label)+'</label><input class="fi" id="'+id+'" value="'+esc(val)+'">'; }

  // ---- account deletion ------------------------------------------- //
  function deleteAccount(){
    confirmSheet({ title:"Ștergi contul?", body:"Se șterg definitiv contul tău și tot ce ai postat (mesaje în chat). Acțiunea nu poate fi anulată.", confirm:"Șterge definitiv contul", danger:true,
      onConfirm:function(){ if(R5AUTH.user()){ toast("Se șterge contul…"); R5AUTH.deleteAccount(); } else confirmSheet({title:"Conectează-te întâi",body:"Trebuie să fii autentificat ca să-ți poți șterge contul.",confirm:"OK",onConfirm:function(){}}); } });
  }
  window.R5deleteAccount = deleteAccount;

  // ---- confirm sheet ---------------------------------------------- //
  function confirmSheet(opts){
    var o=el('<div class="overlay"><div class="sheet"><div class="grab"></div><h3>'+esc(opts.title)+'</h3><p>'+esc(opts.body)+'</p>'+
      '<button class="btn '+(opts.danger?"btn-danger":"btn-gold")+' btn-block" id="cf-ok" style="margin-top:22px">'+esc(opts.confirm||"Confirmă")+'</button>'+
      '<button class="btn btn-ghost btn-block" id="cf-no" style="margin-top:8px">Anulează</button></div></div>');
    o.addEventListener("click", function(e){ if(e.target===o) o.remove(); });
    o.querySelector("#cf-no").addEventListener("click", function(){ o.remove(); });
    o.querySelector("#cf-ok").addEventListener("click", function(){ o.remove(); opts.onConfirm&&opts.onConfirm(); });
    document.body.appendChild(o);
  }

  function bindGo(){ view.querySelectorAll("[data-go]").forEach(function(s){ s.style.cursor="pointer"; s.addEventListener("click", function(){ navigate(s.dataset.go); }); }); }

  // ---- admin tab + auth changes ----------------------------------- //
  function syncAdminTab(){
    var existing=tabbar.querySelector('a[data-route="admin"]');
    if(R5AUTH.isAdmin() && !existing){ var a=el('<a data-route="admin"><span class="ic">✎</span><span class="lb">Admin</span></a>'); a.addEventListener("click", function(){ navigate("admin"); }); tabbar.appendChild(a); }
    else if(!R5AUTH.isAdmin() && existing){ existing.remove(); }
    setTab();
  }
  function reloadEvents(cb){ R5API.getEvents().then(function(list){ EVENTS=list; cb&&cb(); }); }

  // ---- boot ------------------------------------------------------- //
  R5AUTH.onChange(function(){ syncAdminTab(); if(state.route==="profile"||state.route==="admin") render(); });
  reloadEvents(function(){ var s=parseHash(); state.route=s.route; state.param=s.param; render(); });
})();
