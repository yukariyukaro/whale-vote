import ipaddr from "ipaddr.js";
export interface Env { DB?: any; VOTE_SALT?: string; }
const encoder = new TextEncoder();
export function json(data: unknown, status = 200, headers: Record<string,string> = {}): Response {
 return new Response(JSON.stringify(data), {status, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex, nofollow",...headers}});
}
export async function hmac(secret:string,data:string):Promise<string> {
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(data)));
 return btoa(String.fromCharCode(...sig)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
export function ipOf(request:Request):string { return request.headers.get("cf-connecting-ip") || ""; }
export async function participation(request:Request,env:Env):Promise<any> {
 if(!env.DB||!env.VOTE_SALT)throw new Error("not_configured");
 const ip=ipOf(request);if(!ip)throw new Error("network_unavailable");
 const voter=await getOrCreateVoter(request,env);
 const voterId=await hmac(env.VOTE_SALT,"voter:"+voter.id);
 const networkKey=await hmac(env.VOTE_SALT,"poll:v2:network:"+networkOf(ip));
 const row=await env.DB.prepare("SELECT side FROM votes WHERE voter_id=? LIMIT 1").bind(voterId).first();
 if(row)return {hasVoted:true,ownSide:row.side};
 const networkRow=await env.DB.prepare("SELECT 1 FROM votes WHERE network_key=? LIMIT 1").bind(networkKey).first();
 return {hasVoted:Boolean(networkRow)};
}
// IPv4 uses the public address; IPv6 uses /64 to resist privacy-address rotation.
export function networkOf(ip:string):string {
 if(!ipaddr.isValid(ip))throw new Error("invalid_network");
 const address=ipaddr.process(ip);
 if(address.kind()==="ipv4")return address.toString();
 return address.toByteArray().slice(0,8).map(n=>n.toString(16).padStart(2,"0")).join("")+"/64";
}
function safeEqual(a:string,b:string):boolean {
 if(a.length!==b.length)return false;
 let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;
}

export async function getOrCreateVoter(request:Request,env:Env):Promise<{id:string;setCookie:string|null}> {
 const secret=env.VOTE_SALT!;
 const raw=(request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("whale_voter="))?.slice(12);
 if(raw){const dot=raw.lastIndexOf(".");const id=raw.slice(0,dot);if(dot>0&&/^[a-f0-9]{32}$/.test(id)&&safeEqual(await hmac(secret,id),raw.slice(dot+1)))return {id,setCookie:null};}
 const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");
 const sig=await hmac(secret,id);
 return {id,setCookie:`whale_voter=${id}.${sig}; Path=/; HttpOnly${new URL(request.url).protocol==="https:"?"; Secure":""}; SameSite=Lax; Max-Age=31536000`};
}
export async function tally(env:Env):Promise<any>{
 if(!env.DB)throw new Error("db_unavailable");
 const rows:any=await env.DB.prepare("SELECT side, COUNT(*) AS n FROM votes GROUP BY side").all();let left=0,right=0;
 for(const r of rows.results||[]){if(r.side==="left")left=Number(r.n);if(r.side==="right")right=Number(r.n);}
 const meta:any=await env.DB.prepare("SELECT value FROM meta WHERE key='freeze'").first();
 return {left,right,total:left+right,frozen:meta?.value==="1",updatedAt:Date.now()};
}
export async function bumpRate(env:Env,key:string,now:number):Promise<number>{
 const row:any=await env.DB.prepare("INSERT INTO rate(key,count,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate.window_start=excluded.window_start THEN rate.count+1 ELSE 1 END,window_start=excluded.window_start RETURNING count").bind(key,now).first();const count=Number(row?.count);if(!Number.isSafeInteger(count)||count<1)throw new Error("rate_unavailable");return count;
}