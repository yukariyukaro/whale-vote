import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let checks=0;
for(const [file,url] of [['index.html','https://whale-vote.pages.dev/'],['about.html','https://whale-vote.pages.dev/about']]){
 const html=await readFile('public/'+file,'utf8');
 assert.match(html,/<html lang="zh-CN">/);checks++;
 assert.equal((html.match(/<h1[ >]/g)||[]).length,1);checks++;
 assert.match(html,/<meta name="description" content="[^"]{30,}"/);checks++;
 assert.ok(html.includes('<link rel="canonical" href="'+url+'">'));checks++;
 assert.ok(html.includes('<meta property="og:url" content="'+url+'">'));checks++;
 assert.match(html,/<meta name="robots" content="index,follow,max-image-preview:large">/);checks++;
 const ld=JSON.parse(html.split('<script type="application/ld+json">')[1].split('</script>')[0]);
 assert.equal(ld['@context'],'https://schema.org');checks++;
 assert.ok(!JSON.stringify(ld).includes('aggregateRating'));checks++;
 const mirror=await readFile('dist/github-pages/'+file,'utf8');
 assert.ok(mirror.includes('content="noindex,follow"'));checks++;
 assert.ok(mirror.includes('<link rel="canonical" href="'+url+'">'));checks++;
}
const app=await readFile('public/app.js','utf8');
assert.ok(!/turnstile|challenges.cloudflare.com|freshToken|captcha/i.test(app));checks++;
const vote=await readFile('functions/api/vote.ts','utf8');
assert.ok(!/verifyTurnstile|TURNSTILE_SECRET|captcha/.test(vote));checks++;
const robots=await readFile('public/robots.txt','utf8');assert.ok(robots.includes('Sitemap: https://whale-vote.pages.dev/sitemap.xml'));checks++;
const sitemap=await readFile('public/sitemap.xml','utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,2);checks++;
console.log(JSON.stringify({ok:true,checks}));
