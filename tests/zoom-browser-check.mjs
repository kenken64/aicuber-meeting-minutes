import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.MINUTES_BASE_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
let navigation=0;
const go=async route=>{await page.goto(base+'/?check='+ ++navigation +'#'+route);await page.locator('main h1').waitFor();};
const ready=async()=>{await page.getByText('DuckDB · saved on this device',{exact:true}).waitFor({timeout:60000});await page.locator('.cache-item').first().waitFor();};
try{
 await go('zoom');await page.getByRole('link',{name:/Open the Zoom setup guide/}).waitFor();
 await go('cache');await ready();assert.equal(await page.locator('.cache-item').count(),3);
 await page.screenshot({path:'../.work/duckdb-library.png'});
 await page.getByRole('link',{name:'Analyze new files'}).click();
 const raw='Meeting minutes\n\nNext steps\nAlice: Send the revised outline\nBob: Review the draft\n';
 await page.locator('#minutes-upload').setInputFiles({name:'Private local review.txt',mimeType:'text/plain',buffer:Buffer.from(raw)});
 await page.getByRole('button',{name:'Analyze files',exact:true}).click();await page.getByRole('heading',{name:'2 extracted action candidates'}).waitFor();
 await page.getByRole('link',{name:'Saved library',exact:true}).click();await ready();await page.getByRole('heading',{name:'Private local review.txt · Analysis',exact:true}).waitFor();
 await page.reload();await ready();await page.getByRole('heading',{name:'Private local review.txt · Analysis',exact:true}).waitFor();
 await page.locator('.cache-item').filter({hasText:'Private local review.txt · Analysis'}).getByRole('button',{name:'Open',exact:true}).click();
 await page.getByRole('button',{name:'Open in workspace',exact:true}).click();await page.getByRole('heading',{name:'2 extracted action candidates'}).waitFor();
 console.log('Real DuckDB OPFS: seeded full source data, cached uploaded minutes and analysis, survived reload, reopened analysis.');
 let account='account-a',recordingCalls=0,transcriptCalls=0,rateLimited=false;
 const records=[{id:'111',uuid:'instance-a',topic:'Team review <img src=x onerror=alert(1)>',startTime:'2026-10-14T14:05:00Z',duration:40,kind:'recording',files:[{id:'fa',status:'completed'}],url:null},{id:'111',uuid:'instance-b',topic:'Team review, second occurrence',startTime:'2026-10-13T14:05:00Z',duration:30,kind:'recording',files:[{id:'fb',status:'completed'}],url:null}];
 await context.route('**/api/zoom/**',async route=>{
   const url=new URL(route.request().url());const respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.pathname.endsWith('/status'))return respond({configured:true,authenticated:true,connected:true,profile:{name:account,email:account+'@example.invalid'},workspaceKey:'workspace-'+account,cacheKey:account,signOutPath:'/signout-with-chatgpt?return_to=%2F%23zoom'});
   if(url.pathname.endsWith('/recordings')){recordingCalls++;if(url.searchParams.get('pageToken')==='second'&&!rateLimited){rateLimited=true;return respond({error:'Fixture rate limit',code:'rate_limited',retryAfter:1},429);}if(url.searchParams.get('pageToken')==='second')return respond({meetings:[records[1]],nextPageToken:''});return respond({meetings:[records[0]],nextPageToken:'second'});}
   if(url.pathname.endsWith('/transcript')){transcriptCalls++;return respond({title:'Zoom '+JSON.parse(route.request().postData()).fileId,startTime:'2026-10-14',text:'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nAlice: Keep every word. 中文\n'});}
   if(url.pathname.endsWith('/meetings'))return respond({meetings:[{...records[0],kind:'meeting',files:[]}],nextPageToken:''});
   return respond({error:'Unexpected fixture request'},400);
 });
 await go('cache');await ready();assert.equal(await page.locator('.cache-item').count(),3);assert.equal(await page.getByText('Private local review.txt · Analysis',{exact:true}).count(),0);
 await page.getByRole('link',{name:'Zoom meetings',exact:true}).click();await page.getByText('Zoom connected',{exact:true}).waitFor();
 await page.locator('#zoom-dates [name="from"]').fill('2026-10-01');await page.locator('#zoom-dates [name="to"]').fill('2026-10-20');
 await page.getByRole('button',{name:/Fetch all in date range/}).click();await page.getByText('Fixture rate limit',{exact:false}).waitFor();assert.equal(await page.locator('.zoom-meeting').count(),1);
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Resume search',exact:true}).click();await page.getByText(/Search complete · 2 available recordings/).waitFor();assert.equal(await page.locator('.zoom-meeting').count(),2);assert.equal(await page.locator('.zoom-meeting img').count(),0);
 await page.getByRole('button',{name:'Cache available transcripts',exact:true}).click();await page.getByText(/Transcript cache complete · 2 saved/).waitFor();assert.equal(transcriptCalls,2);
 await page.getByRole('button',{name:'Cache available transcripts',exact:true}).click();await page.getByText(/Transcript cache complete · 0 saved · 2 already cached/).waitFor();assert.equal(transcriptCalls,2);
 await page.getByRole('link',{name:'Saved library',exact:true}).click();await ready();await page.getByRole('heading',{name:'Zoom fa',exact:true}).waitFor();
 await page.locator('.cache-item').filter({has:page.getByRole('heading',{name:'Zoom fa',exact:true})}).getByRole('button',{name:'Open',exact:true}).click();assert.ok((await page.locator('.cache-detail').innerText()).includes('[00:00:01.000] Alice: Keep every word. 中文'));
 await page.reload();await ready();assert.equal(await page.locator('.cache-item').count(),7);
 await page.getByRole('link',{name:'Zoom meetings',exact:true}).click();await page.locator('.zoom-meeting').first().waitFor();assert.equal(await page.locator('.zoom-meeting').count(),2);assert.equal(recordingCalls,3);
 console.log('Mock Zoom: paginated sync, 429 resume, recurring-instance deduplication, bulk transcript caching, cache hits, escaped provider text, and cached meeting reopen passed.');
 account='account-b';await go('cache');await ready();assert.equal(await page.locator('.cache-item').count(),3);assert.equal(await page.getByRole('heading',{name:'Zoom fa',exact:true}).count(),0);
 account='account-a';await page.reload();await ready();assert.equal(await page.locator('.cache-item').count(),7);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export cache',exact:true}).click();assert.equal((await download).suggestedFilename(),'minutes-browser-cache.json');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});for(const route of ['cache','zoom','analyze']){await page.evaluate(r=>{location.hash=r},route);await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow at '+width);}if(width===390){await page.evaluate(()=>{location.hash='cache'});await page.screenshot({path:'../.work/duckdb-mobile.png'});}}
 await page.evaluate(()=>{location.hash='cache'});page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Clear this workspace’s cache',exact:true}).click();await page.getByText('No cached items match this search.',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);console.log('Account partitioning, export, clear, and desktop/mobile layouts passed. Live Zoom OAuth remains unverified without credentials.');
}catch(error){console.error('UI:',(await page.locator('body').innerText()).slice(-6000));console.error('Page errors:',errors);await page.screenshot({path:'../.work/zoom-browser-error.png'});throw error;}finally{await browser.close();}
