import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const origin='https://whale-vote.pages.dev';
const date=new Date().toISOString().replaceAll(':','-');
const folder=new URL('../artifacts/seo-audits/'+date+'/',import.meta.url);
await mkdir(folder,{recursive:true});
// Never replace baseline queries with easier brand/domain probes.
const queries=[
 ['site','discovery','鲸鱼娘 投票 site:whale-vote.pages.dev'],
 ['url','discovery','"whale-vote.pages.dev"'],
 ['topic','nonbrand-topic','DeepSeek 鲸鱼娘 B站 评论区 投票'],
 ['natural','nonbrand-topic','DSH 大肥鱼 自动评论 喜欢 不喜欢 投票 网站'],
 ['brand','brand','你怎么看在b站吃白饭的大肥鱼'],
 ['brand-exact','brand','"你怎么看在b站吃白饭的大肥鱼？"']
];
const summary={time:new Date().toISOString(),timeZone:'Asia/Shanghai',engine:'Tavily',depth:'advanced',limit:10,queries:[],pages:[]};
for(const [name,kind,query] of queries){
 const out=new URL(name+'.json',folder);
 try{
  execFileSync(process.platform==='win32'?'tvly.exe':'tvly',['search',query,'--depth','advanced','--max-results','10','--json','-o',fileURLToPath(out)],{stdio:'ignore',timeout:60000});
  const data=JSON.parse(await readFile(out,'utf8'));
  if(data.error||!Array.isArray(data.results))throw new Error(String(data.error||'Missing results array'));
  const results=data.results.map((r,index)=>({position:index+1,title:r.title,url:r.url}));
  const hits=results.filter(r=>{try{return new URL(r.url).hostname==='whale-vote.pages.dev';}catch{return false;}});
  summary.queries.push({name,kind,query,status:'observed',results,directHits:hits.map(r=>r.url),positions:hits.map(r=>r.position)});
 }catch(e){summary.queries.push({name,kind,query,status:'unavailable',error:String(e)});}
}
for(const path of ['/','/about','/sitemap.xml','/robots.txt','/not-a-page-discovery-audit']){
 try{const r=await fetch(origin+path,{signal:AbortSignal.timeout(15000)});summary.pages.push({path,status:r.status,type:r.headers.get('content-type')});}catch(e){summary.pages.push({path,error:String(e)});}
}
summary.nonbrandTopicHits=summary.queries.filter(q=>q.kind==='nonbrand-topic'&&q.status==='observed'&&q.directHits.length>0).length;
await writeFile(new URL('summary.json',folder),JSON.stringify(summary,null,2));
console.log(JSON.stringify({report:fileURLToPath(folder),queries:summary.queries.map(q=>({query:q.query,kind:q.kind,status:q.status,directHits:q.directHits,positions:q.positions,error:q.error})),nonbrandTopicHits:summary.nonbrandTopicHits,note:'Sampled result positions only. Extraction, brand probes and notification receipts do not prove natural-topic visibility. No hit is not definitive deindexing.'}));
