import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const origin='https://whale-vote.pages.dev';
const date=new Date().toISOString().replaceAll(':','-');
const folder=new URL('../artifacts/seo-audits/'+date+'/',import.meta.url);
await mkdir(folder,{recursive:true});
const queries=[
 ['site','鲸鱼娘 投票 site:whale-vote.pages.dev'],
 ['url','"whale-vote.pages.dev"'],
 ['topic','DeepSeek 鲸鱼娘 B站 评论区 投票'],
 ['natural','DSH 大肥鱼 自动评论 喜欢 不喜欢 投票 网站']
];
const summary={time:new Date().toISOString(),queries:[],pages:[]};
for(const [name,query] of queries){
 const out=new URL(name+'.json',folder);
 try{
  execFileSync(process.platform==='win32'?'tvly.exe':'tvly',['search',query,'--depth','advanced','--max-results','10','--json','-o',out.pathname.replace(/^\/([A-Za-z]:)/,'$1')],{stdio:'ignore',timeout:60000});
  const data=JSON.parse(await readFile(out,'utf8'));
  summary.queries.push({name,query,results:(data.results||[]).map((r,index)=>({position:index+1,title:r.title,url:r.url})),directHits:(data.results||[]).filter(r=>new URL(r.url).hostname==='whale-vote.pages.dev').map(r=>r.url)});
 }catch(e){summary.queries.push({name,query,error:String(e)});}
}
for(const path of ['/','/about','/sitemap.xml','/robots.txt','/not-a-page-discovery-audit']){
 try{const r=await fetch(origin+path);summary.pages.push({path,status:r.status,type:r.headers.get('content-type')});}catch(e){summary.pages.push({path,error:String(e)});}
}
await writeFile(new URL('summary.json',folder),JSON.stringify(summary,null,2));
console.log(JSON.stringify({report:folder.pathname,queries:summary.queries.map(q=>({query:q.query,directHits:q.directHits,error:q.error})),note:'No hit in this sample is not definitive deindexing. Search visibility is not extraction success.'}));
