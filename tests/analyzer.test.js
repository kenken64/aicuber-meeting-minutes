import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeMinutes, matchReferences, normalizeActions, csvCell, isOverdue } from '../src/analyzer.js';
import { initialActions, findings, timeline, reconciliation } from '../src/data.js';

const minutes = readFileSync(new URL('../public/sources/meeting-minutes.txt',import.meta.url),'utf8');
const transcript = JSON.parse(readFileSync(new URL('../public/sources/transcript.json',import.meta.url),'utf8'));
const docs = JSON.parse(readFileSync(new URL('../public/sources/documents.json',import.meta.url),'utf8'));

test('supplied summary extracts exactly five owner-labelled next steps and its last topic',()=>{
 const result=analyzeMinutes(minutes);
 assert.equal(result.actions.length,5);
 assert.deepEqual(result.actions.map(a=>a.owner),['Jackson','Kenneth','Kenneth','Kenneth','Lee']);
 assert.equal(result.finalTopic.title,'Chicken Illustration Copyright Concerns');
 for(const a of result.actions)assert.equal(minutes.split('\n')[a.sourceLine-1].trim(),a.evidence);
});
test('raw transcript is not mistaken for structured minutes or unearned action commitments',()=>{
 const result=analyzeMinutes(readFileSync(new URL('../public/sources/full-transcript.txt',import.meta.url),'utf8'));
 assert.equal(result.isTranscript,true);assert.equal(result.finalTopic,null);assert.equal(result.actions.length,0);
});
test('no owner is invented when there is no explicit label',()=>{
 const r=analyzeMinutes('Action items:\n- Send the report.\n- Review contract.\nSummary\nClosing topic\nThe group finished by considering the release schedule and unresolved questions.');
 assert.equal(r.actions.length,2);assert.ok(r.actions.every(a=>a.owner===''));
});
test('supports owner: action and prevents owner verbs from swallowing short actions',()=>{
 const r=analyzeMinutes('Next steps\nAlice: Send report\nBob\nReview proposal\nSummary');
 assert.deepEqual(r.actions.map(a=>[a.owner,a.title]),[['Alice','Send report'],['Bob','Review proposal']]);
});
test('multilingual PDF evidence includes the V2 chicken mention and original license',()=>{
 const results=matchReferences(docs,'ayam 鸡 雞 attribution');
 assert.ok(results.some(r=>r.document.endsWith('_V2.pdf')&&r.page===3&&r.terms.includes('ayam')));
 assert.ok(results.some(r=>r.document==='奶奶的香蕉.pdf'&&r.page===12));
 assert.equal(matchReferences(docs,'nonsensexyz').length,0);
});
test('all curated PDF and transcript references resolve',()=>{
 for(const f of findings){for(const [id,p] of f.refs)assert.ok(docs.find(d=>d.id===id)?.pages[p-1]);if(f.time)assert.ok(transcript.entries.some(e=>e.time===f.time));}
 for(const [t] of timeline)assert.ok(transcript.entries.some(e=>e.time===t),t);
 for(const r of reconciliation)assert.ok(transcript.entries.some(e=>e.time===r.time),r.time);
 assert.equal(transcript.entries.length,2661);
 assert.equal(transcript.entries.at(-1).date,'2026-10-15');
 assert.ok(transcript.entries.find(e=>e.time==='00:58:53').text.includes('no special reason'));
});
test('summary and transcript requests are distinct; recommendations have no invented assignment',()=>{
 assert.equal(initialActions.filter(a=>a.kind==='Recorded').length,5);
 assert.equal(initialActions.filter(a=>a.kind==='Transcript').length,3);
 assert.equal(initialActions.filter(a=>a.kind==='Suggested').length,4);
 assert.ok(initialActions.every(a=>!a.due));
 assert.ok(initialActions.filter(a=>a.kind==='Suggested').every(a=>!a.owner));
 assert.equal(initialActions.find(a=>a.id==='T02').status,'Answered');
 assert.equal(initialActions.find(a=>a.id==='T01').status,'Produced');
});
test('backup validation rejects invalid states and duplicate IDs',()=>{
 assert.equal(normalizeActions(initialActions).length,12);
 assert.throws(()=>normalizeActions([{...initialActions[0],status:'made-up'}]));
 assert.throws(()=>normalizeActions([initialActions[0],initialActions[0]]));
 assert.throws(()=>normalizeActions([{...initialActions[0],due:'tomorrow'}]));
});
test('CSV protects formulas, quotes and multiline notes',()=>{
 assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
 assert.equal(csvCell('hello, "world"\nline'), '"hello, ""world""\nline"');
});
test('undated and completed tasks never become overdue',()=>{
 assert.equal(isOverdue({due:'',status:'Unconfirmed'},'2026-10-19'),false);
 assert.equal(isOverdue({due:'2026-10-18',status:'Done'},'2026-10-19'),false);
 assert.equal(isOverdue({due:'2026-10-18',status:'To do'},'2026-10-19'),true);
});
