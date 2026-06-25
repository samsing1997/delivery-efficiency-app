
let state=Storage.load(),map,overlayLayer,waitTimer=null;
const $=id=>document.getElementById(id),euro=n=>'€'+(n||0).toFixed(2),mins=ms=>Math.max(0,Math.round(ms/60000));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const WAIT_MODES={precise:{label:'精准',intervalMin:3,minDistanceM:50},standard:{label:'标准',intervalMin:5,minDistanceM:150},battery:{label:'省电',intervalMin:8,minDistanceM:200}};

function save(){Storage.save(state)}
function nowIso(){return new Date().toISOString()}
function km(a,b){const R=6371,toRad=x=>x*Math.PI/180,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng),q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
function meters(a,b){return km(a,b)*1000}
function getPos(){return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),reject,{enableHighAccuracy:true,timeout:15000,maximumAge:10000}))}
function fmtTime(iso){return new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
function todayOrders(){return state.orders.filter(o=>sameDay(o.finishedAt))}
function todayWaitPoints(){return state.waitPoints.filter(w=>sameDay(w.time))}
function filteredOrders(){if(state.mapRange==='today') return state.orders.filter(o=>sameDay(o.finishedAt)); if(state.mapRange==='7d') return state.orders.filter(o=>daysAgo(o.finishedAt,7)); return state.orders}
function filteredWaitPoints(){if(state.mapRange==='today') return state.waitPoints.filter(w=>sameDay(w.time)); if(state.mapRange==='7d') return state.waitPoints.filter(w=>daysAgo(w.time,7)); return state.waitPoints}
function updateStatus(){let txt='状态：未开始';if(state.shiftStart)txt=`状态：工作中 · 进行中订单 ${state.currentOrders.length} 张 · 等待模式 ${WAIT_MODES[state.waitMode].label}`;$('status').textContent=txt;$('waitModeBtn').textContent=`等待模式：${WAIT_MODES[state.waitMode].label}`}

function shouldRecordWaitPoint(pos){const todays=todayWaitPoints();const last=todays[todays.length-1];if(!last)return true;const mode=WAIT_MODES[state.waitMode];const minsSince=(Date.now()-new Date(last.time).getTime())/60000;const dist=meters(last.pos,pos);return minsSince>=mode.intervalMin && dist>=mode.minDistanceM}
function restartWaitTracking(){if(waitTimer)clearInterval(waitTimer);if(!state.shiftStart)return;const mode=WAIT_MODES[state.waitMode];waitTimer=setInterval(checkAndRecordWaitPoint,mode.intervalMin*60*1000)}
async function checkAndRecordWaitPoint(){if(!state.shiftStart||state.currentOrders.length>0||document.hidden)return;try{const pos=await getPos();if(shouldRecordWaitPoint(pos)){state.waitPoints.push({time:nowIso(),pos});save();render()}}catch(e){}}
function stopWaitTracking(){if(waitTimer)clearInterval(waitTimer);waitTimer=null}
async function startShift(){state.shiftStart=nowIso();save();updateStatus();restartWaitTracking();await checkAndRecordWaitPoint();render()}
function endShift(){state.shiftStart=null;state.currentOrders=[];save();stopWaitTracking();render()}
function cycleWaitMode(){const keys=['precise','standard','battery'];const idx=keys.indexOf(state.waitMode||'standard');state.waitMode=keys[(idx+1)%keys.length];save();updateStatus();restartWaitTracking()}
async function newOrder(){if(!state.shiftStart)return alert('请先开始工作');const platform=prompt('平台：输入 Uber Eats 或 Deliveroo','Uber Eats')||'Uber Eats';const note=prompt('备注（可留空，例如餐厅名 / A单 / B单）','')||'';try{const pos=await getPos();state.currentOrders.push({id:uid(),platform,note,stage:'accepted',acceptedAt:nowIso(),acceptPos:pos});save();render()}catch(e){alert('无法获取定位，请允许 Safari 定位权限')}}
function findOrder(id){return state.currentOrders.find(o=>o.id===id)}
async function pickupOrder(id){const o=findOrder(id);if(!o||o.stage!=='accepted')return;try{const pos=await getPos();o.stage='picked';o.pickedAt=nowIso();o.pickupPos=pos;save();render()}catch(e){alert('无法获取定位')}}
async function finishOrder(id){const o=findOrder(id);if(!o||o.stage!=='picked')return alert('请先对这张订单点“已取餐”');const amount=parseFloat(prompt(`完成 ${o.platform}${o.note?` - ${o.note}`:''}\n输入收入 (€)`,'0')||'0');const tip=parseFloat(prompt('输入小费 (€)，没有就填 0','0')||'0');try{const endPos=await getPos();const finishedAt=nowIso(),acceptToPickupMin=mins(new Date(o.pickedAt)-new Date(o.acceptedAt)),pickupToDropoffMin=mins(new Date(finishedAt)-new Date(o.pickedAt)),totalDurationMin=mins(new Date(finishedAt)-new Date(o.acceptedAt)),leg1=o.acceptPos&&o.pickupPos?km(o.acceptPos,o.pickupPos):0,leg2=o.pickupPos&&endPos?km(o.pickupPos,endPos):0;state.orders.push({platform:o.platform,note:o.note,amount,tip,acceptedAt:o.acceptedAt,pickedAt:o.pickedAt,finishedAt,acceptPos:o.acceptPos,pickupPos:o.pickupPos,endPos,acceptToPickupMin,pickupToDropoffMin,totalDurationMin,leg1Km:leg1,leg2Km:leg2,totalDistanceKm:leg1+leg2});state.currentOrders=state.currentOrders.filter(x=>x.id!==id);save();render()}catch(e){alert('无法获取定位')}}
function cancelOrder(id){if(!confirm('取消并删除这张进行中的订单？'))return;state.currentOrders=state.currentOrders.filter(x=>x.id!==id);save();render()}

function renderActiveOrders(){const box=$('activeOrders');box.innerHTML='';if(!state.currentOrders.length){box.innerHTML='<div class="small">目前没有进行中的订单。</div>';return}state.currentOrders.forEach((o,idx)=>{const div=document.createElement('div');div.className='order-card';div.innerHTML=`<div><div><strong>订单 ${idx+1}</strong> <span class="pill">${o.platform}</span> ${o.note?`<span class="small">· ${o.note}</span>`:''}</div><div class="small">${o.stage==='accepted'?'已接单，未取餐':'已取餐'} · ${fmtTime(o.acceptedAt)}</div></div><div class="order-actions"><button class="mini pick" data-a="pickup" data-id="${o.id}">已取餐</button><button class="mini finish" data-a="finish" data-id="${o.id}">完成订单</button><button class="mini cancel" data-a="cancel" data-id="${o.id}">取消</button></div>`;box.appendChild(div)});box.querySelectorAll('button').forEach(b=>{const id=b.dataset.id;if(b.dataset.a==='pickup')b.onclick=()=>pickupOrder(id);if(b.dataset.a==='finish')b.onclick=()=>finishOrder(id);if(b.dataset.a==='cancel')b.onclick=()=>cancelOrder(id)})}
function renderToday(){const orders=todayOrders(),income=orders.reduce((s,o)=>s+o.amount+o.tip,0),distance=orders.reduce((s,o)=>s+o.totalDistanceKm,0);let workMin=0;if(state.shiftStart)workMin=mins(Date.now()-new Date(state.shiftStart).getTime());else if(orders.length)workMin=mins(new Date(orders[orders.length-1].finishedAt)-new Date(orders[0].acceptedAt));$('todayIncome').textContent=euro(income);$('todayOrders').textContent=orders.length;$('todayWorkTime').textContent=workMin+'m';$('todayHourly').textContent=euro(workMin?income/(workMin/60):0);$('todayDistance').textContent='总距离：'+distance.toFixed(2)+' km';$('todayWaitTime').textContent='等待记录：'+todayWaitPoints().length+' 点';updateStatus();renderActiveOrders()}
function renderHistory(){const list=$('historyList');list.innerHTML='';const orders=state.orders.slice().reverse();if(!orders.length){list.innerHTML='<div class="small">还没有订单记录。</div>';return}orders.forEach(o=>{const wrap=document.createElement('div');wrap.className='history-item';wrap.innerHTML=`<div><div><strong>${o.platform}</strong>${o.note?` · ${o.note}`:''} · ${fmtTime(o.finishedAt)} · ${euro(o.amount+o.tip)}</div><div class="small">${o.totalDurationMin} 分钟 · ${o.totalDistanceKm.toFixed(2)} km</div></div>`;list.appendChild(wrap)})}
function renderAnalysis(){const orders=state.orders,p=analyzePlatform(orders),t=analyzeTime(orders),platformStats=$('platformStats');platformStats.innerHTML='';Object.entries(p).forEach(([name,v])=>{const hourly=v.minutes?v.income/(v.minutes/60):0,row=document.createElement('div');row.className='row';row.innerHTML=`<div><strong>${name}</strong><div class="small">${v.count} 单 · ${v.distance.toFixed(1)} km</div></div><div>${euro(v.income)}<div class="small">${euro(hourly)}/h</div></div>`;platformStats.appendChild(row)});if(!platformStats.innerHTML)platformStats.innerHTML='<div class="small">还没有足够数据。</div>';const timeStats=$('timeStats');timeStats.innerHTML='';Object.entries(t).forEach(([name,v])=>{const hourly=v.minutes?v.income/(v.minutes/60):0,row=document.createElement('div');row.className='row';row.innerHTML=`<div><strong>${name}</strong><div class="small">${v.count} 单 · ${v.distance.toFixed(1)} km</div></div><div>${euro(v.income)}<div class="small">${euro(hourly)}/h</div></div>`;timeStats.appendChild(row)});if(!timeStats.innerHTML)timeStats.innerHTML='<div class="small">还没有足够数据。</div>';renderSpotAnalysis()}

function cellKey(pos){const step=0.003;const lat=Math.round(pos.lat/step)*step;const lng=Math.round(pos.lng/step)*step;return `${lat.toFixed(3)},${lng.toFixed(3)}`}
function renderSpotAnalysis(){const box=$('spotStats');box.innerHTML='';const waits=state.waitPoints, orders=state.orders;if(!waits.length||!orders.length){box.innerHTML='<div class="small">先累积一些等待点和订单数据，才会出现等餐点分析。</div>';return}
  const cells={};
  waits.forEach(w=>{const key=cellKey(w.pos);if(!cells[key])cells[key]={key,waits:0,orders:0,income:0,distance:0,minutes:0,platforms:{},timeBuckets:{}};cells[key].waits++});
  orders.forEach(o=>{
    const nearbyWait = waits.find(w=>Math.abs(new Date(o.acceptedAt)-new Date(w.time))<60*60*1000 && meters(w.pos,o.acceptPos)<400);
    const key = nearbyWait ? cellKey(nearbyWait.pos) : cellKey(o.acceptPos);
    if(!cells[key])cells[key]={key,waits:0,orders:0,income:0,distance:0,minutes:0,platforms:{},timeBuckets:{}};
    const c=cells[key];
    c.orders++; c.income += o.amount+o.tip; c.distance += o.totalDistanceKm||0; c.minutes += o.totalDurationMin||0;
    c.platforms[o.platform]=(c.platforms[o.platform]||0)+1;
    const tb=getTimeBucket(o.finishedAt); c.timeBuckets[tb]=(c.timeBuckets[tb]||0)+1;
  });
  const arr=Object.values(cells).filter(c=>c.waits>0||c.orders>0).map(c=>{
    const avgIncome=c.orders?c.income/c.orders:0, avgDist=c.orders?c.distance/c.orders:0, avgMin=c.orders?c.minutes/c.orders:0;
    const conversion=c.waits?c.orders/c.waits:0;
    const score=Math.round(conversion*45 + avgIncome*4 + Math.max(0,12-avgDist)*2 + Math.max(0,35-avgMin)*0.8);
    const topPlatform=Object.entries(c.platforms).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
    const topTime=Object.entries(c.timeBuckets).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
    return {...c,avgIncome,avgDist,avgMin,conversion,score,topPlatform,topTime};
  }).sort((a,b)=>b.score-a.score).slice(0,8);
  if(!arr.length){box.innerHTML='<div class="small">还没有足够数据。</div>';return}
  arr.forEach((c,idx)=>{
    const row=document.createElement('div');row.className='row';
    row.innerHTML=`<div><strong>#${idx+1} 等餐区 ${c.key}</strong><div class="small">等待 ${c.waits} 次 · 接单 ${c.orders} 单 · ${c.topTime}较强 · ${c.topPlatform}较强</div><div class="small">平均每单 ${euro(c.avgIncome)} · 平均距离 ${c.avgDist.toFixed(1)} km</div></div><div class="score">${c.score} 分</div>`;
    box.appendChild(row);
  });
}

function initMap(){map=L.map('map');overlayLayer=L.layerGroup().addTo(map);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);map.setView([53.3498,-6.2603],12)}
function renderMap(){overlayLayer.clearLayers();const pts=[];const waits=filteredWaitPoints(),orders=filteredOrders();if(state.mapFilters.wait){waits.forEach(w=>{L.circleMarker([w.pos.lat,w.pos.lng],{radius:3,color:'#2563eb'}).addTo(overlayLayer);pts.push([w.pos.lat,w.pos.lng])})}
orders.forEach(o=>{
  if(state.mapFilters.accept && o.acceptPos){L.circleMarker([o.acceptPos.lat,o.acceptPos.lng],{radius:5,color:'#2563eb'}).addTo(overlayLayer);pts.push([o.acceptPos.lat,o.acceptPos.lng])}
  if(state.mapFilters.pickup && o.pickupPos){L.circleMarker([o.pickupPos.lat,o.pickupPos.lng],{radius:5,color:'#16a34a'}).addTo(overlayLayer);pts.push([o.pickupPos.lat,o.pickupPos.lng])}
  if(state.mapFilters.dropoff && o.endPos){L.circleMarker([o.endPos.lat,o.endPos.lng],{radius:6,color:'#dc2626'}).addTo(overlayLayer).bindPopup(`${o.platform} · ${euro(o.amount+o.tip)}`);pts.push([o.endPos.lat,o.endPos.lng])}
  if(state.mapFilters.route){const line=[];if(o.acceptPos)line.push([o.acceptPos.lat,o.acceptPos.lng]);if(o.pickupPos)line.push([o.pickupPos.lat,o.pickupPos.lng]);if(o.endPos)line.push([o.endPos.lat,o.endPos.lng]);if(line.length>=2)L.polyline(line).addTo(overlayLayer)}
}); if(pts.length)map.fitBounds(pts,{padding:[30,30]})}

