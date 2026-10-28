// Exercise the actual standalone server against a local HTTPS 2ndBrain fixture.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createHmac, randomBytes } from 'node:crypto';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { createServer as createPortProbe } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const root=await mkdtemp(join(tmpdir(),'minutes-deployment-'));
const secret=randomBytes(32).toString('hex');
let child,verifier,logs='',connected=true,sessionActive=true,workspace='fixture-workspace';
try{
  await cp('.next/standalone',root,{recursive:true});
  await cp('.next/static',join(root,'.next/static'),{recursive:true});
  await cp('public',join(root,'public'),{recursive:true});
  const key=join(root,'fixture.key'),cert=join(root,'fixture.crt');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
  verifier=createServer({key:await readFile(key),cert:await readFile(cert)},async(request,response)=>{
    response.setHeader('Content-Type','application/json');
    if(request.url.endsWith('/verify')){response.end(JSON.stringify({active:sessionActive}));return;}
    let raw='';for await(const chunk of request)raw+=chunk;
    const body=JSON.parse(raw);
    if(body.operation==='status')response.end(JSON.stringify({configured:true,connected,connectionId:'opaque-fixture',workspaceKey:workspace,cacheKey:'fixture-cache',profile:{name:'Zoom Fixture',email:'zoom@example.test'}}));
    else response.end(JSON.stringify({meetings:[{id:'fixture',topic:'Fixture meeting'}],nextPageToken:''}));
  });
  verifier.listen(0,'127.0.0.1');await once(verifier,'listening');
  const probe=createPortProbe();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:'production',HOSTNAME:'0.0.0.0',PORT:String(port),APP_ORIGIN:'https://minutes.example.test',NODE_EXTRA_CA_CERTS:cert,MEETING_MINUTES_SESSION_SECRET:secret,MARKETPLACE_LAUNCH_VERIFY_URL:`https://127.0.0.1:${verifier.address().port}/api/marketplace/launch-session/verify`,MARKETPLACE_LAUNCH_VERIFY_SECRET:secret},stdio:['ignore','pipe','pipe']});
  for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{logs+=data;});
  let healthy=false;
  for(let n=0;n<100;n++){
    try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)});assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ok'});healthy=true;break;}catch{await delay(100);}if(child.exitCode!==null)break;
  }
  assert.ok(healthy,logs);
  assert.equal((await fetch(base)).status,401);
  assert.equal((await fetch(base+'/api/zoom/status')).status,401);
  const now=Math.floor(Date.now()/1000);
  const data=[{alg:'HS256',typ:'JWT'},{iss:'2ndBrain.ceo',tool_id:'meeting-minutes',user_id:'fixture-user',install_id:'fixture-install',email:'primary@example.test',iat:now,exp:now+300}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  const token=data+'.'+createHmac('sha256',secret).update(data).digest('base64url');
  const launch=await fetch(base+'/api/2ndbrain/launch?launch_token='+token,{redirect:'manual',headers:{host:'0.0.0.0:8080','x-forwarded-host':'minutes.example.test','x-forwarded-proto':'https'}});assert.equal(launch.status,303);
  assert.equal(launch.headers.get('location'),'/','Launch must redirect relative to the public browser origin');
  const headers={cookie:launch.headers.get('set-cookie').split(';')[0]};
  const page=await fetch(base,{headers});assert.equal(page.status,200);const html=await page.text();assert.match(html,/Loading your meeting workspace/);
  const chunk=html.match(/src="([^" ]+\.js)"/)[1];
  for(const path of [chunk,'/duckdb/duckdb-eh-1.32.0.wasm.gz','/pdfjs/pdf.worker.min.mjs','/sources/documents.json']){const r=await fetch(new URL(path,base),{headers});assert.equal(r.status,200,path);assert.ok((await r.arrayBuffer()).byteLength>0,path);}
  const status=await(await fetch(base+'/api/zoom/status',{headers})).json();assert.equal(status.connected,true);assert.equal(status.visitor.email,'primary@example.test');assert.equal(status.profile.email,'zoom@example.test');
  const serverPid=child.pid;
  let r=await fetch(base+'/api/zoom/meetings',{headers:{...headers,'X-Workspace-Key':workspace}});assert.equal(r.status,200);assert.equal((await r.json()).meetings[0].id,'fixture');
  workspace='changed-workspace';assert.equal((await fetch(base+'/api/zoom/meetings',{headers:{...headers,'X-Workspace-Key':status.workspaceKey}})).status,409);
  connected=false;assert.equal((await(await fetch(base+'/api/zoom/status',{headers})).json()).connected,false);
  assert.equal((await fetch(base+'/api/zoom/meetings',{headers:{...headers,'X-Workspace-Key':workspace}})).status,401);
  assert.equal(child.pid,serverPid,'Connection changes need no restart');
  sessionActive=false;assert.equal((await fetch(base,{headers})).status,401);
  console.log('Deployment smoke passed: standalone health/assets, marketplace identity, HTTPS Zoom delegation, connection changes without restart, and session revocation.');
}finally{
  if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');const kill=setTimeout(()=>child.kill('SIGKILL'),5000);try{await exited;}finally{clearTimeout(kill);}}
  if(verifier)await new Promise(resolve=>verifier.close(resolve));
  await rm(root,{recursive:true,force:true});
}
