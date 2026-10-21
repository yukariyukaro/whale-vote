async page => {
 const browser=page.context().browser();
 const ip='2001:db8:'+Math.floor(Date.now()/1000).toString(16).slice(-4)+':42::1';
 const contexts=[];
 const make=async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'cf-connecting-ip':ip}});contexts.push(context);
   return context;
 };
 try {
  const a=await make();const p=await a.newPage();await p.goto('http://127.0.0.1:8794');
  await p.waitForFunction(()=>!document.querySelector('button[data-choice]').disabled);
  const before=await a.request.get('http://127.0.0.1:8794/api/tally').then(r=>r.json());
  await p.locator('[data-choice=left]').click();
  await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('已经投过票'));
  if(await p.locator('[data-choice=left] .sr-only').count()!==1)throw new Error('Button accessibility label lost');
  const b=await make();const q=await b.newPage();await q.goto('http://127.0.0.1:8794');
  await q.waitForFunction(()=>document.querySelector('#status').textContent.includes('已经投过票'));
  if(!(await q.locator('[data-choice=right]').isDisabled()))throw new Error('Second browser still enabled');
  const after=await b.request.get('http://127.0.0.1:8794/api/tally').then(r=>r.json());
  if(after.total!==before.total+1)throw new Error('Network counted twice');
  await q.screenshot({path:'artifacts/cross-browser-already-voted.png'});
  return {ok:true,independentBrowserContexts:2,captchaRequests:0,secondBrowserAlreadyVoted:true,totalDelta:after.total-before.total};
 }finally{for(const c of contexts)await c.close();}
}