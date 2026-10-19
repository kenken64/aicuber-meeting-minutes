export function recordingWindows(from, to) {
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(from) || !valid(to) || from > to) throw new Error('Choose valid start and end dates.');
  if (Date.parse(to) - Date.parse(from) > 10 * 366 * 86400000) throw new Error('Search up to ten years at a time; choose an earlier range for older recordings.');
  const windows = []; let end = Date.parse(to); const start = Date.parse(from);
  while (end >= start) { const first = Math.max(start, end - 27 * 86400000); windows.push({ from: new Date(first).toISOString().slice(0, 10), to: new Date(end).toISOString().slice(0, 10) }); end = first - 86400000; }
  return windows;
}
export function mergeMeetings(current, incoming) {
  const map = new Map(current.map(m => [m.kind + ':' + m.uuid, m]));
  for (const m of incoming) map.set(m.kind + ':' + m.uuid, m);
  return [...map.values()].sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));
}
export function transcriptToText(text) {
  if (!text.replace(/^\uFEFF/, '').trimStart().startsWith('WEBVTT')) return text;
  return text.replace(/^\uFEFF/, '').replace(/^WEBVTT[^\n]*\n/, '').split(/\r?\n\r?\n/).map(block => {
    const lines = block.split(/\r?\n/); const at = lines.findIndex(line => line.includes('-->'));
    if (at < 0) return '';
    const timestamp = lines[at].split('-->')[0].trim();
    return `[${timestamp}] ${lines.slice(at + 1).join('\n')}`;
  }).filter(Boolean).join('\n\n');
}
