/* ================================================================
   LOCAL MODE (for VS Code / Live Server / flash drive)
   When this page runs outside claude.ai, there is no shared database.
   This small helper saves everything (photos, playlist, places,
   movies, schedule) in YOUR browser's localStorage instead, so every
   feature still works. Nothing here runs when the page is published.
   ================================================================ */
(function () {
  if (window.claude) return;
  var PFX = "celo-site:", L = {};

  function load(col) { try { return JSON.parse(localStorage.getItem(PFX + col)) || {}; } catch (e) { return {}; } }
  function save(col, obj) {
    try { localStorage.setItem(PFX + col, JSON.stringify(obj)); }
    catch (e) { throw { code: "quota_exceeded", message: "Browser storage is full" }; }
  }
  function emit(col) { (L[col] || []).forEach(function (f) { f(); }); }
  function listen(col, fire) {
    (L[col] = L[col] || []).push(fire);
    setTimeout(fire, 0);
    return function () { L[col] = L[col].filter(function (f) { return f !== fire; }); };
  }
  function snapDoc(id, data) { return { id: id, exists: !!data, data: function () { return data; } }; }

  function colRef(col, order) {
    return {
      orderBy: function (f, dir) { return colRef(col, { f: f, dir: dir || "asc" }); },
      onSnapshot: function (next) {
        return listen(col, function () {
          var o = load(col);
          var docs = Object.keys(o).map(function (id) { return snapDoc(id, o[id]); });
          if (order) docs.sort(function (a, b) {
            var x = a.data()[order.f], y = b.data()[order.f];
            return (x > y ? 1 : x < y ? -1 : 0) * (order.dir === "desc" ? -1 : 1);
          });
          next({ docs: docs, size: docs.length, empty: !docs.length });
        });
      },
      add: async function (data) {
        var o = load(col), id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        o[id] = data; save(col, o); emit(col); return { id: id };
      }
    };
  }
  function docRef(path) {
    var k = path.lastIndexOf("/"), col = path.slice(0, k), id = path.slice(k + 1);
    return {
      set: async function (data) { var o = load(col); o[id] = data; save(col, o); emit(col); },
      delete: async function () { var o = load(col); delete o[id]; save(col, o); emit(col); },
      onSnapshot: function (next) { return listen(col, function () { next(snapDoc(id, load(col)[id])); }); }
    };
  }
  var db = { collection: colRef, doc: docRef };

  function toDataURL(blob, max) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onerror = function () { rej({ code: "read_failed" }); };
      r.onload = function () {
        var im = new Image();
        im.onload = function () {
          var s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas");
          c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", 0.8));
        };
        im.onerror = function () { res(r.result); };
        im.src = r.result;
      };
      r.readAsDataURL(blob);
    });
  }
  var assets = {
    upload: async function (blob) {
      var url = await toDataURL(blob, 1100);
      return { id: "a" + Date.now().toString(36), url: url, sizeBytes: url.length, contentType: "image/jpeg" };
    },
    delete: async function () { return { deleted: true }; }
  };
  var user = { id: async function () { return "me"; }, canEdit: async function () { return true; } };

  window.claude = {
    use: async function (name) { return name === "db" ? db : name === "assets" ? assets : name === "user" ? user : null; }
  };
})();

