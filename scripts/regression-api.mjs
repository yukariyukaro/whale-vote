import assert from 'node:assert/strict';
const base=process.env.TEST_BASE||'http://127.0.0.1:8792';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)||new URL(base).protocol!=='http:')throw new Error('Local-only test; never modifies production ballots');
const run=Date.now().toString(16).slice(-6);
let checks=0;
async function vote(ip,cookie='',side='left',extra={}){
 const r=await fetch(base+'/api/vote',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip,...(cookie?{cookie}:{}),...extra},body:JSON.stringify({side})});
 return {status:r.status,body:await r.json(),cookie:(r.headers.get('set-cookie')||'').split(';')[0]};
}
const ip='2001:db8:'+run.slice(0,3)+':'+run.slice(3)+':1::1';
const first=await vote(ip);assert.equal(first.body.counted,true);checks++;
const second=await vote(ip);assert.equal(second.body.counted,false);checks++;
assert.equal(second.body.total,first.body.total);checks++;
const rotate=await vote(ip.replace(':1::1',':2::9'));assert.equal(rotate.body.counted,false);checks++;
const moved=await vote('203.0.113.99',first.cookie);assert.equal(moved.body.counted,false);checks++;
const network='2001:db8:'+run.slice(0,3)+':'+run.slice(3)+':abcd::2';
const p=await fetch(base+'/api/participation',{headers:{'cf-connecting-ip':network}}).then(r=>r.json());assert.equal(p.hasVoted,true);assert.equal(p.ownSide,undefined);checks++;
const batchIp='2001:db8:'+run.slice(0,3)+':'+(parseInt(run.slice(3),16)+1).toString(16)+'::1';
const batch=await Promise.all(Array.from({length:8},()=>vote(batchIp)));
assert.equal(batch.filter(r=>r.body.counted===true).length,1);checks++;
const invalid=await vote('192.0.2.6','','neither');assert.equal(invalid.status,400);checks++;
const foreign=await vote('192.0.2.7','','left',{origin:'https://attacker.invalid'});assert.equal(foreign.status,403);checks++;
console.log(JSON.stringify({ok:true,checks,firstTotal:first.body.total,afterSameNetwork:second.body.total,concurrentCounted:batch.filter(r=>r.body.counted).length}));
