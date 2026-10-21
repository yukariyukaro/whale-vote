async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result=[];
 for(const [width,height] of [[1366,768],[390,844],[375,667]]){
  await page.setViewportSize({width,height});await page.goto('https://whale-vote.pages.dev/');
  await page.waitForFunction(()=>document.querySelector('#left-count').textContent!=='—');
  await page.evaluate(()=>Promise.all(Array.from(document.images).map(i=>i.decode())));
  const metrics=await page.evaluate(()=>{const r=document.querySelector('.feedback').getBoundingClientRect();return {w:innerWidth,h:innerHeight,feedbackBottom:Math.round(r.bottom),feedbackVisible:r.top>=0&&r.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,status:document.querySelector('#status').textContent};});
  if(!metrics.feedbackVisible||metrics.overflow)throw new Error(JSON.stringify(metrics));
  await page.screenshot({path:'artifacts/live-fixed-'+width+'x'+height+'.png'});result.push(metrics);
 }
 const tally=await page.request.get('https://whale-vote.pages.dev/api/tally').then(r=>r.json());
 const participation=await page.request.get('https://whale-vote.pages.dev/api/participation').then(r=>r.json());
 const invalid=await page.request.post('https://whale-vote.pages.dev/api/vote',{data:{side:'invalid'}});
 if(invalid.status()!==400)throw new Error('Invalid ballot was not rejected');
 const captchaScripts=await page.locator('script[src*="challenges.cloudflare.com"]').count();
 if(captchaScripts)throw new Error('CAPTCHA script still loaded');
 return {result,tally,participation,invalidStatus:invalid.status(),captchaScripts,pageErrors:errors};
}
