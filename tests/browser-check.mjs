import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1080},acceptDownloads:true});
const page=await context.newPage();
page.setDefaultTimeout(12000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.MINUTES_BASE_URL||'http://127.0.0.1:5173';
try{
 await page.goto(base);await page.getByRole('heading',{name:'A conversation, brought into focus.'}).waitFor();
 await page.screenshot({path:resolve('../.work/desktop.png'),fullPage:true});
 const reportEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export report'}).click();const report=await reportEvent;await report.saveAs(resolve('../meeting-review-and-follow-ups.txt'));
 await page.locator('nav a[href="#actions"]').click();
 await page.locator('[data-edit="A01"]').first().click();await page.locator('#action-form [name="status"]').selectOption('In progress');await page.locator('#action-form [name="notes"]').fill('Browser verification <b>must stay text</b>');await page.getByRole('button',{name:'Save changes'}).click();
 console.log('Edited first action');
 await page.reload();await page.locator('[data-edit="A01"]').first().click();assert.equal(await page.locator('#action-form [name="status"]').inputValue(),'In progress');assert.equal(await page.locator('#action-form [name="notes"]').inputValue(),'Browser verification <b>must stay text</b>');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByLabel('Filter by owner').selectOption('Lee');await page.getByRole('button',{name:'Filter',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),1);
 await page.getByLabel('Filter by owner').selectOption('');await page.getByRole('button',{name:'Filter',exact:true}).click();
 await page.getByRole('button',{name:'Draft follow-up'}).click();assert.ok((await page.getByLabel('Follow-up message').inputValue()).includes('00:58:53'));await page.getByRole('button',{name:'Close draft'}).click();
 const csvEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export all as CSV'}).click();assert.ok((await csvEvent).suggestedFilename().endsWith('.csv'));
 console.log('Persistence, filtering and exports passed');
 await page.getByRole('link',{name:'Storybook review',exact:true}).click();await page.getByRole('heading',{name:'A small detail. A fuller story.'}).waitFor();
 await page.screenshot({path:resolve('../.work/review.png'),fullPage:true});
 await page.locator('a[href="#sources/v2/14"]').first().click();await page.locator('iframe').waitFor();assert.equal(await page.getByLabel('PDF page').inputValue(),'14');assert.ok((await page.locator('.page-text').innerText()).includes('Ursula Nafula'));
 await page.getByLabel('Search all PDFs').fill('ayam');await page.getByRole('button',{name:'Search PDFs',exact:true}).click();assert.ok((await page.locator('.search-results').innerText()).includes('Version 2 · p. 3'));
 await page.getByRole('link',{name:'Full transcript',exact:true}).click();await page.getByLabel('Search transcript',{exact:true}).fill('chicken');await page.getByRole('button',{name:'Search transcript',exact:true}).click();assert.ok(await page.locator('.utterance').count()>0);
 await page.locator('a[href="#transcript/00:58:53"]').first().click();await page.locator('.utterance.highlight').waitFor();assert.ok((await page.locator('.utterance.highlight').innerText()).includes('no special reason'));
 console.log('PDF references and transcript navigation passed');
 await page.getByRole('link',{name:'Analyze new files'}).click();await page.locator('#minutes-upload').setInputFiles(resolve('public/sources/meeting-minutes.txt'));await page.locator('#pdf-upload').setInputFiles(resolve('public/sources/Rahsia_Pisang_Nenek_Edisi_Sinematik_Melayu_V2.pdf'));await page.getByRole('button',{name:'Analyze files',exact:true}).click();await page.getByRole('heading',{name:'5 extracted action candidates'}).waitFor({timeout:60000});assert.ok((await page.locator('.analysis-result').last().innerText()).includes('ayam'));
 await page.getByRole('button',{name:'Add candidates to tracker'}).click();await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===17);assert.equal(await page.locator('tbody tr').count(),17);
 await page.getByRole('link',{name:'Analyze new files'}).click();await page.locator('#minutes-upload').setInputFiles(resolve('public/sources/full-transcript.txt'));await page.getByRole('button',{name:'Analyze files',exact:true}).click();await page.getByRole('heading',{name:'0 extracted action candidates'}).waitFor({timeout:60000});assert.ok((await page.locator('.analysis-result').first().innerText()).includes('No reliable section heading found'));
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/#overview');await page.getByRole('heading',{name:'A conversation, brought into focus.'}).waitFor();await page.screenshot({path:resolve('../.work/mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 for(const route of ['actions','review','transcript/00:58:53','sources/v2/14','analyze']){await page.goto(base+'/#'+route);await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow: '+route);}
 assert.deepEqual(errors,[]);console.log('Browser checks passed: source navigation, transcript evidence, editing/persistence, filtering, drafts, CSV/report exports, real PDF/TXT extraction, importing, and mobile layout.');
}catch(error){await page.screenshot({path:resolve('../.work/browser-error.png'),fullPage:true});console.error((await page.locator('main').innerText()).slice(-6000));throw error;}finally{await browser.close();}
