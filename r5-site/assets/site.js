/* =====================================================================
   Tineret R5 website — live events + gallery from Supabase (public read),
   with an offline demo fallback so the page always looks alive.
   ===================================================================== */
(function () {
  "use strict";
  var CFG = { url: "https://itttrepotdzvifseqvak.supabase.co", key: "sb_publishable_QTTQmwidPvxivhsX7FwDgw_7SieSSb7" };
  var sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(CFG.url, CFG.key) : null;

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function el(h){ var t=document.createElement("template"); t.innerHTML=h.trim(); return t.content.firstElementChild; }
  var ICN = {
    cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="1.6"/><path d="M3.5 9.4h17M8 3.2v3.6M16 3.2v3.6"/>',
    pin:'<path d="M12 21.5c4.2-4 7-7.4 7-11a7 7 0 1 0-14 0c0 3.6 2.8 7 7 11Z"/><circle cx="12" cy="10.2" r="2.4"/>'
  };
  function ic(n){ return '<svg class="svic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(ICN[n]||"")+'</svg>'; }
  function posterBg(e){ return e.cover_url ? ('background:#140e08 center/cover no-repeat url("'+encodeURI(e.cover_url)+'")') : ('background:'+(e.grad||'linear-gradient(155deg,#3a2c17,#140e08)')); }

  // ---- nav: burger + close on click ----
  var burger=document.getElementById("burger"), links=document.getElementById("links");
  if(burger&&links){ burger.addEventListener("click",function(){ links.classList.toggle("open"); }); links.querySelectorAll("a").forEach(function(a){ a.addEventListener("click",function(){ links.classList.remove("open"); }); }); }

  // ---- scroll reveal ----
  var io=("IntersectionObserver" in window)?new IntersectionObserver(function(es){ es.forEach(function(x){ if(x.isIntersecting){ x.target.classList.add("in"); io.unobserve(x.target); } }); },{threshold:.12}):null;
  function watch(node){ if(io) io.observe(node); else node.classList.add("in"); }
  document.querySelectorAll(".reveal").forEach(watch);

  // ---- data ----
  function demoEvents(){
    var yr=new Date().getFullYear();
    return [
      { title:"Seară de Tineret", kicker:"Invitat: pastor Emi Fedur", date_label:"Vineri · 18:00", location:"Biserica Penticostală Emanuel, Moroda", grad:"linear-gradient(155deg,#2a2f5a,#12132b)", starts_at:new Date(Date.now()+3*864e5).toISOString(), archived:false, tag:"Nou" },
      { title:"Campionat de Volei", kicker:"Ediția a 5-a", date_label:"Sâmbătă · 11:00", location:"Tabăra Gălșa", grad:"linear-gradient(155deg,#2a3a2a,#0f1410)", starts_at:new Date(Date.now()+18*864e5).toISOString(), archived:false, tag:null },
      { title:"Tabăra de vară", kicker:"Munții Făgăraș", date_label:"August", location:"Făgăraș", grad:"linear-gradient(155deg,#26303a,#0d1116)", starts_at:new Date(Date.now()+50*864e5).toISOString(), archived:false, tag:null }
    ];
  }
  function demoArchive(){
    var g=["#2a3a2a","#3a2c17","#3a1f1f","#26303a","#2f3a1f","#332742"];
    function tiles(n){ var a=[]; for(var i=0;i<n;i++) a.push({grad:"linear-gradient(150deg,"+g[i%g.length]+",#140e08)"}); return a; }
    return [
      { title:"Colinde 2025", tiles:tiles(6) },
      { title:"Tabăra 2025", tiles:tiles(6) }
    ];
  }

  function evCard(e){
    return el('<div class="evcard"><div class="bg" style="'+posterBg(e)+'"></div>'+
      (e.tag?'<span class="tag">'+esc(e.tag)+'</span>':'')+
      '<div class="c"><div class="k">'+esc(e.kicker||"")+'</div><h3>'+esc(e.title)+'</h3>'+
      '<div class="meta"><span>'+ic('cal')+esc(e.date_label||"")+'</span><span>'+ic('pin')+esc(e.location||"")+'</span></div></div></div>');
  }
  function tile(url,grad){ return el('<div class="tile"><div class="g" style="'+(url?('background-image:url(\''+encodeURI(url)+'\')'):('background:'+grad))+'"></div></div>'); }

  function renderUpcoming(list){
    var box=document.getElementById("upcoming"); if(!box) return; box.innerHTML="";
    if(!list.length){ box.appendChild(el('<p class="empty-note">Curând anunțăm următoarele evenimente.</p>')); return; }
    list.forEach(function(e){ box.appendChild(evCard(e)); });
  }
  function renderArchive(items){
    var box=document.getElementById("archive"); if(!box) return; box.innerHTML="";
    if(!items.length){ box.appendChild(el('<p class="empty-note">Amintirile apar aici după primele evenimente.</p>')); return; }
    items.forEach(function(a){
      var wrap=el('<div class="archive-ev"><span class="chip">'+esc(a.title)+'</span><div class="gallery"></div></div>');
      var g=wrap.querySelector(".gallery");
      (a.tiles||[]).forEach(function(t){ g.appendChild(tile(t.url,t.grad)); });
      box.appendChild(wrap);
    });
  }

  function loadLive(){
    return sb.from("r5_events").select("*").then(function(r){
      var rows=r.data||[]; var now=new Date();
      var up=[], past=[];
      rows.forEach(function(e){
        var isPast = e.archived || (e.starts_at ? new Date(e.ends_at||e.starts_at) < now : false);
        (isPast?past:up).push(e);
      });
      up.sort(function(a,b){ return new Date(a.starts_at||0)-new Date(b.starts_at||0); });
      past.sort(function(a,b){ return new Date(b.starts_at||0)-new Date(a.starts_at||0); });
      renderUpcoming(up);
      // archive with photos
      if(!past.length){ renderArchive([]); return; }
      Promise.all(past.slice(0,6).map(function(e){
        return sb.from("r5_photos").select("url").eq("event_id", e.id).order("created_at",{ascending:false}).limit(8)
          .then(function(pr){ return { title:e.title, tiles:(pr.data||[]).map(function(p){return {url:p.url};}) }; });
      })).then(function(items){
        items=items.filter(function(x){ return x.tiles.length; });
        renderArchive(items.length?items:demoArchive());
      });
    }).catch(function(){ renderUpcoming(demoEvents()); renderArchive(demoArchive()); });
  }

  if(sb){ loadLive(); } else { renderUpcoming(demoEvents()); renderArchive(demoArchive()); }
})();
