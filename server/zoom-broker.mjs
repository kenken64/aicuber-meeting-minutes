import { createHash } from 'node:crypto';
import { encode } from './marketplace.mjs';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const json = (data,status=200) => Response.json(data,{status,headers});
const hash = value => createHash('sha256').update(value).digest('base64url');

export async function handleBrokeredZoomRequest(request,env,claims,fetcher=fetch) {
  try {
    if(!claims?.user_id)return json({error:'Launch Meeting Minutes from 2ndBrain.',code:'sign_in_required'},401);
    const base = new URL(env.MARKETPLACE_LAUNCH_VERIFY_URL);
    if(base.protocol!=='https:')throw new Error('Invalid integration origin');
    const manageUrl = new URL('/dashboard/settings?tab=integrations',base).href;
    const endpoint = new URL('/api/integrations/zoom/delegate',base).href;
    const url = new URL(request.url),path=url.pathname.replace(/^\/api\/zoom\//,'');
    const delegate = async body => {
      const r=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+encode(claims)},body:JSON.stringify(body),cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(30000)});
      const data=await r.json();return {r,data};
    };
    if(path==='status'&&request.method==='GET') {
      const {r,data}=await delegate({operation:'status'});if(!r.ok)return json(data,r.status);
      const profile=data.connected?data.profile:null;
      return json({configured:data.configured,connected:data.connected,authenticated:true,visitor:{name:claims.email||'Your workspace',email:claims.email||''},profile,manageUrl,connectionId:data.connectionId,signInPath:manageUrl,signOutPath:'/api/2ndbrain/signout',setupIssues:data.configured?[]:[{key:'ZOOM_CONNECTION',message:'Finish Zoom setup in 2ndBrain Marketplace → Connected apps.'}],cacheKey:data.cacheKey || hash('cache:'+claims.user_id),workspaceKey:profile?data.workspaceKey:null});
    }
    if(['connect','disconnect','settings'].includes(path))return json({error:'Manage your Zoom connection in 2ndBrain.',code:'manage_in_2ndbrain',manageUrl},409);
    if(!['meetings','recordings','transcript'].includes(path)||request.method!==(path==='transcript'?'POST':'GET'))return json({error:'Endpoint not found.'},404);
    if(path==='transcript'&&request.headers.get('Origin')!==new URL(env.APP_ORIGIN).origin)return json({error:'Use your Meeting Minutes workspace.',code:'invalid_origin'},403);
    // Resolve the current owner-bound connection on every operation; never trust a browser user ID.
    const status=await delegate({operation:'status'});if(!status.r.ok)return json(status.data,status.r.status);
    if(!status.data.connected)return json({error:'Connect Zoom in 2ndBrain.',code:'reconnect_required'},401);
    if(request.headers.get('X-Workspace-Key')!==status.data.workspaceKey)return json({error:'Your Zoom connection changed. Check the connection again.',code:'connection_changed'},409);
    let body={};
    if(path==='transcript'){
      if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Expected JSON.'},415);
      const reader=request.body?.getReader();if(!reader)return json({error:'Missing transcript selection.'},400);
      const chunks=[];let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return json({error:'Request too large.'},413);}chunks.push(value);}}finally{reader.releaseLock();}
      try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return json({error:'Invalid JSON.'},400);}
    }
    const payload={operation:path,connectionId:status.data.connectionId,kind:url.searchParams.get('kind')||'scheduled',pageToken:url.searchParams.get('pageToken')||'',from:url.searchParams.get('from'),to:url.searchParams.get('to'),...(path==='transcript'?{meetingUuid:body?.meetingUuid,fileId:body?.fileId}:{})};
    const result=await delegate(payload);
    return new Response(JSON.stringify(result.data),{status:result.r.status,headers:{...headers,'Content-Type':'application/json',...(result.data.retryAfter?{'Retry-After':String(result.data.retryAfter)}:{})}});
  }catch{return json({error:'The 2ndBrain Zoom connection service is unavailable. Your saved meetings are kept.',code:'integration_unavailable'},503);}
}