(function(){
  var $=function(s){return document.querySelector(s)}, $$=function(s){return Array.from(document.querySelectorAll(s))};
  var done={},total=4;

  /* progress meter (system status, makes exploring feel rewarding) */
  function mark(k){
    if(done[k])return; done[k]=1;
    var n=Object.keys(done).length;
    $("#fill").style.width=(n/total*100)+"%"; $("#pct").textContent=n+"/"+total;
    if(n===total){$("#secret").classList.add("show");$("#secret").scrollIntoView({behavior:"smooth",block:"center"});confetti()}
  }
  function confetti(){
    var c=["#ffd23f","#ff6b9d","#4ecdc4","#6ec6ff"];
    for(var i=0;i<70;i++){var s=document.createElement("span");s.className="fall";
      s.style.left=Math.random()*100+"vw";s.style.background=c[i%4];
      s.style.animationDuration=(1.8+Math.random()*2)+"s";s.style.animationDelay=Math.random()*.6+"s";
      document.body.appendChild(s);setTimeout(function(e){e.remove()},4500,s)}
  }

  /* typing effect */
  var roles=["a curious student","a creative builder","a tech enthusiast","someone you'll want to know"],ri=0,ci=0,del=false,t=$("#typed");
  function type(){
    var w=roles[ri]; ci+=del?-1:1; t.textContent=w.slice(0,ci);
    var d=del?35:75;
    if(!del&&ci===w.length){del=true;d=1400}else if(del&&ci===0){del=false;ri=(ri+1)%roles.length;d=300}
    setTimeout(type,d);
  }
  type();

  /* shared photos: db (rows) + assets (files) */
  var db=null,assets=null,user=null,myId=null,isEd=false,list=[],ph=$("#photo"),st=$("#st");
  function say(m){st.textContent=m||""}
  function setPhoto(u){ph.style.backgroundImage="url("+u+")";ph.firstChild.textContent=""}
  function shrink(f,max){return new Promise(function(res){
    if(!/^image\/(jpeg|png|webp)$/.test(f.type)||(f.size<400000&&max>1000)){res(f);return}
    var im=new Image(),u=URL.createObjectURL(f);
    im.onload=function(){var s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement("canvas");
      c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext("2d").drawImage(im,0,0,c.width,c.height);
      URL.revokeObjectURL(u);c.toBlob(function(x){res(x&&x.size<f.size?x:f)},"image/jpeg",.86)};
    im.onerror=function(){URL.revokeObjectURL(u);res(f)};im.src=u})}
  function ask(){return new Promise(function(res){var d=$("#capd"),i=$("#capin");i.value="";
    function fin(v){d.close();res(v)}$("#capok").onclick=function(){fin(i.value.trim())};$("#capskip").onclick=function(){fin("")};
    d.oncancel=function(){res("")};d.showModal();i.focus()})}
  function draw(){
    var w=$("#wall");w.textContent="";$("#gempty").hidden=list.length>0;
    list.forEach(function(p){
      var f=document.createElement("figure");f.className="pol";f.style.margin="0 0 1.2rem";
      var b=document.createElement("button");b.className="open";b.setAttribute("aria-label","Open photo"+(p.caption?": "+p.caption:""));
      var im=document.createElement("img");im.src=p.url;im.alt=p.caption||"Photo";im.loading="lazy";b.appendChild(im);
      b.onclick=function(){$("#lbimg").src=p.url;$("#lbimg").alt=p.caption||"Photo";$("#lbcap").textContent=p.caption||"";$("#lb").showModal()};
      f.appendChild(b);
      if(p.caption){var c=document.createElement("p");c.className="pc";c.textContent=p.caption;f.appendChild(c)}
      var h=document.createElement("button"),cnt=p.hearts||0;h.className="heart";h.setAttribute("aria-label","Love this photo");h.textContent="❤️ "+cnt;
      h.onclick=async function(e){e.stopPropagation();cnt++;h.textContent="❤️ "+cnt;burst(e.clientX,e.clientY,["❤️","💖","💕"],6);
        try{await db.doc("photos/"+p.id).set({assetId:p.assetId,url:p.url,caption:p.caption,by:p.by,createdAt:p.createdAt,hearts:cnt})}catch(err){}};
      f.appendChild(h);
      if(isEd||(myId&&p.by===myId)){var x=document.createElement("button");x.className="x";x.textContent="×";x.setAttribute("aria-label","Delete photo");
        x.onclick=async function(){if(!confirm("Delete this photo for everyone?"))return;
          try{await db.doc("photos/"+p.id).delete();try{await assets.delete(p.assetId)}catch(e){}}catch(e){say("Couldn't delete that photo.")}};f.appendChild(x)}
      w.appendChild(f)})}
  $("#lbx").onclick=function(){$("#lb").close()};
  $("#lb").addEventListener("click",function(e){if(e.target===this)this.close()});
  async function uploadAll(fs){
    $("#add").disabled=true;var n=0;
    for(var i=0;i<fs.length;i++){
      if(!/^image\//.test(fs[i].type)){say("Only pictures can be added.");continue}
      var cap=fs.length===1?await ask():"";say("Uploading "+(i+1)+" of "+fs.length+"…");
      try{var r=await assets.upload(await shrink(fs[i],1800));
        await db.collection("photos").add({assetId:r.id,url:r.url,caption:cap,by:myId||"",createdAt:Date.now()});n++}
      catch(e){say(e&&e.code==="quota_exceeded"?"The album is full. Delete a photo first.":"That photo didn't upload. Try again.");$("#add").disabled=false;return}}
    say(n?"Added "+n+(n===1?" photo":" photos")+"!":"");setTimeout(say,3000);$("#add").disabled=false;$("#file").value=""}
  $("#add").onclick=function(){$("#file").click()};
  $("#file").onchange=function(){if(this.files.length)uploadAll(Array.from(this.files))};
  async function boot(){
    try{user=await claude.use("user")}catch(e){}
    if(user){try{myId=await user.id();isEd=await user.canEdit()}catch(e){}}
    try{db=await claude.use("db")}catch(e){}
    try{assets=await claude.use("assets")}catch(e){}
    if(!db){$("#gempty").hidden=false;$("#gempty").textContent="Sign in to claude.ai to see the photo wall.";return}
    if(assets)$("#add").hidden=false;
    if(assets&&isEd){ /* only the owner/editors change the profile picture */
      var inp=document.createElement("input");inp.type="file";inp.accept="image/*";
      ph.querySelector("small").hidden=false;ph.disabled=false;
      ph.onclick=function(){inp.click()};
      inp.onchange=async function(){var f=inp.files[0];if(!f)return;
        try{var r=await assets.upload(await shrink(f,600));await db.doc("profile/photo").set({url:r.url,assetId:r.id})}catch(e){}}}
    db.doc("profile/photo").onSnapshot(function(s){var v=s.exists&&s.data();if(v&&v.url)setPhoto(v.url)},function(){});
    db.collection("photos").orderBy("createdAt","desc").onSnapshot(function(sn){
      list=sn.docs.map(function(d){var v=d.data()||{};return{id:d.id,url:v.url,assetId:v.assetId,caption:v.caption||"",by:v.by||"",hearts:v.hearts||0,createdAt:v.createdAt||0}}).filter(function(p){return p.url});draw()},
      function(){say("Couldn't load the photos.")});initLists()}
  $("#gempty").hidden=true;boot();

  /* flip cards */
  $$(".flip").forEach(function(b){b.onclick=function(){b.classList.toggle("on");mark("flip")}});

  /* skills */
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.querySelector("i").style.width=e.target.dataset.v+"%";io.unobserve(e.target)}})},{threshold:.4});
  $$(".skill").forEach(function(s){io.observe(s);s.onclick=function(){s.classList.toggle("open");mark("skill")}});

  /* quiz */
  var qs=[
    {q:"Am I a night owl or an early bird?",o:["Night owl 🦉","Early bird 🐦"],a:0,w:"I do my best work after dark."},
    {q:"Which would I pick for a free weekend?",o:["Stay in & game 🎮","Go out & explore 🌴"],a:1,w:"Adventure wins every time."},
    {q:"Rice or noodles?",o:["Rice 🍚","Noodles 🍜"],a:0,w:"Typical Filipino answer, right?"}
  ],qi=0,score=0;
  function showQ(){
    var q=qs[qi];$("#qtext").textContent=q.q;$("#qres").textContent="";
    var box=$("#qopts");box.textContent="";
    q.o.forEach(function(txt,i){var b=document.createElement("button");b.className="btn alt";b.textContent=txt;
      b.onclick=function(){
        var ok=i===q.a;if(ok)score++;
        $("#qres").textContent=(ok?"✅ You got it! ":"❌ Nope! ")+q.w;
        box.querySelectorAll("button").forEach(function(x){x.disabled=true});
        setTimeout(function(){qi++;if(qi<qs.length)showQ();else{
          $("#qtext").textContent="You know me "+Math.round(score/qs.length*100)+"%!";
          box.textContent="";var r=document.createElement("button");r.className="btn";r.textContent="Play again";
          r.onclick=function(){qi=0;score=0;showQ()};box.appendChild(r);$("#qres").textContent=score+" of "+qs.length+" correct";mark("quiz")}},1300);
      };box.appendChild(b)});
  }
  showQ();

  /* fun facts */
  var facts=["I can type without looking at the keyboard. ⌨️","My favorite color changes with my mood, but it's usually blue. 💙","I love learning how websites work behind the scenes. 🔧","I believe every great project starts with one small idea. 💡","I'm from Cebu, where the lechon is legendary. 🐖"],fi=-1;
  function nextFact(){fi=(fi+1)%facts.length;$("#fact").textContent=facts[fi];mark("fact")}
  $("#factbtn").onclick=nextFact;$("#spin").onclick=function(){nextFact();$("#fact").scrollIntoView({behavior:"smooth",block:"center"})};

  /* extra fun: greeting, click sparkles, floating emoji, star game */
  var hr=new Date().getHours();
  $("#hi").textContent=(hr<12?"Good morning! ☀️":hr<18?"Good afternoon! 🌤️":"Good evening! 🌙")+" I'm";
  var calm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  function burst(x,y,items,n){
    if(calm)return;
    for(var i=0;i<n;i++){var s=document.createElement("span"),a=Math.random()*6.28,d=30+Math.random()*50;
      s.className="burst";s.textContent=items[i%items.length];s.style.left=x+"px";s.style.top=y+"px";
      s.style.setProperty("--dx",Math.cos(a)*d+"px");s.style.setProperty("--dy",Math.sin(a)*d-20+"px");
      document.body.appendChild(s);setTimeout(function(e){e.remove()},900,s)}
  }
  document.addEventListener("click",function(e){burst(e.clientX,e.clientY,["✨","💖","⭐","🎀"],5)});
  if(!calm){["🎀","✨","📸","💖","⭐","🌸","🎈","🦋"].forEach(function(em,i){
    var b=document.createElement("span");b.className="bit";b.textContent=em;b.setAttribute("aria-hidden","true");
    b.style.left=(6+i*12)+"vw";b.style.animationDuration=(14+i*2.5)+"s";b.style.animationDelay=(-i*3)+"s";
    document.body.appendChild(b)})}
  var run=false,sc=0;
  $("#play").onclick=function(){
    if(run)return;run=true;sc=0;var left=10,arena=$("#arena");
    $("#score").textContent="0";$("#time").textContent=left;$("#gmsg").textContent="";arena.textContent="";
    var spawn=setInterval(function(){
      var s=document.createElement("button");s.className="star";s.textContent="⭐";s.setAttribute("aria-label","Catch the star");
      s.style.left=Math.random()*85+"%";s.style.top=Math.random()*75+"%";
      s.onclick=function(e){e.stopPropagation();sc++;$("#score").textContent=sc;burst(e.clientX,e.clientY,["+1"],1);s.remove()};
      arena.appendChild(s);setTimeout(function(){s.remove()},1100)},450);
    var cd=setInterval(function(){
      left--;$("#time").textContent=left;
      if(left<=0){clearInterval(cd);clearInterval(spawn);run=false;arena.textContent="";
        $("#gmsg").textContent=sc>=12?"Wow, "+sc+" stars! Star catcher! 🌟":"You caught "+sc+" stars. Play again to beat it!";
        mark("game");if(sc>=12)confetti()}
    },1000)
  };

  /* playlist + places (shared, owner edits) */
  var songs=[],places=[];
  function safeUrl(u){return /^https?:\/\//i.test(u)}
  function initLists(){
    if(isEd){$("#songadd").hidden=false;$("#placeadd").hidden=false;$("#movadd").hidden=false;$("#schadd").hidden=false}initMore();
    db.collection("playlist").orderBy("createdAt","desc").onSnapshot(function(sn){
      songs=sn.docs.map(function(d){var v=d.data()||{};return{id:d.id,title:v.title||"",artist:v.artist||"",link:v.link||"",createdAt:v.createdAt||0}});drawSongs()},function(){});
    db.collection("places").orderBy("createdAt","desc").onSnapshot(function(sn){
      places=sn.docs.map(function(d){var v=d.data()||{};return{id:d.id,name:v.name||"",note:v.note||"",status:v.status==="visited"?"visited":"wish",createdAt:v.createdAt||0}});drawPlaces()},function(){});
  }
  function drawSongs(){
    var ul=$("#songs");ul.textContent="";$("#sempty").hidden=songs.length>0;
    songs.forEach(function(s){
      var li=document.createElement("li"),v=document.createElement("span"),t=document.createElement("div"),b=document.createElement("b"),a=document.createElement("span"),p=document.createElement("a");
      v.className="v";v.textContent="💿";v.setAttribute("aria-hidden","true");
      t.className="t";b.textContent=s.title;a.textContent=s.artist;t.appendChild(b);t.appendChild(a);
      p.className="btn alt";p.textContent="▶ Play";p.target="_blank";p.rel="noopener noreferrer";p.style.padding=".25rem .8rem";
      p.href=safeUrl(s.link)?s.link:"https://www.youtube.com/results?search_query="+encodeURIComponent(s.title+" "+s.artist);
      li.appendChild(v);li.appendChild(t);li.appendChild(p);
      if(isEd){var x=document.createElement("button");x.className="mini";x.textContent="×";x.setAttribute("aria-label","Remove song");
        x.onclick=function(){db.doc("playlist/"+s.id).delete().catch(function(){})};li.appendChild(x)}
      ul.appendChild(li)})
  }
  function drawPlaces(){
    ["visited","wish"].forEach(function(k){
      var ul=$("#"+k),items=places.filter(function(p){return p.status===k});
      ul.textContent="";$(k==="visited"?"#vempty":"#wempty").hidden=items.length>0;
      items.forEach(function(p){
        var li=document.createElement("li"),b=document.createElement("b");
        b.textContent=(k==="visited"?"📍 ":"✨ ")+p.name;li.appendChild(b);
        if(p.note){var n=document.createElement("small");n.textContent=p.note;li.appendChild(n)}
        if(isEd){
          if(k==="wish"){var m=document.createElement("button");m.className="mini";m.textContent="Visited it! ✅";
            m.onclick=function(){db.doc("places/"+p.id).set({name:p.name,note:p.note,status:"visited",createdAt:p.createdAt}).catch(function(){})};li.appendChild(m)}
          var x=document.createElement("button");x.className="mini";x.textContent="×";x.setAttribute("aria-label","Remove place");
          x.onclick=function(){db.doc("places/"+p.id).delete().catch(function(){})};li.appendChild(x)}
        ul.appendChild(li)})})
  }
  $("#sBtn").onclick=async function(){
    var t=$("#sTitle").value.trim();if(!t||!db)return;
    try{await db.collection("playlist").add({title:t,artist:$("#sArtist").value.trim(),link:$("#sLink").value.trim(),createdAt:Date.now()});
      $("#sTitle").value="";$("#sArtist").value="";$("#sLink").value=""}catch(e){}
  };
  $("#pBtn").onclick=async function(){
    var n=$("#pName").value.trim();if(!n||!db)return;
    try{await db.collection("places").add({name:n,note:$("#pNote").value.trim(),status:$("#pStat").value,createdAt:Date.now()});
      $("#pName").value="";$("#pNote").value=""}catch(e){}
  };

  /* movies & series log + schedule planner (shared, owner edits) */
  var movies=[],tasks=[],mf="all",DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],todayIdx=(new Date().getDay()+6)%7;
  var SL={watched:"Watched ✅",watching:"Watching now 👀",plan:"Plan to watch 📝"};
  $("#tDay").value=String(todayIdx);
  function initMore(){
    db.collection("watchlog").orderBy("createdAt","desc").onSnapshot(function(sn){
      movies=sn.docs.map(function(d){var v=d.data()||{};return{id:d.id,title:v.title||"",type:(v.type==="series"||v.type==="anime")?v.type:"movie",status:SL[v.status]?v.status:"watched",rating:+v.rating||0,note:v.note||"",createdAt:v.createdAt||0}});drawMovies()},function(){});
    db.collection("schedule").onSnapshot(function(sn){
      tasks=sn.docs.map(function(d){var v=d.data()||{};return{id:d.id,day:Math.min(6,Math.max(0,+v.day||0)),time:v.time||"",task:v.task||"",done:!!v.done,createdAt:v.createdAt||0}});drawSched()},function(){});
  }
  function drawMovies(){
    var ul=$("#movies"),items=movies.filter(function(m){return mf==="all"||m.type===mf});
    ul.textContent="";$("#mempty").hidden=items.length>0;
    items.forEach(function(m){
      var li=document.createElement("li"),ic=document.createElement("span"),t=document.createElement("div"),b=document.createElement("b"),s=document.createElement("small");
      ic.className="ic";ic.textContent=m.type==="series"?"📺":m.type==="anime"?"🌸":"🎬";ic.setAttribute("aria-hidden","true");
      t.className="t";b.textContent=m.title;s.textContent=SL[m.status]+(m.rating?"  "+"⭐".repeat(m.rating):"");t.appendChild(b);t.appendChild(s);
      if(m.note){var n=document.createElement("small");n.textContent=m.note;t.appendChild(n)}
      if(isEd){
        if(m.status!=="watched"){var w=document.createElement("button");w.className="mini";w.textContent="Mark watched ✅";
          w.onclick=function(){db.doc("watchlog/"+m.id).set({title:m.title,type:m.type,status:"watched",rating:m.rating,note:m.note,createdAt:m.createdAt}).catch(function(){})};t.appendChild(w)}
        var x=document.createElement("button");x.className="mini";x.textContent="×";x.setAttribute("aria-label","Remove");
        x.onclick=function(){db.doc("watchlog/"+m.id).delete().catch(function(){})};t.appendChild(x)}
      li.appendChild(ic);li.appendChild(t);ul.appendChild(li)})
  }
  Array.from(document.querySelectorAll("#mfilter button")).forEach(function(b){b.onclick=function(){
    mf=b.dataset.f;Array.from(document.querySelectorAll("#mfilter button")).forEach(function(o){o.classList.toggle("on",o===b)});drawMovies()}});
  $("#mBtn").onclick=async function(){
    var t=$("#mTitle").value.trim();if(!t||!db)return;
    try{await db.collection("watchlog").add({title:t,type:$("#mType").value,status:$("#mStat").value,rating:+$("#mRate").value,note:$("#mNote").value.trim(),createdAt:Date.now()});
      $("#mTitle").value="";$("#mNote").value=""}catch(e){}
  };
  function drawSched(){
    var box=$("#sched");box.textContent="";
    DAYS.forEach(function(name,i){
      var d=document.createElement("div"),h=document.createElement("h4"),items=tasks.filter(function(t){return t.day===i}).sort(function(a,b){return (a.time||"99:99")<(b.time||"99:99")?-1:1});
      d.className="day"+(i===todayIdx?" today":"");h.textContent=name+(i===todayIdx?" (today)":"");d.appendChild(h);
      if(!items.length){var e=document.createElement("small");e.textContent="Free day 🎉";d.appendChild(e)}
      items.forEach(function(t){
        var r=document.createElement("label"),c=document.createElement("input"),g=document.createElement("div"),sp=document.createElement("span");
        r.className="task"+(t.done?" done":"");c.type="checkbox";c.checked=t.done;c.disabled=!isEd;c.setAttribute("aria-label","Done: "+t.task);
        c.onchange=function(){db.doc("schedule/"+t.id).set({day:t.day,time:t.time,task:t.task,done:c.checked,createdAt:t.createdAt}).catch(function(){})};
        g.className="grow";if(t.time){var tb=document.createElement("b");tb.textContent=t.time;g.appendChild(tb)}
        sp.textContent=t.task;g.appendChild(sp);r.appendChild(c);r.appendChild(g);
        if(isEd){var x=document.createElement("button");x.className="mini";x.style.margin="0";x.textContent="×";x.setAttribute("aria-label","Remove task");
          x.onclick=function(ev){ev.preventDefault();db.doc("schedule/"+t.id).delete().catch(function(){})};r.appendChild(x)}
        d.appendChild(r)});
      box.appendChild(d)})
  }
  $("#tBtn").onclick=async function(){
    var k=$("#tTask").value.trim();if(!k||!db)return;
    try{await db.collection("schedule").add({day:+$("#tDay").value,time:$("#tTime").value,task:k,done:false,createdAt:Date.now()});
      $("#tTask").value="";$("#tTime").value=""}catch(e){}
  };
  $("#tClear").onclick=function(){
    var fin=tasks.filter(function(t){return t.done});if(!fin.length||!confirm("Remove "+fin.length+" finished task(s)?"))return;
    fin.forEach(function(t){db.doc("schedule/"+t.id).delete().catch(function(){})})
  };
  drawSched();

  /* secret party mode */
  function party(){
    var on=document.documentElement.classList.toggle("party");
    $("#hint").textContent=on?"🎉 Party mode ON! Type party (or tap my name 3 times) to stop.":"Party mode off. Come back anytime 🎈";
    if(on)confetti();
  }
  var kb="";
  document.addEventListener("keydown",function(e){
    if(/INPUT|TEXTAREA/.test(e.target.tagName)||!e.key||e.key.length>1)return;
    kb=(kb+e.key).toLowerCase().slice(-5);if(kb==="party"){kb="";party()}
  });
  var taps=0,tt;
  $("#me").onclick=function(){taps++;clearTimeout(tt);tt=setTimeout(function(){taps=0},900);if(taps>=3){taps=0;party()}};

  /* dark mode */
  var dk=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches;
  function th(){document.documentElement.dataset.theme=dk?"dark":"light";$("#theme").textContent=dk?"☀️":"🌙"}
  $("#theme").onclick=function(){dk=!dk;th()};th();
})();