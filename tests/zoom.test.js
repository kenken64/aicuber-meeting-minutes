import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleZoomRequest, seal, unseal, hash, encodeMeetingUuid, safeZoomUrl, validateDateRange } from '../server/zoom.mjs';
import { recordingWindows, mergeMeetings, transcriptToText } from '../src/zoom-model.js';
const base='https://minutes.test';
const alice={userId:'alice'}, bob={userId:'bob'};
function environment() {
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_tiresome_skin.sql',import.meta.url),'utf8'));
  const prepare=sql=>({bind(...values){return {first:async()=>db.prepare(sql).get(...values)||null,run:async()=>db.prepare(sql).run(...values)}}});
  return {APP_ORIGIN:base,ZOOM_CLIENT_ID:'fixture-id',ZOOM_CLIENT_SECRET:'fixture-secret',ZOOM_TOKEN_KEY:btoa('0'.repeat(32)),ZOOM_WEBHOOK_SECRET:'fixture-webhook',DB:{prepare,batch:async statements=>{db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}},db};
}
async function connected(env,user=alice,zoomId='zoom-alice',expired=false) {
  const tokens={access_token:'access-'+user.userId,refresh_token:'refresh-'+user.userId,expires_in:3600};
  env.db.prepare('INSERT INTO zoom_connections VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)').run(user.userId,zoomId,user.userId,user.userId+'@test.invalid',await seal(tokens,env,user.userId),Date.now()+(expired?-1000:3600000));
  return hash(user.userId+':'+zoomId);
}
async function req(env,path,options={},user=alice,fetcher=()=>{throw new Error('Unexpected external call')}) {
  return handleZoomRequest(new Request(base+'/api/zoom/'+path,{...options,headers:{Origin:base,...options.headers}}),env,user,fetcher);
}
const reply=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
test('setup required is honest; no credentials or tokens are returned',async()=>{
  const r=await req({},'status',{},null);assert.equal(r.status,200);assert.equal((await r.json()).configured,false);
  assert.equal((await req({},'meetings')).status,503);
});
test('OAuth requires identity and same-origin POST',async()=>{
  const env=environment();assert.equal((await req(env,'connect',{method:'POST'},null)).status,401);
  assert.equal((await req(env,'connect',{method:'POST',headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await req(env,'connect')).status,404);
});
test('OAuth state is bound to browser and owner and consumed once',async()=>{
  const env=environment();const start=await req(env,'connect',{method:'POST'});const url=new URL(start.headers.get('Location'));const state=url.searchParams.get('state');const cookie=start.headers.get('Set-Cookie').split(';')[0];
  assert.ok(start.headers.get('Set-Cookie').includes('HttpOnly; Secure; SameSite=Lax'));
  let calls=0;const fetcher=async url=>{calls++;return String(url).includes('/oauth/token')?reply({access_token:'secret-access',refresh_token:'secret-refresh',expires_in:3600}):reply({id:'zoom-alice',display_name:'Alice',email:'alice@test.invalid'});};
  const path='callback?state='+state+'&code=one-time-code';
  assert.match((await req(env,path,{headers:{Cookie:cookie}},bob,fetcher)).headers.get('Location'),/invalid_state/);assert.equal(calls,0);
  assert.match((await req(env,path,{},alice,fetcher)).headers.get('Location'),/invalid_state/);assert.equal(calls,0);
  assert.match((await req(env,path,{headers:{Cookie:cookie}},alice,fetcher)).headers.get('Location'),/zoom_connected/);assert.equal(calls,2);
  assert.match((await req(env,path,{headers:{Cookie:cookie}},alice,fetcher)).headers.get('Location'),/invalid_state/);assert.equal(calls,2);
  const status=await (await req(env,'status')).text();assert.ok(!status.includes('secret-access'));assert.ok(!status.includes('secret-refresh'));
  assert.ok(!env.db.prepare('SELECT token_cipher FROM zoom_connections').get().token_cipher.includes('secret'));
});
test('expired and declined OAuth requests never exchange tokens',async()=>{
  const env=environment();const start=await req(env,'connect',{method:'POST'});const state=new URL(start.headers.get('Location')).searchParams.get('state');const cookie=start.headers.get('Set-Cookie').split(';')[0];
  env.db.exec('UPDATE zoom_oauth_states SET expires_at=1');assert.match((await req(env,'callback?state='+state+'&code=test',{headers:{Cookie:cookie}})).headers.get('Location'),/invalid_state/);
});
test('encrypted tokens cannot be read for another owner or modified',async()=>{
  const env=environment();const sealed=await seal({access_token:'private'},env,'alice');assert.equal((await unseal(sealed,env,'alice')).access_token,'private');
  await assert.rejects(unseal(sealed,env,'bob'));await assert.rejects(unseal(sealed.slice(0,-3)+'abc',env,'alice'));
});
test('account isolation blocks missing identity and stale browser account',async()=>{
  const env=environment();const key=await connected(env);await connected(env,bob,'zoom-bob');
  assert.equal((await req(env,'meetings',{},null)).status,401);
  assert.equal((await req(env,'meetings',{headers:{'X-Workspace-Key':key}},bob)).status,409);
  assert.equal((await req(env,'meetings')).status,409);
});
test('meeting list uses me, preserves pagination, and hides sensitive provider fields',async()=>{
  const env=environment();const key=await connected(env);let called;
  const response=await req(env,'meetings?pageToken=next%2Bpage',{headers:{'X-Workspace-Key':key}},alice,async(url,opts)=>{called=String(url);assert.equal(opts.headers.Authorization,'Bearer access-alice');return reply({meetings:[{id:1,uuid:'one',topic:'Design',start_url:'secret-host-url',join_url:'javascript:alert(1)'}],next_page_token:'next-page',total_records:2});});
  const body=await response.json();assert.ok(called.includes('/users/me/meetings'));assert.ok(called.includes('next_page_token=next%2Bpage'));assert.equal(body.nextPageToken,'next-page');assert.equal(body.meetings[0].url,null);assert.ok(!JSON.stringify(body).includes('secret-host'));
});
test('expired access tokens rotate under a database lock',async()=>{
  const env=environment();const key=await connected(env,alice,'zoom-alice',true);let refreshes=0;
  const response=await req(env,'meetings',{headers:{'X-Workspace-Key':key}},alice,async(url,opts)=>{if(String(url).includes('/oauth/token')){refreshes++;assert.equal(new URLSearchParams(opts.body).get('refresh_token'),'refresh-alice');return reply({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600});}assert.equal(opts.headers.Authorization,'Bearer new-access');return reply({meetings:[]});});
  assert.equal(response.status,200);assert.equal(refreshes,1);const row=env.db.prepare('SELECT * FROM zoom_connections').get();assert.equal((await unseal(row.token_cipher,env,'alice')).refresh_token,'new-refresh');assert.equal(row.refresh_owner,null);
});
test('a refresh in another worker is not replayed',async()=>{
  const env=environment();const key=await connected(env,alice,'zoom-alice',true);env.db.prepare('UPDATE zoom_connections SET refresh_owner=?, refresh_until=?').run('other',Date.now()+30000);
  const r=await req(env,'meetings',{headers:{'X-Workspace-Key':key}});assert.equal(r.status,409);assert.equal(r.headers.get('Retry-After'),'2');
});
test('rate limits preserve retry timing',async()=>{
  const env=environment();const key=await connected(env);const r=await req(env,'meetings',{headers:{'X-Workspace-Key':key}},alice,async()=>reply({},429,{'Retry-After':'45'}));assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'45');
});
test('transcript import verifies recording owner and never trusts a caller download URL',async()=>{
  const env=environment();const key=await connected(env);let calls=0;
  const options={method:'POST',headers:{'X-Workspace-Key':key,'Content-Type':'application/json'},body:JSON.stringify({meetingUuid:'/abc//==',fileId:'file',download_url:'https://evil.test/'})};
  const r=await req(env,'transcript',options,alice,async(url)=>{calls++;assert.ok(String(url).includes('%252Fabc%252F%252F'));return reply({host_id:'someone-else',recording_files:[]});});assert.equal(r.status,403);assert.equal(calls,1);
});
test('transcript redirect never sends credentials to a non-Zoom host',async()=>{
  const env=environment();const key=await connected(env);const calls=[];
  const r=await req(env,'transcript',{method:'POST',headers:{'X-Workspace-Key':key,'Content-Type':'application/json'},body:JSON.stringify({meetingUuid:'uuid',fileId:'f'})},alice,async url=>{calls.push(String(url));return String(url).includes('api.zoom.us')?reply({host_id:'zoom-alice',recording_files:[{id:'f',recording_type:'audio_transcript',status:'completed',download_url:'https://us02web.zoom.us/rec/download/a'}]}):new Response(null,{status:302,headers:{Location:'https://evil.test/steal'}});});assert.equal(r.status,422);assert.equal(calls.length,2);
});
test('disconnect removes stored tokens even when upstream revoke fails',async()=>{
  const env=environment();const key=await connected(env);const r=await req(env,'disconnect',{method:'POST',headers:{'X-Workspace-Key':key}},alice,async()=>reply({},503));assert.equal(r.status,200);assert.equal((await r.json()).revoked,false);assert.equal(env.db.prepare('SELECT count(*) n FROM zoom_connections').get().n,0);
});
test('unsigned webhooks cannot delete connections',async()=>{
  const env=environment();await connected(env);const r=await req(env,'webhook',{method:'POST',body:JSON.stringify({event:'app_deauthorized',payload:{user_id:'zoom-alice'}})},null);assert.equal(r.status,401);assert.equal(env.db.prepare('SELECT count(*) n FROM zoom_connections').get().n,1);
});
test('recording date windows cover leap days without gaps or overlap',()=>{
  const windows=recordingWindows('2024-01-01','2024-03-31');const days=[];for(const w of windows){validateDateRange(w.from,w.to);for(let d=Date.parse(w.from);d<=Date.parse(w.to);d+=86400000)days.push(d);}assert.equal(days.length,91);assert.equal(new Set(days).size,91);assert.throws(()=>validateDateRange('2024-02-30','2024-03-01'));assert.throws(()=>recordingWindows('2024-02-30','2024-03-01'));
});
test('recurring recording instances remain distinct and VTT preserves all speech',()=>{
  const meetings=mergeMeetings([{kind:'recording',id:'1',uuid:'a'}],[{kind:'recording',id:'1',uuid:'b'},{kind:'recording',id:'1',uuid:'a',topic:'Updated'}]);assert.equal(meetings.length,2);
  const text=transcriptToText('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nAlice: 中文\n\n2\n00:00:02.000 --> 00:00:03.000\nBob: Next step');assert.ok(text.includes('[00:00:01.000] Alice: 中文'));assert.ok(text.includes('Bob: Next step'));
  assert.equal(encodeMeetingUuid('a/b'), 'a%2Fb');assert.equal(safeZoomUrl('https://zoom.us.evil.test/a'),null);
});
