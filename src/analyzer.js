// Transparent, deterministic extraction. It does not infer commitments from arbitrary prose.
export function analyzeMinutes(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const isTranscript = /^\d{2}:\d{2}:\d{2}\s*-->\s*\d{2}:\d{2}:\d{2}/m.test(text);
  const clean = (s) => s.replace(/^\s*(?:#{1,6}\s*|[-*•]\s*|\d+[.)]\s*)/, '').trim();
  const isHeader = (s) => /^(?:next steps|action items|actions|follow[- ]?ups)\s*:?$/i.test(clean(s));
  const start = lines.findIndex(isHeader);
  const actions = [];
  let owner = '';
  if (start >= 0) {
    for (let i = start + 1; i < lines.length; i++) {
      const line = clean(lines[i]);
      if (/^(?:summary|discussion|meeting summary|attendees|agenda|decisions)\s*:?$/i.test(line) || /^Attendees\s*:/i.test(line)) break;
      if (!line) continue;
      const named = line.match(/^([^:]{1,60}):\s+(.+)$/);
      if (named && !/^(due|deadline|notes|status)$/i.test(named[1])) {
        actions.push({ title: named[2], owner: named[1].trim(), sourceLine: i + 1, evidence: lines[i].trim() });
      } else if (/^[\p{L}][\p{L}\s’'.-]{0,48}:?$/u.test(line) && line.split(/\s+/).length <= 5 && !/^(consider|provide|integrate|publish|test|review|send|share|confirm|create|complete|update|prepare|schedule|follow|check|build|implement|finish|decide|deliver|draft)\b/i.test(line)) {
        owner = line.replace(/:$/, '').replace(/[’']s$/, '');
      } else {
        actions.push({ title: line, owner, sourceLine: i + 1, evidence: lines[i].trim() });
      }
    }
  }
  const summaryIndex = lines.findIndex((l,i) => i > start && /^summary\s*:?$/i.test(clean(l)));
  const candidates = [];
  for (let i = Math.max(summaryIndex + 1, 0); i < lines.length; i++) {
    const line = clean(lines[i]);
    const prevBlank = i === 0 || !lines[i-1].trim();
    const next = lines.slice(i+1).find(l => l.trim()) || '';
    const explicit = /^(?:#{1,6}\s|\d+[.)]\s)/.test(lines[i]);
    if (line && line.length < 115 && !/[.!?。]$/.test(line) && !/^(attendees|meeting summary|quick recap|next steps|summary|action items|actions|follow[- ]?ups)\b/i.test(line) && (explicit || prevBlank && next.trim().length > line.length + 25)) {
      candidates.push({ title: line, sourceLine: i + 1, index: i });
    }
  }
  const last = candidates.at(-1);
  const finalTopic = last && !isTranscript ? { title: last.title, sourceLine: last.sourceLine, text: lines.slice(last.index+1).join('\n').split(/\nAttendees\s*:/i)[0].trim() } : null;
  return { actions, finalTopic, isTranscript, hasActionSection: start >= 0, wordCount: text.trim().split(/\s+/u).filter(Boolean).length };
}

export function matchReferences(documents, query) {
  const terms = [...new Set(query.toLocaleLowerCase().split(/[\s,;]+/u).filter(Boolean))];
  if (!terms.length) return [];
  return documents.flatMap(doc => doc.pages.flatMap((page,index) => {
    const found = terms.filter(term => page.toLocaleLowerCase().includes(term));
    if (!found.length) return [];
    const at = page.toLocaleLowerCase().indexOf(found[0]);
    return [{ document: doc.name, page: index+1, terms: found, excerpt: page.slice(Math.max(0,at-100),at+260) }];
  }));
}

export const statuses = ['Unconfirmed', 'Proposed', 'Discussed', 'To do', 'In progress', 'Blocked', 'Produced', 'Answered', 'Done'];
export function isOverdue(action, today = new Date().toLocaleDateString('en-CA')) {
  return !!action.due && action.due < today && action.status !== 'Done';
}
export function csvCell(value) {
  let string = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(string)) string = "'" + string;
  return '"' + string.replaceAll('"','""') + '"';
}
export function actionsToCsv(actions) {
  const columns = ['ID','Action','Owner','Origin','Status','Due date','Priority','Source','Proposed completion check','Notes'];
  return [columns, ...actions.map(a=>[a.id,a.title,a.owner,a.kind,a.status,a.due,a.priority,a.source,a.acceptance,a.notes])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function normalizeActions(actions) {
  if (!Array.isArray(actions) || actions.length > 500) throw new Error('Expected up to 500 actions.');
  const seen = new Set();
  return actions.map(a => {
    if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !a.id || typeof a.title !== 'string' || !a.title.trim() || !statuses.includes(a.status) || !['Recorded','Transcript','Suggested','Imported','Manual'].includes(a.kind) || seen.has(a.id)) throw new Error('The action data is invalid.');
    seen.add(a.id);
    const item = Object.fromEntries(['id','title','owner','kind','status','due','priority','topic','source','evidence','acceptance','notes'].map(k=>[k, String(a[k] ?? '').slice(0,10000)]));
    if (item.due && !/^\d{4}-\d{2}-\d{2}$/.test(item.due)) throw new Error('Invalid due date.');
    if (!['Normal','High','Low'].includes(item.priority)) item.priority = 'Normal';
    return item;
  });
}