function render(){renderToday();renderHistory();renderAnalysis();renderMap()}
function setupTabs(){document.querySelectorAll('.nav-btn').forEach(btn=>{btn.onclick=()=>{document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');document.getElementById('tab-'+btn.dataset.tab).classList.add('active');if(btn.dataset.tab==='map')setTimeout(()=>map.invalidateSize(),50)}})}
function setupMapControls(){document.querySelectorAll('.filter-btn').forEach(btn=>{const key=btn.dataset.filter;if(state.mapFilters[key])btn.classList.add('active');else btn.classList.remove('active');btn.onclick=()=>{state.mapFilters[key]=!state.mapFilters[key];save();btn.classList.toggle('active');renderMap()}});document.querySelectorAll('.range-btn').forEach(btn=>{if(btn.dataset.range===state.mapRange)btn.classList.add('active');btn.onclick=()=>{state.mapRange=btn.dataset.range;save();document.querySelectorAll('.range-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderMap()}})}
document.addEventListener('DOMContentLoaded',()=>{initMap();setupTabs();setupMapControls();$('startShiftBtn').onclick=startShift;$('endShiftBtn').onclick=endShift;$('newOrderBtn').onclick=newOrder;$('waitModeBtn').onclick=cycleWaitMode;if(state.shiftStart)restartWaitTracking();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));render()});
