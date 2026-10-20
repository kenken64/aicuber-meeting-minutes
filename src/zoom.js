import { meetingCache, cacheState } from './meeting-cache.js';
import { recordingWindows, mergeMeetings, transcriptToText } from './zoom-model.js';

export function createZoomFeature({ esc, icon, badge, heading, redraw, toast, importTranscript, switchWorkspace, cacheUpdated }) {
  const now = new Date(), yearAgo = new Date(now); yearAgo.setUTCFullYear(now.getUTCFullYear() - 1);
  const state = { status: null, statusError: '', busy: false, error: '', meetings: [], recordings: [], from: yearAgo.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), tab: 'recordings', search: '', progress: '', scan: null, nextPage: '', loaded: false, retryAt: 0 };
  let controller, generation = 0, workspaceKey, cacheKey;
  const paint = () => { if (location.hash.startsWith('#zoom')) redraw(); };
  async function request(path, options = {}) {
    const response = await fetch('/api/zoom/' + path, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { ...(workspaceKey ? { 'X-Workspace-Key': workspaceKey } : {}), ...options.headers } });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'Zoom could not complete this request.'); error.code = data.code; error.retryAfter = data.retryAfter; throw error; }
    return data;
  }
  async function loadStatus() {
    state.statusError = '';
    try {
      const status = await request('status');
      if (workspaceKey !== status.workspaceKey) { cancel(); state.meetings = []; state.recordings = []; state.loaded = false; state.scan = null; workspaceKey = status.workspaceKey;  }
      state.status = status;
      if (cacheKey !== status.cacheKey || cacheState.status !== 'ready') {
        cacheKey = status.cacheKey;
        await switchWorkspace(workspaceKey, cacheKey);
        if (status.connected && cacheState.status === 'ready') {
          const cached = await meetingCache.meetings();
          state.recordings = cached.filter(m => m.kind === 'recording');
          state.meetings = cached.filter(m => m.kind === 'meeting');
          if (cached.length) { state.loaded = true; state.progress = 'Showing cached meetings from this device. Fetch again to check Zoom for updates.'; }
        }
      }
    } catch { state.statusError = 'The Zoom connection service is unavailable. Retry to check your connection.'; if(cacheState.status==='idle'){cacheState.status='error';cacheState.error='Reload the page to verify your workspace before opening its cache.';} }
    paint();
  }
  function cancel() { generation++; controller?.abort(); state.busy = false; }
  function failure(error) {
    if (error.name === 'AbortError') return;
    state.error = error.message;
    if (error.retryAfter) state.retryAt = Date.now() + error.retryAfter * 1000;
    if (error.code === 'reconnect_required' || error.code === 'sign_in_required' || error.code === 'connection_changed') { state.status.connected = false; state.scan = null; state.meetings = []; state.recordings = []; state.loaded = false; void switchWorkspace(null, null); }
  }
  function start() {
    if (state.busy) return false;
    if (!state.status?.connected || state.statusError) { state.error = 'Connect your Zoom account before fetching meetings.'; paint(); return false; }
    if (Date.now() < state.retryAt) { state.error = `Zoom asked us to wait. Try again in ${Math.ceil((state.retryAt - Date.now()) / 1000)} seconds.`; paint(); return false; }
    state.error = ''; state.busy = true; controller = new AbortController(); return ++generation;
  }
  async function scanRecordings(resume = false) {
    const run = start(); if (!run) return;
    try {
      if (!resume || !state.scan) state.scan = { windows: recordingWindows(state.from, state.to), index: 0, token: '', seen: [], pages: 0, results: [] };
      const scan = state.scan;
      while (scan.index < scan.windows.length) {
        const window = scan.windows[scan.index];
        state.progress = `Searching ${window.from} to ${window.to} · window ${scan.index + 1} of ${scan.windows.length} · ${scan.results.length} recordings found`; paint();
        const query = new URLSearchParams({ ...window, pageToken: scan.token });
        const data = await request('recordings?' + query, { signal: controller.signal }); if (run !== generation) return;
        await cacheMeetings(data.meetings);
        scan.results = mergeMeetings(scan.results, data.meetings); state.recordings = scan.results; state.loaded = true;
        scan.pages++;
        if (data.nextPageToken && (scan.seen.includes(data.nextPageToken) || scan.pages > 500)) throw new Error('Zoom pagination did not finish. The results shown are incomplete; narrow the date range and search again.');
        if (data.nextPageToken) { scan.seen.push(data.nextPageToken); scan.token = data.nextPageToken; }
        else { scan.index++; scan.token = ''; scan.seen = []; scan.pages = 0; }
      }
      state.progress = `Search complete · ${state.recordings.length} available recordings from ${state.from} to ${state.to}`; state.scan = null;
    } catch (error) { if (run === generation) failure(error); }
    finally { if (run === generation) { state.busy = false; paint(); } }
  }
  async function loadMeetings(more = false, all = false) {
    const run = start(); if (!run) return;
    const kind = state.tab; let token = more ? state.nextPage : ''; let results = more ? state.meetings : []; const seen = new Set();
    try {
      do {
        const query = new URLSearchParams({ kind: kind === 'invited' ? 'invited' : 'scheduled', pageToken: token });
        state.progress = `Fetching ${kind === 'invited' ? 'upcoming & invited' : 'hosted'} meetings…`; paint();
        const data = await request('meetings?' + query, { signal: controller.signal }); if (run !== generation) return;
        await cacheMeetings(data.meetings);
        results = mergeMeetings(results, data.meetings); state.meetings = results; state.nextPage = data.nextPageToken; state.loaded = true; token = data.nextPageToken;
        if (token && seen.has(token)) throw new Error('Zoom repeated a page cursor. Results are incomplete; refresh to retry.');
        seen.add(token);
      } while (all && token && seen.size < 500);
      state.progress = `${results.length} meetings loaded${token ? ' · more available' : ' · all pages retrieved'}`;
    } catch (error) { if (run === generation) failure(error); }
    finally { if (run === generation) { state.busy = false; paint(); } }
  }
  async function cacheMeetings(items) {
    if (cacheState.status !== 'ready') { state.error = 'Meetings loaded, but the browser cache is unavailable. Open Saved library to retry storage.'; return; }
    try { await meetingCache.saveMeetings(items); cacheUpdated(); } catch (error) { state.error = 'Meetings loaded, but could not be cached: ' + error.message; }
  }
  async function cacheAllTranscripts() {
    if (cacheState.status !== 'ready') { state.error='Open Saved library and enable the browser cache first.';paint();return; }
    const run=start();if(!run)return;
    const files=state.recordings.flatMap(m=>(m.files||[]).filter(f=>f.status==='completed').map(f=>({meeting:m,file:f})));
    let saved=0,skipped=0,failed=0;
    try{
      for(const {meeting,file} of files){
        const id='zoom:'+meeting.uuid+':'+file.id;
        if(await meetingCache.read('minutes',id)){skipped++;continue;}
        state.progress=`Caching transcripts · ${saved+skipped+failed+1} of ${files.length}`;paint();
        try{
          const data=await request('transcript',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({meetingUuid:meeting.uuid,fileId:file.id}),signal:controller.signal});
          if(run!==generation)return;
          await meetingCache.saveMinutes({id,meetingId:'recording:'+meeting.uuid,title:data.title,text:transcriptToText(data.text)});saved++;cacheUpdated();
        }catch(error){if(['rate_limited','refresh_in_progress','reconnect_required','sign_in_required','connection_changed'].includes(error.code)||error.name==='AbortError')throw error;failed++;}
      }
      state.progress=`Transcript cache complete · ${saved} saved · ${skipped} already cached${failed?' · '+failed+' unavailable (try again later)':''}`;
    }catch(error){if(run===generation){failure(error);state.progress=`Transcript cache paused · ${saved} saved. Run Cache available transcripts again to continue; saved files are skipped.`;}}
    finally{if(run===generation){state.busy=false;paint();}}
  }
  function row(meeting) {
    const transcript = meeting.files?.find(f => f.status === 'completed');
    const date = meeting.startTime ? new Date(meeting.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'No scheduled time';
    return `<article class="zoom-meeting"><div><div class="zoom-meeting-meta">${badge(meeting.kind === 'recording' ? 'Cloud recording' : 'Meeting', meeting.kind === 'recording' ? 'green' : 'neutral')}<span>${esc(date)}</span></div><h3>${esc(meeting.topic)}</h3><p>Meeting ${esc(meeting.id)}${meeting.duration ? ` · ${esc(meeting.duration)} minutes` : ''}</p>${meeting.kind === 'recording' ? `<small>${transcript ? 'Transcript ready to import' : meeting.files?.length ? 'Transcript is still processing' : 'No cloud transcript available'}</small>` : ''}</div><div class="zoom-meeting-actions">${transcript ? `<button class="button primary" data-zoom-action="import" data-uuid="${esc(meeting.uuid)}" data-file="${esc(transcript.id)}" ${state.busy ? 'disabled' : ''}>${icon('download')}Use transcript</button>` : ''}${meeting.url ? `<a class="text-link" href="${esc(meeting.url)}" target="_blank" rel="noopener noreferrer">Open in Zoom ${icon('external')}</a>` : ''}</div></article>`;
  }
  function view() {
    const status = state.status;
    const canFetch = !!(status?.configured && status.authenticated && status.connected && !state.statusError);
    const disabled = state.busy || !canFetch ? 'disabled' : '';
    const readyTranscripts = state.recordings.some(m => m.files?.some(f => f.status === 'completed'));
    const nextStep = state.statusError ? 'Retry the connection check above to continue.'
      : !status ? 'Checking your Zoom connection…'
      : !status.configured ? 'Finish the server setup shown above, then check the connection again.'
      : !status.authenticated ? 'Sign in to this workspace above, then connect your Zoom account.'
      : !status.connected ? 'Select Connect with Zoom above and approve access. The fetch buttons will then be enabled.'
      : 'Choose a date range and fetch recordings to find available minutes and transcripts.';
    let connection;
    if (state.statusError) connection = `<div class="notice amber">${esc(state.statusError)} <button class="button small" data-zoom-action="status">Retry</button></div>`;
    else if (!status) connection = '<p class="empty">Checking your Zoom connection…</p>';
    else if (!status.configured) connection = `<section class="panel zoom-connect"><div class="zoom-symbol">${icon('wave')}</div><div>${badge('Setup required', 'amber')}<h2>The site’s Zoom setup needs attention.</h2><p>Creating the app in Zoom is the first step. Its credentials also need to be saved and deployed to this site before you can connect.</p>${status.setupIssues?.length ? `<ul class="zoom-setup-issues">${status.setupIssues.map(issue => `<li>${esc(issue.message)}</li>`).join('')}</ul>` : ''}<a class="button primary" href="/zoom-setup.html" target="_blank" rel="noopener">Open the Zoom setup guide ${icon('external')}</a></div></section>`;
    else if (!status.authenticated) connection = `<section class="panel zoom-connect"><div class="zoom-symbol">${icon('shield')}</div><div><h2>Your meetings belong to your workspace.</h2><p>Sign in to this workspace first, then authorize your own Zoom account. Your connection and imported follow-ups stay separate from other users.</p><a class="button primary" href="${status.signInPath}" target="_top">Sign in to workspace ${icon('arrow')}</a></div></section>`;
    else if (!status.connected) connection = `<section class="panel zoom-connect"><div class="zoom-symbol">${icon('wave')}</div><div><h2>Bring your Zoom meetings into focus.</h2><p>Authorize read access to your profile, hosted meetings, and cloud recordings. You choose which transcript to bring into the analyzer.</p><form id="zoom-connect" action="/api/zoom/connect" method="post" target="_top"><button class="button primary">Connect with Zoom ${icon('arrow')}</button></form></div></section>`;
    else connection = `<section class="panel zoom-account"><span class="zoom-symbol">${icon('check')}</span><div><strong>${esc(status.profile.name)}</strong><p>${esc(status.profile.email)}</p></div>${badge('Zoom connected', 'green')}<button class="button" data-zoom-action="disconnect" ${state.busy ? 'disabled' : ''}>Disconnect</button><a class="text-link" href="${status.signOutPath}" target="_top">Sign out</a></section>`;
    const items = canFetch ? (state.tab === 'recordings' ? state.recordings : state.meetings).filter(m => `${m.topic} ${m.id}`.toLocaleLowerCase().includes(state.search.toLocaleLowerCase())) : [];
    return heading('ZOOM LIBRARY', 'Your meetings. Ready for the next step.', 'Connect your account, browse accessible meetings, and bring a transcript into your analysis.') + connection +
      `<div class="cache-toolbar"><button class="button" data-zoom-action="status" ${state.busy ? 'disabled' : ''}>Check connection again</button><a class="text-link" href="#cache">View saved minutes ${icon('arrow')}</a></div>` +
      `<div class="notice zoom-limit">${icon('file')}<div><strong>What Zoom can provide.</strong> Hosted meetings include valid scheduled meetings. Upcoming & invited covers the next 24 hours when available. Cloud history includes retained recordings in your chosen dates; transcripts must have been generated in Zoom. Local recordings and every meeting you attended are not available through this connection.</div></div>` +
      (state.error ? `<div class="notice amber" role="alert">${esc(state.error)}${state.scan && !state.busy && status?.connected ? '<button class="button small" data-zoom-action="resume">Resume search</button>' : ''}</div>` : '') +
      `<section class="panel zoom-library" aria-label="Fetch Zoom meetings and transcripts">
        <h2>Find your meeting minutes</h2>
        <p class="subtle-note">${esc(nextStep)}</p>
        <div class="zoom-tabs" role="group" aria-label="Meeting list">${[['recordings', 'Cloud recordings'], ['scheduled', 'Hosted meetings'], ['invited', 'Upcoming & invited']].map(([id, title]) => `<button class="button ${state.tab === id ? 'primary' : ''}" data-zoom-action="tab" data-tab="${id}" aria-pressed="${state.tab === id}" ${state.busy ? 'disabled' : ''}>${title}</button>`).join('')}</div>
        ${state.tab === 'recordings' ? `<form id="zoom-dates" class="zoom-date-form"><label class="field"><span>From</span><input type="date" name="from" value="${state.from}" required ${disabled}/></label><label class="field"><span>Through</span><input type="date" name="to" value="${state.to}" required ${disabled}/></label><button class="button primary" ${disabled}>Fetch all in date range ${icon('download')}</button></form><p class="subtle-note">Searches every page in consecutive date windows, newest first. Choose earlier dates to look further back. Dates use UTC.</p>`
          : `<div class="zoom-list-controls"><p>${state.tab === 'invited' ? 'Upcoming meetings in the next 24 hours, including invitations Zoom can access through your connected calendar.' : 'All valid scheduled meetings you host, including unexpired past meetings, live meetings, and upcoming meetings.'}</p><button class="button primary" data-zoom-action="fetch-all" ${disabled}>Fetch all pages</button><button class="button" data-zoom-action="refresh" ${disabled}>Refresh</button></div>`}
        <div class="zoom-progress" role="status" aria-live="polite"><span>${esc(canFetch ? state.progress || 'Your fetched meetings will appear below.' : 'Fetching is available after setup, workspace sign-in, and Zoom authorization.')}</span>${state.busy ? '<button class="button small" data-zoom-action="cancel">Stop</button>' : canFetch && state.scan && !state.error ? '<button class="button small" data-zoom-action="resume">Resume</button>' : ''}</div>
        ${state.tab === 'recordings' ? `<div class="cache-toolbar"><button class="button" data-zoom-action="cache-transcripts" ${state.busy || !canFetch || !readyTranscripts || cacheState.status !== 'ready' ? 'disabled' : ''}>${icon('download')}Cache available transcripts</button><a class="text-link" href="#cache">Open saved library ${icon('arrow')}</a></div><p class="subtle-note">${readyTranscripts && canFetch ? 'Save the available transcripts, then open Saved library to read them.' : 'The cache button becomes available when fetched recordings include completed transcripts.'}</p>` : ''}
        <form id="zoom-search" class="filter-bar"><label class="search-field">${icon('search')}<input name="search" value="${esc(state.search)}" aria-label="Search fetched Zoom meetings" placeholder="Search fetched meetings…" ${disabled}/></label><button class="button" ${disabled}>Search</button></form>
        <div class="zoom-meetings">${items.map(row).join('') || `<p class="empty">${canFetch && state.loaded ? 'No meetings match this list or search. Try another date range or list.' : 'Your fetched meetings will appear here.'}</p>`}</div>
        ${canFetch && state.tab !== 'recordings' && state.nextPage ? `<button class="button" data-zoom-action="more" ${disabled}>Load more meetings</button>` : ''}
      </section>` +
      `<p class="cache-indicator">Fetched records and imported transcripts are cached in your browser’s DuckDB. <a class="text-link" href="#cache">Open saved library</a></p><section class="panel zoom-how"><h2>From transcript to follow-up</h2><p>Use a completed cloud transcript to load its full text into New analysis. You can attach PDF references there, inspect the imported text, and review extracted candidates before adding them to your tracker.</p><p class="subtle-note">The analyzer detects structured action sections. It does not automatically infer promises from raw speech. The original October meeting review remains available in the other screens.</p></section>`;
  }
  async function click(button) {
    const action = button.dataset.zoomAction;
    if (action === 'status') await loadStatus();
    if (action === 'tab') { cancel(); state.tab = button.dataset.tab; state.loaded = false; state.search = ''; state.error = ''; state.progress = ''; state.nextPage = ''; state.meetings = []; state.scan = null; paint(); }
    if (action === 'fetch-all' || action === 'refresh' || action === 'more') await loadMeetings(action === 'more', action === 'fetch-all');
    if (action === 'cache-transcripts') await cacheAllTranscripts();
    if (action === 'resume') await scanRecordings(true);
    if (action === 'cancel') { cancel(); state.progress = 'Search stopped. Retrieved results are kept.'; paint(); }
    if (action === 'disconnect') {
      if(!confirm('Disconnect Zoom and clear this account’s cached meeting data on this device? Export the cache from Saved library first if you want a copy.'))return;
      const run = start(); if (!run) return; paint();
      try { const data = await request('disconnect', { method: 'POST' }); cancel(); state.error = ''; state.progress = ''; if (cacheState.status === 'ready') { await meetingCache.clear(); cacheUpdated(); } toast(data.message); await loadStatus(); } catch (error) { failure(error); } finally { state.busy = false; paint(); }
    }
    if (action === 'import') {
      const run = start(); if (!run) return; paint();
      try { const data = await request('transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingUuid: button.dataset.uuid, fileId: button.dataset.file }), signal: controller.signal }); if (run !== generation) return; const text = transcriptToText(data.text);
        if (cacheState.status === 'ready') { await meetingCache.saveMinutes({ id: 'zoom:' + button.dataset.uuid + ':' + button.dataset.file, meetingId: 'recording:' + button.dataset.uuid, title: data.title, text }); cacheUpdated(); }
        importTranscript({ title: data.title, startTime: data.startTime, text }); } catch (error) { if (run === generation) failure(error); } finally { if (run === generation) { state.busy = false; paint(); } }
    }
  }
  async function submit(form) {
    if (form.id === 'zoom-connect') { HTMLFormElement.prototype.submit.call(form); return; }
    const data = Object.fromEntries(new FormData(form));
    if (form.id === 'zoom-dates') { state.from = data.from; state.to = data.to; await scanRecordings(); }
    if (form.id === 'zoom-search') { state.search = data.search; paint(); }
  }
  function consumeCallback() {
    const url = new URL(location.href); const error = url.searchParams.get('zoom_error');
    if (error) state.error = error === 'authorization_declined' ? 'Zoom authorization was declined. You can connect again whenever you are ready.' : 'Zoom could not finish connecting. Check the app configuration and try connecting again.';
    if (url.searchParams.has('zoom_connected')) toast('Your Zoom account is connected. Choose a list to fetch your meetings.');
    if (error || url.searchParams.has('zoom_connected')) { url.searchParams.delete('zoom_error'); url.searchParams.delete('zoom_connected'); history.replaceState(null, '', url.pathname + url.search + url.hash); }
  }
  return { view, click, submit, loadStatus, consumeCallback, identity:()=>state.status?.profile||state.status?.visitor||null };
}
