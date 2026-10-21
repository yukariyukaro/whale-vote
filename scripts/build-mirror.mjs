import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
const out = new URL('../dist/github-pages/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL('../public/', import.meta.url), out, { recursive: true });
for (const file of ['index.html','about.html']) {
 const target = new URL(file, out);
 const text = await readFile(target,'utf8');
 await writeFile(target,text.replace('content="index,follow,max-image-preview:large"','content="noindex,follow"'));
}
await writeFile(new URL('robots.txt',out),'User-agent: *\nAllow: /\n');
await rm(new URL('sitemap.xml',out),{force:true});
console.log('Static mirror: noindex, canonical URLs point to production.');
