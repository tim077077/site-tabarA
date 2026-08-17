/* =====================================================================
   Tineret R5 — app shell + views (demo). Cinematic/vintage.
   Backend (Supabase auth/chat/photos) is wired in a later pass; the
   chat/gallery here are visual placeholders.
   ===================================================================== */
(function () {
  "use strict";
  var view = document.getElementById("view");
  var tabbar = document.getElementById("tabbar");
  var D = window.R5DATA;

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function el(h){ var t=document.createElement("template"); t.innerHTML=h.trim(); return t.content.firstElementChild; }
  function upcoming(){ return D.events.filter(function(e){return !e.past;}).sort(function(a,b){return new Date(a.start)-new Date(b.start);}); }
  function past(){ return D.events.filter(function(e){return e.past;}); }
  function evById(id){ return D.events.find(function(e){return e.id===id;}); }
  function dparts(iso){ var d=new Date(iso); var m=["IAN","FEB","MAR","APR","MAI","IUN","IUL","AUG","SEP","OCT","NOV","DEC"]; return {d:d.getDate(), m:m[d.getMonth()]}; }

  // ---- router ----------------------------------------------------- //
  var state = { route: "home", param: null };
  function navigate(route, param){ state.route=route; state.param=param; window.scrollTo(0,0); render(); }
  tabbar.querySelectorAll("a").forEach(function(a){ a.addEventListener("click", function(){ navigate(a.dataset.route); }); });
  function setTab(){ tabbar.querySelectorAll("a").forEach(function(a){ a.classList.toggle("on", a.dataset.route===state.route || (state.route==="event" && a.dataset.route==="events")); }); }

  function render(){
    setTab();
    document.querySelector(".chat-bar") && document.querySelector(".chat-bar").remove();
    if(state.route==="home") return renderHome();
    if(state.route==="events") return renderEvents();
    if(state.route==="event") return renderEvent(state.param);
    if(state.route==="gallery") return renderGallery();
    if(state.route==="profile") return renderProfile();
  }

  // ---- posters / rows --------------------------------------------- //
  function posterCard(e){
    var card = el(
      '<div class="poster'+(e.past?" past":"")+'">'+
        '<div class="bg" style="background:'+e.grad+'"></div><div class="grain-s"></div>'+
        '<span class="corner tl"></span><span class="corner tr"></span>'+
        (e.tag?'<span class="tag">'+esc(e.tag)+'</span>':(e.past?'<span class="tag">Arhivă</span>':''))+
        '<div class="content">'+
          '<div class="kicker">'+esc(e.kicker)+'</div>'+
          '<h3>'+esc(e.title)+'</h3>'+
          '<div class="meta"><span>📅 '+esc(e.dateLabel)+'</span></div>'+
          '<div class="meta"><span>📍 '+esc(e.location)+'</span></div>'+
        '</div></div>'
    );
    card.addEventListener("click", function(){ navigate("event", e.id); });
    return card;
  }
  function eventRow(e){
    var dp=dparts(e.start);
    var row=el('<div class="evrow"><div class="date"><div class="d">'+dp.d+'</div><div class="m">'+dp.m+'</div></div>'+
      '<div class="grow"><h3>'+esc(e.title)+'</h3><div class="sub">'+esc(e.location)+'</div></div><div class="chev">›</div></div>');
    row.addEventListener("click", function(){ navigate("event", e.id); });
    return row;
  }

  // ---- HOME ------------------------------------------------------- //
  function renderHome(){
    var up = upcoming();
    var featured = up[0];
    view.innerHTML =
      '<div class="letterbox"></div>'+
      '<section class="hero">'+
        '<div class="eyebrow center" style="justify-content:center">Regiunea 5 · Arad</div>'+
        '<div class="crest"><div class="ring"></div><div class="ring inner"></div><div class="mono"><b>R</b>5</div></div>'+
        '<h1>Tineret <span>R5</span></h1>'+
        '<div class="tagline">chemați la mai mult</div>'+
        '<div class="fives">'+D.identity.fives.map(function(f){return '<span><b>'+f[1]+'</b> '+esc(f[0])+'</span>';}).join("")+'</div>'+
      '</section>';

    if(featured){
      view.insertAdjacentHTML("beforeend", '<div class="section-h"><div><div class="eyebrow">Urmează</div><h2>Nu rata</h2></div></div>');
      var wrap=el('<div class="stack"></div>'); wrap.appendChild(posterCard(featured)); view.appendChild(wrap);
    }

    view.insertAdjacentHTML("beforeend", '<div class="section-h"><div><div class="eyebrow">Program</div><h2>Evenimente</h2></div><span class="more" data-go="events">Toate ›</span></div>');
    var list=el('<div></div>');
    up.slice(1).forEach(function(e){ list.appendChild(eventRow(e)); });
    if(up.length<=1) list.innerHTML='<div class="empty"><div class="ic">✦</div><p>Curând mai multe evenimente</p></div>';
    view.appendChild(list);

    view.insertAdjacentHTML("beforeend", '<div class="divider-orn">✦ ✦ ✦</div>');
    view.insertAdjacentHTML("beforeend", '<div class="section-h"><div><div class="eyebrow">Amintiri</div><h2>Din galerie</h2></div><span class="more" data-go="gallery">Vezi tot ›</span></div>');
    var strip=el('<div class="gallery"></div>');
    galleryTiles(9).forEach(function(t){ strip.appendChild(t); });
    view.appendChild(strip);

    view.insertAdjacentHTML("beforeend",
      '<div class="center" style="padding:40px 24px 20px;color:var(--dim)">'+
      '<div class="eyebrow center" style="justify-content:center;margin-bottom:10px">Rămâi conectat</div>'+
      '<p class="muted" style="font-size:.9rem">@tineret_r5 · Regiunea 5 Arad</p></div>');

    bindGo();
  }

  // ---- EVENTS ----------------------------------------------------- //
  function renderEvents(){
    view.innerHTML='<div class="letterbox"></div><div class="section-h" style="margin-top:26px"><div><div class="eyebrow">Program</div><h2>Evenimente</h2></div></div>';
    var up=upcoming(), pv=past();
    var wrap=el('<div class="stack"></div>');
    up.forEach(function(e){ wrap.appendChild(posterCard(e)); });
    view.appendChild(wrap);
    if(pv.length){
      view.insertAdjacentHTML("beforeend",'<div class="section-h" style="margin-top:34px"><div><div class="eyebrow">Arhivă</div><h2>Au fost</h2></div></div>');
      var wrap2=el('<div class="stack"></div>');
      pv.forEach(function(e){ wrap2.appendChild(posterCard(e)); });
      view.appendChild(wrap2);
    }
  }

  // ---- EVENT DETAIL ----------------------------------------------- //
  function renderEvent(id){
    var e=evById(id); if(!e){ navigate("events"); return; }
    view.innerHTML =
      '<div class="back-fab" id="back">‹</div>'+
      '<section class="detail-hero"><div class="bg" style="background:'+e.grad+'"></div><div class="grain-s" style="position:absolute;inset:0;z-index:1;opacity:.07"></div>'+
        '<div class="content"><div class="kicker" style="font-family:var(--poster);letter-spacing:.2em;color:var(--gold-2);text-transform:uppercase;font-size:.82rem">'+esc(e.kicker)+'</div>'+
        '<h1>'+esc(e.title)+'</h1><div class="muted" style="margin-top:6px">'+esc(e.dateLabel)+'</div></div></section>'+
      '<div class="segs" id="segs"><button data-s="info" class="on">Info</button><button data-s="chat">Chat</button><button data-s="poze">Poze</button></div>'+
      '<div id="seg-body"></div>';
    document.getElementById("back").addEventListener("click", function(){ navigate("events"); });
    var segs=document.getElementById("segs");
    segs.querySelectorAll("button").forEach(function(b){ b.addEventListener("click", function(){ segs.querySelectorAll("button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); seg(e, b.dataset.s); }); });
    seg(e,"info");
  }
  function seg(e, which){
    var box=document.getElementById("seg-body");
    document.querySelector(".chat-bar") && document.querySelector(".chat-bar").remove();
    if(which==="info"){
      box.innerHTML =
        '<div class="info-list">'+
          '<div class="row"><div class="ic">📅</div><div><div class="k">Data</div><div class="v">'+esc(e.dateLabel)+'</div></div></div>'+
          '<div class="row"><div class="ic">📍</div><div><div class="k">Locație</div><div class="v">'+esc(e.location)+'</div></div></div>'+
        '</div>'+
        '<div class="prose">'+e.about.split("\n").filter(Boolean).map(function(p){return '<p>'+esc(p)+'</p>';}).join("")+'</div>'+
        (e.past?'':'<div style="padding:6px 20px 20px"><button class="btn btn-gold btn-block">Anunță-mă de eveniment</button></div>');
    } else if(which==="chat"){
      box.innerHTML='<div class="chat" id="chat"></div>';
      var chat=document.getElementById("chat");
      var demo=[
        {who:"Andrei", me:false, txt:"Salut! La ce oră începe mai exact?"},
        {who:"Organizator", me:false, txt:"La 18:00, dar vino de la 17:45 să prindem loc 🙌"},
        {who:"Tu", me:true, txt:"Super, vin și eu cu doi prieteni!"}
      ];
      demo.forEach(function(m){ chat.appendChild(el('<div class="msg'+(m.me?" me":"")+'"><div class="who">'+esc(m.who)+'</div><div class="bubble">'+esc(m.txt)+'</div></div>')); });
      var bar=el('<div class="chat-bar"><div class="inner"><input placeholder="Autentifică-te ca să scrii…" disabled /><button disabled>➤</button></div></div>');
      document.body.appendChild(bar);
      chat.insertAdjacentHTML("beforeend",'<div class="center muted" style="font-size:.8rem;padding:14px">Chat-ul se activează după autentificare (în curând)</div>');
    } else {
      if(!e.photos){ box.innerHTML='<div class="empty"><div class="ic">◈</div><p>Încă nu sunt poze</p></div>'; return; }
      var g=el('<div class="gallery" style="margin-top:12px"></div>');
      galleryTiles(e.photos).forEach(function(t){ g.appendChild(t); });
      box.innerHTML=''; box.appendChild(g);
    }
  }

  // ---- GALLERY ---------------------------------------------------- //
  function galleryTiles(n){
    var grads=["#2a3a2a","#3a2c17","#3a1f1f","#26303a","#2f3a1f","#332742"];
    var out=[]; for(var i=0;i<n;i++){ var g=grads[i%grads.length];
      out.push(el('<div class="tile"><div class="g" style="background:linear-gradient(150deg,'+g+',#140e08)"></div></div>')); }
    return out;
  }
  function renderGallery(){
    view.innerHTML='<div class="letterbox"></div><div class="section-h" style="margin-top:26px"><div><div class="eyebrow">Amintiri</div><h2>Galerie</h2></div></div>';
    past().forEach(function(e){
      view.insertAdjacentHTML("beforeend",'<div style="padding:8px 20px 6px"><span class="chip">'+esc(e.title)+' · '+e.photos+' poze</span></div>');
      var g=el('<div class="gallery" style="margin-bottom:18px"></div>');
      galleryTiles(e.photos).forEach(function(t){ g.appendChild(t); });
      view.appendChild(g);
    });
    view.insertAdjacentHTML("beforeend",'<div class="empty"><p style="font-size:1rem">Pozele reale se încarcă după conectarea galeriei</p></div>');
  }

  // ---- PROFILE ---------------------------------------------------- //
  function renderProfile(){
    view.innerHTML =
      '<div class="letterbox"></div>'+
      '<section class="hero" style="padding-bottom:20px">'+
        '<div class="crest" style="margin-top:26px"><div class="ring"></div><div class="ring inner"></div><div class="mono"><b>R</b>5</div></div>'+
        '<h1 style="font-size:2.4rem">Tineret R5</h1><div class="tagline">Regiunea 5 · Arad</div>'+
      '</section>'+
      '<div style="padding:24px 20px"><button class="btn btn-gold btn-block" id="login">Autentifică-te cu Google</button>'+
      '<p class="center muted" style="font-size:.8rem;margin-top:12px">Te conectezi ca să scrii în chat și să primești anunțuri (în curând).</p></div>'+
      '<div class="rule"></div>'+
      '<div class="section-h"><div><div class="eyebrow">Cine suntem</div><h2>Cei 5 R</h2></div></div>'+
      '<div class="info-list">'+D.identity.fives.map(function(f){return '<div class="row"><div class="ic">'+f[1]+'</div><div><div class="v" style="font-family:var(--serif);font-style:italic;font-size:1.2rem">'+esc(f[0])+'</div></div></div>';}).join("")+'</div>'+
      '<div class="center" style="padding:24px;color:var(--dim)"><p class="muted">@tineret_r5</p><p style="font-size:.78rem;margin-top:4px">Tineret Regiunea 5 Arad</p></div>';
    document.getElementById("login").addEventListener("click", function(){ alert("Autentificarea cu Google se activează în pasul următor."); });
  }

  function bindGo(){ view.querySelectorAll("[data-go]").forEach(function(s){ s.style.cursor="pointer"; s.addEventListener("click", function(){ navigate(s.dataset.go); }); }); }

  navigate("home");
})();
