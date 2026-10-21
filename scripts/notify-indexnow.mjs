// The IndexNow key is a public ownership proof, not an API credential.
import {readFile,readdir} from 'node:fs/promises';
const origin='https://whale-vote.pages.dev';
const files=await readdir(new URL('../public/',import.meta.url));
const keyFile=files.find(f=>/^[a-f0-9]{32}[.]txt$/.test(f));
if(!keyFile)throw new Error('Missing IndexNow ownership proof');
const key=(await readFile(new URL('../public/'+keyFile,import.meta.url),'utf8')).trim();
const proof=await fetch(origin+'/'+keyFile);if(!proof.ok||(await proof.text()).trim()!==key)throw new Error('Deploy ownership file before notification');
const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify({host:new URL(origin).hostname,key,keyLocation:origin+'/'+keyFile,urlList:[origin+'/',origin+'/about']})});
console.log(JSON.stringify({endpoint:'https://api.indexnow.org/indexnow',status:response.status,meaning:response.status===200?'Notification received, indexing not guaranteed':response.status===202?'Notification received, ownership validation pending':'Notification not accepted',body:(await response.text()).slice(0,500)}));
if(![200,202].includes(response.status))process.exitCode=1;
