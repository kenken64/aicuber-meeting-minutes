import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBrokeredZoomRequest } from '../server/zoom-broker.mjs';
import { decode } from '../server/marketplace.mjs';
const env={APP_ORIGIN:'https://minutes.test',MARKETPLACE_LAUNCH_VERIFY_URL:'https://brain.test/api/marketplace/launch-session/verify'};
const now=Math.floor(Date.now()/1000);
const claims={iss:'2ndBrain.ceo',tool_id:'meeting-minutes',user_id:'alice',install_id:'installed',email:'original@example.test',iat:now,exp:now+300};
process.env.MEETING_MINUTES_SESSION_SECRET='x'.repeat(32);

test('Zoom delegation is server-side, preserves marketplace identity, and updates without restarts',async()=>{
  let connected=true,workspace='workspace-alice',seen=[];
  const fetcher=async(url,options)=>{
    assert.equal(url,'https://brain.test/api/integrations/zoom/delegate');
    assert.deepEqual(decode(options.headers.Authorization.replace('Bearer ','')),claims);
    const body=JSON.parse(options.body);seen.push(body);
    if(body.operation==='status')return Response.json({configured:true,connected,connectionId:'opaque-connection',workspaceKey:workspace,cacheKey:'cache-alice',profile:{name:'Zoom Alice',email:'zoom@example.test'}});
    if(body.operation==='meetings')return Response.json({meetings:[{id:'one'}],nextPageToken:''});
    if(body.operation==='recordings')return Response.json({error:'Zoom is limiting requests.',code:'rate_limited',retryAfter:45},{status:429});
    return Response.json({text:'Transcript'});
  };
  const req=(path,options={},c=claims)=>handleBrokeredZoomRequest(new Request(env.APP_ORIGIN+'/api/zoom/'+path,options),env,c,fetcher);
  let r=await req('status'),status=await r.json();assert.equal(status.visitor.email,claims.email);assert.equal(status.profile.email,'zoom@example.test');assert.match(status.manageUrl,/brain.test\/dashboard\/settings/);assert.ok(!JSON.stringify(status).includes('refresh_token'));
  assert.equal((await req('meetings')).status,409);
  r=await req('meetings',{headers:{'X-Workspace-Key':workspace}});assert.equal(r.status,200);assert.equal((await r.json()).meetings[0].id,'one');
  r=await req('recordings?from=2026-01-01&to=2026-01-28',{headers:{'X-Workspace-Key':workspace}});assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'45');
  assert.equal((await req('transcript',{method:'POST',headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await req('settings')).status,409);assert.equal((await req('webhook',{method:'POST'})).status,404);
  connected=false;assert.equal((await (await req('status')).json()).connected,false);assert.equal((await req('meetings',{headers:{'X-Workspace-Key':workspace}})).status,401);
  connected=true;workspace='workspace-another-zoom-account';assert.equal((await req('meetings',{headers:{'X-Workspace-Key':'workspace-alice'}})).status,409);
  assert.equal((await req('status',{},null)).status,401);
  assert.ok(seen.every(body=>!('userId' in body)));
});

test('broker errors fail closed and never fall back to local Zoom credentials',async()=>{
  const r=await handleBrokeredZoomRequest(new Request(env.APP_ORIGIN+'/api/zoom/status'),{...env,ZOOM_CLIENT_ID:'ignored',ZOOM_CLIENT_SECRET:'ignored'},claims,async()=>{throw new Error('network');});assert.equal(r.status,503);assert.ok(!(await r.text()).includes('ignored'));
});
