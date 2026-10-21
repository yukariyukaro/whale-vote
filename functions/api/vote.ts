import {type Env,json,hmac,ipOf,networkOf,getOrCreateVoter,tally,bumpRate} from "./_utils";
export const onRequestPost=async({request,env}:{request:Request;env:Env})=>{
 try {
  if(!env.DB||!env.VOTE_SALT)return json({error:"not_configured"},503);
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return json({error:"origin"},403);
  if(Number(request.headers.get("content-length")||0)>4096)return json({error:"bad_request"},413);
  const body:any=await request.json().catch(()=>null);if(!body||!["left","right"].includes(body.side))return json({error:"bad_request"},400);
  const current=await tally(env);if(current.frozen)return json({error:"frozen",...current},503);
  const ip=ipOf(request);if(!ip)return json({error:"network_unavailable"},503);
  const voter=await getOrCreateVoter(request,env);const headers:Record<string,string>={};if(voter.setCookie)headers["set-cookie"]=voter.setCookie;
  const voterId=await hmac(env.VOTE_SALT,"voter:"+voter.id);
  const networkKey=await hmac(env.VOTE_SALT,"poll:v2:network:"+networkOf(ip));
  const duplicate:any=await env.DB.prepare("SELECT voter_id FROM votes WHERE voter_id=? OR network_key=? LIMIT 1").bind(voterId,networkKey).first();
  if(duplicate)return json({ok:true,counted:false,reason:"already_voted",...current},200,headers);
  const minute=Math.floor(Date.now()/60000);const rateKey=await hmac(env.VOTE_SALT,"attempt:"+networkOf(ip));
  if(await bumpRate(env,rateKey,minute*60000)>10)return json({error:"rate_limited"},429,headers);
  const result:any=await env.DB.prepare("INSERT OR IGNORE INTO votes(voter_id,side,created_at,country,network_key) VALUES(?,?,?,?,?)").bind(voterId,body.side,Date.now(),"",networkKey).run();
  const counted=result.meta?.changes===1;
  if(!counted&&voter.setCookie)delete headers["set-cookie"];
  const latest=await tally(env).catch(()=>({...current,...(counted?{[body.side]:current[body.side]+1,total:current.total+1}:{})}));
  return json({ok:true,counted,...(!counted?{reason:"already_voted"}:{}),...latest},200,headers);
 }catch(e){console.error("vote failed",e);return json({error:"service_unavailable"},503);}
};
