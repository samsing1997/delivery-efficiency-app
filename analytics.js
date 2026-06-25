
function sameDay(iso,date=new Date()){return new Date(iso).toDateString()===date.toDateString()}
function daysAgo(iso,n){return (Date.now()-new Date(iso).getTime())<=n*86400000}
function getTimeBucket(dateStr){const h=new Date(dateStr).getHours();if(h>=6&&h<11)return'早餐';if(h>=11&&h<15)return'午餐';if(h>=15&&h<18)return'下午';if(h>=18&&h<22)return'晚餐';return'夜间'}
function analyzePlatform(orders){const by={};orders.forEach(o=>{if(!by[o.platform])by[o.platform]={income:0,count:0,minutes:0,distance:0};by[o.platform].income+=o.amount+o.tip;by[o.platform].count++;by[o.platform].minutes+=o.totalDurationMin||0;by[o.platform].distance+=o.totalDistanceKm||0});return by}
function analyzeTime(orders){const by={};orders.forEach(o=>{const k=getTimeBucket(o.finishedAt);if(!by[k])by[k]={income:0,count:0,minutes:0,distance:0};by[k].income+=o.amount+o.tip;by[k].count++;by[k].minutes+=o.totalDurationMin||0;by[k].distance+=o.totalDistanceKm||0});return by}
