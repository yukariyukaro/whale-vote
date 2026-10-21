import {type Env,json,participation} from "./_utils";
export const onRequestGet=async({request,env}:{request:Request;env:Env})=>{
 try{return json(await participation(request,env));}catch{return json({error:"service_unavailable"},503);}
};
