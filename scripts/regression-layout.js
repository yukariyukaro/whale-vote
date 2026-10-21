async page => {
 const cases=[[1366,768],[1440,900],[1280,720],[390,844],[375,667],[320,568]];
 const output=[];
 for(const [width,height] of cases){
  await page.setViewportSize({width,height});
  await page.goto('http://127.0.0.1:8794/');
  await page.locator('.art img').first().waitFor();
  await page.evaluate(()=>Promise.all(Array.from(document.images).map(i=>i.decode())));
  const result=await page.evaluate(()=>{
   const r=document.querySelector('.feedback').getBoundingClientRect();
   const art=document.querySelector('.art').getBoundingClientRect();
   return {width:innerWidth,height:innerHeight,feedbackTop:Math.round(r.top),feedbackBottom:Math.round(r.bottom),visible:r.top>=0&&r.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,imageFit:getComputedStyle(document.querySelector('.art img')).objectFit,artHeight:Math.round(art.height)};
  });
  if(!result.visible||result.overflow)throw new Error(JSON.stringify(result));
  await page.screenshot({path:'artifacts/fixed-'+width+'x'+height+'.png',scale:'css'});
  output.push(result);
 }
 return output;
}