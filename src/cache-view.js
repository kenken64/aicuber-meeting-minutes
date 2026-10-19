import { meetingCache, cacheState } from './meeting-cache.js';
export function createCacheView({ esc, icon, badge, heading, redraw, toast, download, restore, retry }) {
  const state = { loaded: false, busy: false, error: '', rows: [], stats: null, query: '', selected: null };
  const paint = () => { if (location.hash === '#cache') redraw(); };
  async function refresh() {
    state.busy = true; state.error = '';
    try { [state.rows, state.stats] = await Promise.all([meetingCache.list(state.query), meetingCache.stats()]); state.loaded = true; }
    catch (error) { state.error = error.message; state.loaded = true; }
    finally { state.busy = false; paint(); }
  }
  function invalidate() { state.loaded = false; state.selected = null; }
  function view() {
    if (!state.loaded && !state.busy && cacheState.status === 'ready') { state.busy = true; queueMicrotask(refresh); }
    const selected = state.selected;
    return heading('SAVED LIBRARY', 'Your meeting memory, on this device.', 'Search cached meetings, full minutes and transcripts, and saved analysis without fetching them again.') +
      `<div class="notice">${icon('shield')}<div><strong>DuckDB runs in your browser.</strong> Content is saved to this browser’s private file storage, separated by workspace. It stays on this device and survives reloads. Export a backup before clearing browser data. Zoom credentials are never stored here.</div></div>` +
      (cacheState.status === 'error' ? `<div class="notice amber" role="alert">${esc(cacheState.error)} <button class="button" data-cache-action="retry">Retry cache</button></div>` : cacheState.status !== 'ready' ? '<p class="empty" role="status">Opening the browser database…</p>' :
      `<div class="cache-toolbar"><span class="badge green">DuckDB · saved on this device</span><button class="button" data-cache-action="refresh">${icon('search')}Refresh library</button><button class="button" data-cache-action="export">${icon('download')}Export cache</button><button class="button" data-cache-action="clear">Clear this workspace’s cache</button></div>${state.stats ? `<div class="cache-counts"><div><strong>${state.stats.meetings}</strong><span>Meeting records</span></div><div><strong>${state.stats.minutes}</strong><span>Minutes & transcripts</span></div><div><strong>${state.stats.analyses}</strong><span>Saved analyses</span></div></div>` : ''}<form id="cache-search" class="filter-bar"><label class="search-field">${icon('search')}<input name="query" aria-label="Search cached content" placeholder="Search titles, minutes, and analysis text…" value="${esc(state.query)}"/></label><button class="button primary">Search cache</button></form>${state.error ? `<div class="notice amber" role="alert">${esc(state.error)}</div>` : ''}${state.busy ? '<p role="status" class="subtle-note">Reading the local database…</p>' : ''}<section class="panel cache-list">${state.rows.map(row => `<article class="cache-item"><div>${badge(row.type === 'minutes' ? 'Minutes / transcript' : row.type === 'analysis' ? 'Analysis' : 'Meeting', row.type === 'analysis' ? 'green' : 'neutral')}<h3>${esc(row.title)}</h3><p>Cached ${esc(new Date(row.saved_at).toLocaleString())}</p></div><button class="button" data-cache-action="open" data-type="${row.type}" data-id="${esc(row.id)}">Open ${icon('arrow')}</button></article>`).join('') || '<p class="empty">No cached items match this search. Fetch Zoom meetings or analyze a TXT file to add content.</p>'}</section>`) +
      (selected ? `<section class="panel cache-detail"><div class="panel-title"><h2>${esc(selected.title)}</h2><button class="icon-button" data-cache-action="close" aria-label="Close cached item">${icon('close')}</button></div><div class="cache-toolbar">${selected.type !== 'meeting' ? '<button class="button primary" data-cache-action="restore">Open in workspace</button>' : ''}<button class="button" data-cache-action="download">${icon('download')}Download item</button></div><pre>${esc(selected.content || JSON.stringify(selected.data, null, 2))}</pre></section>` : '');
  }
  async function click(button) {
    try {
      const action = button.dataset.cacheAction;
      if (action === 'retry') { await retry(); invalidate(); await refresh(); }
      if (action === 'refresh') await refresh();
      if (action === 'export') download('minutes-browser-cache.json', JSON.stringify(await meetingCache.export(), null, 2), 'application/json');
      if (action === 'clear' && confirm('Delete all cached meeting records, minutes, transcripts, and analyses for this workspace on this device? Export a cache backup first if you need a copy.')) { await meetingCache.clear(); invalidate(); await refresh(); toast('This workspace’s browser cache was cleared.'); }
      if (action === 'open') { state.selected = { ...await meetingCache.read(button.dataset.type, button.dataset.id), type: button.dataset.type }; paint(); document.querySelector('.cache-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      if (action === 'close') { state.selected = null; paint(); }
      if (action === 'download' && state.selected) download('cached-meeting-' + state.selected.type + (state.selected.content ? '.txt' : '.json'), state.selected.content || JSON.stringify(state.selected.data, null, 2));
      if (action === 'restore' && state.selected) await restore(state.selected);
    } catch (error) { state.error = error.message; paint(); toast('Cache operation could not complete: ' + error.message); }
  }
  async function submit(form) { state.query = new FormData(form).get('query') || ''; await refresh(); }
  return { view, click, submit, invalidate, refresh };
}
