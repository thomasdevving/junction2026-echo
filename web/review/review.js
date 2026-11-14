import { listRecipes, getRecipe, createRecipe, putVideo, processRecipe, patchRecipe, patchStep, publishRecipe, deleteRecipe } from '../shared/api.js';
import { CONFIG_EVENT, getConfig } from '../shared/config.js';
import { mountChrome } from '../shared/chrome.js';
import { renderLens } from '../shared/lens.js';
import { icon } from '../shared/icons.js';
import { wordCount, uploadErrors, mistakeId, validateStep, stepDraft, imageUrl } from './validation.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const message = (element, text = '', tone = '') => { element.textContent = text; element.dataset.tone = tone; };
const workspace = $('#workspace'), libraryMessage = $('#library-message');
const uploadForm = $('#upload-form'), uploadFields = $('#upload-fields');
const pending = status => ['uploading', 'processing'].includes(status);
let selectedId = new URL(location.href).searchParams.get('recipe');
let recipe = null, recipes = [], editors = new Map(), metaDirty = false, metaSaving = false;
let viewVersion = 0, connectionVersion = 0, listBusy = false, detailBusy = false, publishBusy = false, deleteBusy = false;
let lastList = 0, lastDetail = 0, listSignature = '', upload = null, uploadBusy = false;
let deleteTarget = null;

function hasDirty() { return metaDirty || [...editors.values()].some(editor => editor.dirty); }
function hasMutation() { return metaSaving || publishBusy || deleteBusy || [...editors.values()].some(editor => editor.saving); }
function canLeave() {
  if (hasMutation() || uploadBusy) return false;
  return !hasDirty() || confirm('Leave this recipe and discard your unsaved edits?');
}
function statusChip(status) { return `<span class="recipe-status" data-status="${esc(status)}">${esc(status)}</span>`; }
function when(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function selectListItem() {
  document.querySelectorAll('.recipe-item').forEach(button => {
    button.setAttribute('aria-current', String(button.dataset.id === selectedId));
    button.disabled = uploadBusy;
  });
}

async function refreshList() {
  if (listBusy || document.hidden) return;
  if (!getConfig().demoKey) {
    message(libraryMessage, 'Connect this browser in Settings to see your recordings.');
    lastList = Date.now(); return;
  }
  listBusy = true;
  const connection = connectionVersion;
  try {
    const result = await listRecipes();
    if (connection !== connectionVersion) return;
    recipes = result.recipes;
    const signature = JSON.stringify(recipes);
    if (signature !== listSignature) {
      const focusedId = document.activeElement?.dataset.id;
      listSignature = signature;
      $('#recipe-list').innerHTML = recipes.map(item => `<li><button class="recipe-item" data-id="${esc(item.id)}" type="button"><strong>${esc(item.title)}</strong>${statusChip(item.status)}<small>${item.step_count} steps · ${esc(when(item.created_at))}</small>${item.status === 'failed' ? '<small>Processing failed · open for details</small>' : ''}</button></li>`).join('');
      $('#recipe-list').querySelectorAll('button').forEach(button => button.addEventListener('click', () => openRecipe(button.dataset.id)));
      if (focusedId) [...$('#recipe-list').querySelectorAll('button')].find(button => button.dataset.id === focusedId)?.focus();
    }
    selectListItem();
    message(libraryMessage, recipes.length ? '' : 'No recordings yet. Record in Chef mode, or use the MP4 fallback below.');
    if (!selectedId && recipes.length) openRecipe((recipes.find(item => item.status === 'review') || recipes[0]).id, true);
  } catch (error) {
    if (connection === connectionVersion) message(libraryMessage, error.status === 401 ? 'Open Settings and enter the demo key to load recordings.' : `Could not refresh the library. ${error.message}`, 'error');
  } finally {
    if (connection === connectionVersion) { listBusy = false; lastList = Date.now(); }
  }
}

async function openRecipe(id, force = false) {
  if (!force && !canLeave()) return;
  const version = ++viewVersion;
  selectedId = id; recipe = null; editors = new Map(); metaDirty = false; metaSaving = false;
  selectListItem();
  const url = new URL(location.href); url.searchParams.set('recipe', id); history.replaceState(null, '', url);
  if (!getConfig().demoKey) {
    workspace.setAttribute('aria-busy', 'false');
    workspace.innerHTML = '<div class="welcome panel"><p class="overline">YOUR LESSONS, IN THIS BROWSER</p><h2>Connect to your recordings.</h2><p>Enter the team’s private demo key in Settings. Your selected recipe will open once this browser is connected.</p><button class="btn btn-light" type="button" data-connect-review>Connect this browser</button></div>';
    workspace.querySelector('[data-connect-review]').addEventListener('click', () => document.querySelector('.tool-header [data-open-settings]').click());
    return;
  }
  workspace.setAttribute('aria-busy', 'true');
  workspace.innerHTML = '<div class="pending-panel panel"><p class="overline">OPENING RECORDING</p><h2>Loading your lesson…</h2></div>';
  try {
    const data = await getRecipe(id);
    if (version !== viewVersion) return;
    drawRecipe(data);
  } catch (error) {
    if (version !== viewVersion) return;
    workspace.innerHTML = `<div class="pending-panel panel"><h2>Couldn’t open this recipe</h2><p>${esc(error.message)}</p><button class="btn" id="retry-open">Try again</button></div>`;
    $('#retry-open').addEventListener('click', () => openRecipe(id, true));
  } finally {
    if (version === viewVersion) workspace.setAttribute('aria-busy', 'false');
  }
}

function drawRecipe(data) {
  recipe = data; editors = new Map(); metaDirty = false; metaSaving = false; lastDetail = Date.now();
  const ready = ['review', 'published'].includes(data.status);
  workspace.innerHTML = `
    <header class="review-heading"><div><p class="overline">THE CHEF’S CUT</p><h2 id="recipe-heading">${esc(data.title)}</h2><p>${ready ? 'Refine the instructions. Choose the moments that make the method clear.' : 'Your recording becomes a lesson here. Keep this page open to follow its progress.'}</p></div>${statusChip(data.status)}</header>
    ${ready ? `<form class="recipe-meta panel" id="metadata-form" novalidate><fieldset id="metadata-fields"><div class="meta-grid"><label class="field">Recipe title<input class="input" name="title" maxlength="80" required value="${esc(data.title)}"></label><label class="field">Chef name · optional<input class="input" name="chef_name" maxlength="120" value="${esc(data.chef_name)}"></label></div><div class="save-row"><button class="btn" type="submit" id="save-metadata" disabled>Save recipe details</button><p class="message" id="metadata-message" role="status"></p></div></fieldset></form>` : `<div class="pending-panel panel"><p class="overline">${data.status === 'failed' ? 'PROCESSING STOPPED' : 'RECORDING STATUS'}</p><h3>${data.status === 'failed' ? 'This recording needs another try.' : data.status === 'uploading' ? 'Waiting for the upload.' : 'Finding the steps in your recording.'}</h3><p>${data.status === 'failed' ? esc(data.error || 'Processing failed. Upload a readable MP4 to try again.') : data.status === 'uploading' ? 'Chef mode or the upload form will finish sending the video, then start processing.' : 'Gemini extracts the instructions while the backend prepares reference stills. This page updates automatically.'}</p><p id="processing-elapsed"></p></div>`}
    ${ready ? sourceVideo(data) + `<div class="steps-heading"><h3>${data.steps.length} steps to review</h3><p>Each step saves separately.</p></div><div id="step-list"></div><details class="transcript panel"><summary>Chef’s transcript · read only</summary><p>${esc(data.transcript || 'No narration was extracted from this recording.')}</p></details><section class="publish-panel panel"><p class="overline">READY FOR ANOTHER PAIR OF HANDS</p><h3>${data.status === 'published' ? 'Your lesson is published.' : 'Give every step a final look.'}</h3><p id="publish-hint">${data.status === 'published' ? 'Saved edits to this lesson are immediately available to future cooking sessions.' : 'Check the wording, reference stills and known mistakes, then publish to the recipe library.'}</p><div class="publish-actions"><button class="btn btn-light" id="publish-recipe" type="button">Publish lesson</button><a class="btn" href="../sim/" id="open-simulator" ${data.status !== 'published' ? 'hidden' : ''}>Open simulator ↗</a></div><p class="message" id="publish-message" role="status"></p></section>` : ''}
    <div class="danger-zone"><button class="btn btn-danger" type="button" id="delete-recipe">Delete recipe and all footage</button><p>Withdraw the recording and remove its derived data.</p></div>`;
  $('#delete-recipe').addEventListener('click', showDelete);
  if (!ready) { updateElapsed(); return; }
  wireMetadata();
  if (data.video_url) wireVideo();
  for (const step of [...data.steps].sort((a, b) => a.idx - b.idx)) {
    const editor = makeEditor(step);
    editors.set(step.id, editor);
    $('#step-list').append(editor.element);
    editor.update();
  }
  $('#publish-recipe').addEventListener('click', publish);
  updatePublish();
}

function sourceVideo(data) {
  const url = imageUrl(data.video_url);
  if (!url) return `<section class="source-video panel"><h3>Reference moments</h3><p class="message">${data.status === 'published' ? 'The API hides source video for published recipes.' : 'This recipe has no source video available.'} You can edit the timestamp below; a new still is extracted only when the backend has the source recording.</p></section>`;
  return `<section class="source-video panel"><p class="overline">THE ORIGINAL TAKE · RECORDED SOURCE / REPLAY</p><h3>Find the clearest moment.</h3><video id="source-video" controls playsinline preload="metadata" src="${esc(url)}" aria-label="Chef’s recorded source video, replay"></video><div class="video-controls"><span class="video-time" id="video-time">0.0 s</span>${[-1, -.1, .1, 1].map(delta => `<button class="btn" type="button" data-seek="${delta}">${delta > 0 ? '+' : '−'}${Math.abs(delta)} s</button>`).join('')}</div><p class="message" id="video-message" role="status">Pause on a finished step, then choose “Use current frame” on its card.</p></section>`;
}
function wireVideo() {
  const video = $('#source-video');
  video.addEventListener('timeupdate', () => { $('#video-time').textContent = `${video.currentTime.toFixed(1)} s`; });
  video.addEventListener('error', () => message($('#video-message'), 'The source video could not load. Reopen the recipe to refresh its link, or use the numeric timestamps.', 'error'));
  document.querySelectorAll('[data-seek]').forEach(button => button.addEventListener('click', () => {
    if (!Number.isFinite(video.duration)) return;
    video.pause(); video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + Number(button.dataset.seek)));
  }));
}
function wireMetadata() {
  const form = $('#metadata-form');
  form.addEventListener('input', () => {
    metaDirty = form.elements.title.value !== recipe.title || form.elements.chef_name.value !== (recipe.chef_name || '');
    $('#save-metadata').disabled = !metaDirty || metaSaving || !form.elements.title.value.trim();
    message($('#metadata-message'), metaDirty ? 'Unsaved recipe details' : ''); updatePublish();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (metaSaving || !metaDirty || !form.reportValidity()) return;
    const version = viewVersion, title = form.elements.title.value.trim();
    if (!title || title.length > 80) return message($('#metadata-message'), 'Use a title of 1–80 characters.', 'error');
    metaSaving = true; $('#metadata-fields').disabled = true; updatePublish();
    try {
      const saved = await patchRecipe(recipe.id, { title, chef_name: form.elements.chef_name.value.trim() || null });
      if (version !== viewVersion) return;
      recipe.title = saved.title; recipe.chef_name = saved.chef_name;
      form.elements.title.value = saved.title; form.elements.chef_name.value = saved.chef_name || '';
      $('#recipe-heading').textContent = saved.title; metaDirty = false;
      message($('#metadata-message'), 'Recipe details saved.', 'success'); refreshList();
    } catch (error) { if (version === viewVersion) message($('#metadata-message'), error.message, 'error'); }
    finally {
      if (version === viewVersion) { metaSaving = false; $('#metadata-fields').disabled = false; $('#save-metadata').disabled = !metaDirty; updatePublish(); }
    }
  });
}

function field({ name, label, value = '', type = 'text', rows, words, attrs = '' }) {
  return `<label class="field"><span class="field-head"><span>${label}</span>${words ? `<span class="word-count" data-count="${name}"></span>` : ''}</span>${rows ? `<textarea class="input" name="${name}" rows="${rows}" ${attrs}>${esc(value)}</textarea>` : `<input class="input" name="${name}" type="${type}" value="${esc(value)}" ${attrs}>`}<span class="field-error" data-error="${name}"></span></label>`;
}
function watchRow(watch, index, existing = true) {
  const prefix = `watch.${index}.`;
  return `<div class="watch-row" data-existing="${existing}"><div class="watch-row-head"><p>Known mistake</p><button class="btn btn-ghost" type="button" data-remove-watch>Remove</button></div>${field({ name: prefix + 'id', label: 'Stable ID', value: watch.id, attrs: 'readonly' })}${field({ name: prefix + 'mistake', label: 'What should the camera look for?', value: watch.mistake, rows: 2 })}<div class="short-fields">${field({ name: prefix + 'headline', label: 'Lens headline', value: watch.headline, words: 4 })}${field({ name: prefix + 'fix', label: 'Short correction', value: watch.fix, words: 8 })}</div>${field({ name: prefix + 'spoken', label: 'Spoken correction', value: watch.spoken, rows: 2 })}</div>`;
}
function makeEditor(step) {
  const element = document.createElement('article'); element.className = 'step-card panel';
  const editor = { step, element, saved: stepDraft(step), dirty: false, saving: false, revision: '', errors: {} };
  element.innerHTML = `<div class="step-card-head"><h3>Step ${step.idx}</h3><span class="step-state">Saved</span></div><form novalidate><fieldset><div class="step-layout"><div class="reference-column"><div data-reference></div><p class="preview-heading">LIVE LENS PREVIEW</p><div data-lens role="img" aria-label="Step card preview"></div><div class="frame-actions"><button class="btn" type="button" data-jump ${recipe.video_url ? '' : 'disabled'}>Jump to this step</button><button class="btn" type="button" data-use-frame ${recipe.video_url ? '' : 'disabled'}>Use current frame</button></div><p class="message" data-frame-message role="status"></p></div><div class="step-fields">${field({ name: 'title', label: 'Step title', value: step.title, words: 4 })}${field({ name: 'key_line', label: 'Lens instruction', value: step.key_line, words: 8 })}${field({ name: 'instruction', label: 'Full instruction', value: step.instruction, rows: 3 })}${field({ name: 'success_criteria', label: 'Visible success criteria · one per line', value: step.success_criteria.join('\n'), rows: 3 })}<div class="short-fields">${field({ name: 'timer_s', label: 'Timer · seconds', value: step.timer_s ?? '', type: 'number', attrs: 'min="0" max="86400" step="1"' })}${field({ name: 'timestamp_s', label: 'Reference time · seconds', value: step.timestamp_s, type: 'number', attrs: 'min="0" step="0.1"' })}</div></div></div><details class="watch-editor"><summary>Known mistakes <span data-watch-count></span></summary><p class="watch-intro">Only mistakes you define here are watched for. Keep the headline and correction short; the stable ID stays fixed after saving.</p><div data-watch-rows>${step.watch_fors.map((watch, index) => watchRow(watch, index)).join('')}</div><button class="btn" type="button" data-add-watch>Add a known mistake</button></details><div class="save-row"><button class="btn btn-light" type="submit" data-save disabled>Save step</button><p class="message" data-save-message role="status"></p></div></fieldset></form>`;
  const form = element.querySelector('form'), fields = form.querySelector('fieldset');
  const input = name => form.elements.namedItem(name);
  const read = () => ({
    title: input('title').value.trim(), key_line: input('key_line').value.trim(), instruction: input('instruction').value.trim(),
    success_criteria: input('success_criteria').value.split('\n').map(line => line.trim()).filter(Boolean),
    timer_s: input('timer_s').value === '' ? null : Number(input('timer_s').value),
    timestamp_s: input('timestamp_s').value === '' ? NaN : Number(input('timestamp_s').value),
    watch_fors: [...element.querySelectorAll('.watch-row')].map(row => Object.fromEntries([...row.querySelectorAll('input, textarea')].map(control => [control.name.split('.').pop(), control.value.trim()]))),
  });
  function drawReference() {
    const url = imageUrl(editor.step.ref_image_url, editor.revision), target = element.querySelector('[data-reference]');
    target.innerHTML = url ? `<img class="reference-image" src="${esc(url)}" alt="Chef’s reference for step ${step.idx}: ${esc(editor.step.title)}">` : '<div class="reference-empty">No reference image</div>';
    target.querySelector('img')?.addEventListener('error', () => message(element.querySelector('[data-frame-message]'), 'Reference image could not load. Reopen the recipe to refresh its link.', 'error'));
  }
  editor.update = () => {
    const draft = read(); editor.errors = validateStep(draft);
    editor.dirty = JSON.stringify(draft) !== JSON.stringify(editor.saved);
    for (const control of form.querySelectorAll('input, textarea')) {
      const error = editor.errors[control.name] || '';
      control.setAttribute('aria-invalid', String(Boolean(error)));
      const errorElement = [...form.querySelectorAll('[data-error]')].find(node => node.dataset.error === control.name);
      if (errorElement) errorElement.textContent = error;
    }
    for (const counter of form.querySelectorAll('[data-count]')) {
      const name = counter.dataset.count, limit = name.endsWith('headline') || name === 'title' ? 4 : 8, count = wordCount(input(name).value);
      counter.textContent = `${count} / ${limit} words`; counter.dataset.over = String(count > limit);
    }
    element.querySelector('[data-watch-count]').textContent = `· ${draft.watch_fors.length}`;
    element.querySelector('[data-add-watch]').disabled = draft.watch_fors.length >= 20;
    element.querySelector('[data-save]').disabled = editor.saving || !editor.dirty || Object.keys(editor.errors).length > 0;
    element.querySelector('.step-state').textContent = editor.saving ? 'Saving…' : editor.dirty ? 'Unsaved changes' : 'Saved';
    renderLens(element.querySelector('[data-lens]'), { kind: 'step', card: { idx: step.idx, total: recipe.steps.length, title: draft.title, keyLine: draft.key_line, refImageUrl: imageUrl(editor.step.ref_image_url, editor.revision), watching: 'off' } });
    element.querySelector('[data-lens]').setAttribute('aria-label', `Step ${step.idx}: ${draft.title}. ${draft.key_line}`);
    updatePublish();
  };
  function renumberRows() {
    [...element.querySelectorAll('.watch-row')].forEach((row, index) => {
      for (const control of row.querySelectorAll('[name]')) control.name = `watch.${index}.${control.name.split('.').pop()}`;
      for (const node of row.querySelectorAll('[data-error]')) node.dataset.error = `watch.${index}.${node.dataset.error.split('.').pop()}`;
      for (const node of row.querySelectorAll('[data-count]')) node.dataset.count = `watch.${index}.${node.dataset.count.split('.').pop()}`;
    });
  }
  form.addEventListener('input', event => {
    const row = event.target.closest('.watch-row');
    if (row?.dataset.existing === 'false' && event.target.name.endsWith('.mistake')) {
      row.querySelector('[name$=".id"]').value = mistakeId(event.target.value, [...element.querySelectorAll('[name$=".id"]')].filter(control => !row.contains(control)).map(control => control.value));
    }
    message(element.querySelector('[data-save-message]')); editor.update();
  });
  element.querySelector('[data-watch-rows]').addEventListener('click', event => {
    const button = event.target.closest('[data-remove-watch]'); if (!button) return;
    button.closest('.watch-row').remove(); renumberRows(); editor.update();
  });
  element.querySelector('[data-add-watch]').addEventListener('click', () => {
    const rows = element.querySelector('[data-watch-rows]'), count = rows.children.length;
    if (count >= 20) return;
    const id = mistakeId('', read().watch_fors.map(watch => watch.id));
    rows.insertAdjacentHTML('beforeend', watchRow({ id, mistake: '', headline: '', fix: '', spoken: '' }, count, false));
    rows.lastElementChild.querySelector('textarea').focus(); editor.update();
  });
  async function save(overrideTimestamp) {
    if (editor.saving) return;
    const draft = read();
    if (overrideTimestamp !== undefined) draft.timestamp_s = overrideTimestamp;
    const errors = validateStep(draft);
    if (Object.keys(errors).length) { editor.update(); message(element.querySelector('[data-save-message]'), 'Fix the highlighted fields before saving this step.', 'error'); return; }
    if (JSON.stringify(draft) === JSON.stringify(editor.saved)) {
      message(element.querySelector('[data-frame-message]'), 'This reference time is already saved. Pick a different moment to extract another still.'); return;
    }
    const payload = Object.fromEntries(Object.entries(draft).filter(([name, value]) => JSON.stringify(value) !== JSON.stringify(editor.saved[name])));
    const version = viewVersion; editor.saving = true; fields.disabled = true; editor.update();
    message(element.querySelector('[data-save-message]'), 'timestamp_s' in payload ? 'Saving and extracting the reference frame…' : 'Saving step…');
    try {
      const saved = await patchStep(step.id, payload);
      if (version !== viewVersion) return;
      editor.step = saved; editor.saved = stepDraft(saved);
      recipe.steps = recipe.steps.map(item => item.id === saved.id ? saved : item);
      for (const name of ['title', 'key_line', 'instruction', 'timer_s', 'timestamp_s']) input(name).value = saved[name] ?? '';
      input('success_criteria').value = saved.success_criteria.join('\n');
      element.querySelector('[data-watch-rows]').innerHTML = saved.watch_fors.map((watch, index) => watchRow(watch, index)).join('');
      if ('timestamp_s' in payload) editor.revision = String(Date.now());
      drawReference(); message(element.querySelector('[data-save-message]'), 'Step saved.', 'success');
      if ('timestamp_s' in payload) message(element.querySelector('[data-frame-message]'), 'Reference time saved. The preview uses the refreshed image.', 'success');
    } catch (error) { if (version === viewVersion) message(element.querySelector('[data-save-message]'), error.message, 'error'); }
    finally { if (version === viewVersion) { editor.saving = false; fields.disabled = false; editor.update(); } }
  }
  form.addEventListener('submit', event => { event.preventDefault(); save(); });
  element.querySelector('[data-jump]').addEventListener('click', () => {
    const video = $('#source-video');
    if (!video || !Number.isFinite(video.duration)) return message(element.querySelector('[data-frame-message]'), 'Wait for the source video to load, or use the numeric timestamp.', 'error');
    video.pause(); video.currentTime = Math.min(video.duration, read().timestamp_s || 0); video.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  element.querySelector('[data-use-frame]').addEventListener('click', () => {
    const video = $('#source-video');
    if (!video || !Number.isFinite(video.duration)) return message(element.querySelector('[data-frame-message]'), 'Load the source video before selecting a frame.', 'error');
    video.pause(); save(Math.round(video.currentTime * 1000) / 1000);
  });
  drawReference();
  return editor;
}

function updatePublish() {
  const button = $('#publish-recipe'); if (!button || !recipe) return;
  button.hidden = recipe.status !== 'review';
  button.disabled = recipe.status !== 'review' || hasDirty() || hasMutation();
  if (recipe.status === 'review') $('#publish-hint').textContent = hasDirty() ? 'Save each changed step and the recipe details before publishing.' : 'Check the wording, reference stills and known mistakes, then publish to the recipe library.';
}
async function publish() {
  if (!recipe || recipe.status !== 'review' || hasDirty() || hasMutation()) return;
  const version = viewVersion; publishBusy = true; updatePublish();
  message($('#publish-message'), 'Publishing lesson…');
  try {
    const saved = await publishRecipe(recipe.id);
    if (version !== viewVersion) return;
    publishBusy = false; drawRecipe(saved);
    message($('#publish-message'), 'Published. This lesson is now available in the simulator and Cook mode.', 'success'); refreshList();
  } catch (error) { if (version === viewVersion) message($('#publish-message'), error.message, 'error'); }
  finally { if (version === viewVersion) { publishBusy = false; updatePublish(); } }
}

function showDelete() {
  if (!recipe || hasMutation() || uploadBusy) return;
  deleteTarget = { id: recipe.id, title: recipe.title, version: viewVersion, connection: connectionVersion };
  $('#delete-title').textContent = recipe.title; $('#delete-confirm').value = ''; $('#confirm-delete').disabled = true;
  message($('#delete-message')); $('#delete-dialog').showModal(); $('#delete-confirm').focus();
}
$('#delete-confirm').addEventListener('input', () => { $('#confirm-delete').disabled = deleteBusy || $('#delete-confirm').value !== deleteTarget?.title; });
$('#cancel-delete').addEventListener('click', () => { if (!deleteBusy) $('#delete-dialog').close(); });
$('#delete-dialog').addEventListener('cancel', event => { if (deleteBusy) event.preventDefault(); });
$('#delete-form').addEventListener('submit', async event => {
  event.preventDefault(); const target = deleteTarget;
  if (!target || deleteBusy || $('#delete-confirm').value !== target.title) return;
  deleteBusy = true; $('#confirm-delete').disabled = true; $('#cancel-delete').disabled = true; updatePublish();
  try {
    await deleteRecipe(target.id);
    if (target.version !== viewVersion) return;
    $('#delete-dialog').close(); ++viewVersion; recipe = null; selectedId = null; editors = new Map(); metaDirty = false;
    const url = new URL(location.href); url.searchParams.delete('recipe'); history.replaceState(null, '', url);
    workspace.innerHTML = '<div class="welcome panel"><p class="overline">RECORDING REMOVED</p><h2>Recipe and footage deleted.</h2><p>Choose another lesson from the library.</p></div>';
    listSignature = ''; refreshList();
  } catch (error) { if (target.connection === connectionVersion && deleteTarget === target) message($('#delete-message'), error.message, 'error'); }
  finally {
    if (target.connection === connectionVersion && deleteTarget === target) {
      deleteBusy = false; $('#cancel-delete').disabled = false; $('#confirm-delete').disabled = $('#delete-confirm').value !== target.title; updatePublish();
    }
  }
});

function uploadInputState(clear = false) {
  const file = uploadForm.elements.video.files[0];
  $('#file-size').textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB · maximum 500 MB` : 'MP4 only · up to 500 MB';
  const errors = uploadErrors({ file, title: uploadForm.elements.title.value, consent: uploadForm.elements.consent.checked });
  $('#upload-submit').disabled = uploadBusy || Boolean(upload) || errors.length > 0;
  if (file && uploadErrors({ file, title: 'Valid', consent: true }).length) message($('#upload-message'), errors.filter(error => !error.startsWith('Enter') && !error.startsWith('Consent')).join(' '), 'error');
  else if (clear && !upload) message($('#upload-message'));
}
uploadForm.addEventListener('input', () => uploadInputState(true));
uploadForm.addEventListener('submit', async event => {
  event.preventDefault(); if (uploadBusy || upload || !canLeave()) return;
  const file = uploadForm.elements.video.files[0], title = uploadForm.elements.title.value.trim(), consent = uploadForm.elements.consent.checked;
  const errors = uploadErrors({ file, title, consent });
  if (errors.length) return message($('#upload-message'), errors.join(' '), 'error');
  upload = { file, body: { title, chef_name: uploadForm.elements.chef_name.value.trim() || null, step_marks_s: [], consent }, created: null, uploaded: false, attempts: 0, processing: false, controller: new AbortController() };
  await sendUpload();
});
async function sendUpload() {
  if (!upload || uploadBusy) return;
  const task = upload, connection = connectionVersion;
  uploadBusy = true; uploadFields.disabled = true; $('#upload-submit').disabled = true;
  $('#retry-upload').hidden = true; $('#new-upload').hidden = true; selectListItem();
  try {
    if (!task.created) {
      message($('#upload-message'), 'Creating a place for the recording…');
      task.created = await createRecipe(task.body);
      if (connection !== connectionVersion) return;
      await openRecipe(task.created.recipe_id, true); refreshList();
    }
    if (connection !== connectionVersion) return;
    if (!task.uploaded && task.attempts > 0) {
      // A failed PUT acknowledgement can hide a completed upload. Probe /process
      // before reusing a one-use memory-store upload token.
      try { await processRecipe(task.created.recipe_id); task.uploaded = true; task.processing = true; }
      catch (error) {
        if (connection !== connectionVersion) return;
        if (error.code !== 'upload_missing') {
          const current = await getRecipe(task.created.recipe_id);
          if (!['processing', 'review', 'published'].includes(current.status)) throw error;
          task.uploaded = true; task.processing = true;
        }
      }
    }
    if (connection !== connectionVersion) return;
    if (!task.uploaded) {
      if (Date.parse(task.created.upload_expires_at) <= Date.now()) throw new Error('The upload link has expired. Choose another recording to create a fresh upload.');
      $('#upload-progress').hidden = false;
      task.attempts++;
      await putVideo(task.created.upload_url, task.file, percent => {
        if (connection !== connectionVersion) return;
        $('#upload-progress').value = percent; message($('#upload-message'), `Uploading recording · ${percent}%`);
      }, { signal: task.controller.signal });
      task.uploaded = true;
    }
    if (connection !== connectionVersion) return;
    message($('#upload-message'), 'Upload complete. Starting processing…');
    try { if (!task.processing) await processRecipe(task.created.recipe_id); task.processing = true; }
    catch (error) {
      if (connection !== connectionVersion) return;
      // A lost /process response may still have started the job. Do not upload twice.
      const current = await getRecipe(task.created.recipe_id);
      if (!['processing', 'review', 'published'].includes(current.status)) throw error;
    }
    if (connection !== connectionVersion) return;
    message($('#upload-message'), 'Recording uploaded. Processing continues in the review workspace.', 'success');
    $('#retry-upload').hidden = true; $('#new-upload').hidden = false;
    if (selectedId === task.created.recipe_id) await openRecipe(task.created.recipe_id, true);
    refreshList();
  } catch (error) {
    if (connection !== connectionVersion) return;
    message($('#upload-message'), error.message, 'error');
    $('#retry-upload').textContent = task.uploaded ? 'Retry processing' : 'Retry upload';
    $('#retry-upload').hidden = !task.created || (!task.uploaded && Date.parse(task.created.upload_expires_at) <= Date.now());
    $('#new-upload').hidden = false;
    if (!task.created) { upload = null; uploadFields.disabled = false; }
  } finally { if (connection === connectionVersion) { uploadBusy = false; selectListItem(); uploadInputState(); } }
}
$('#retry-upload').addEventListener('click', sendUpload);
$('#new-upload').addEventListener('click', () => {
  if (uploadBusy) return;
  upload = null; uploadFields.disabled = false; uploadForm.reset(); $('#upload-progress').hidden = true; $('#upload-progress').value = 0;
  $('#retry-upload').hidden = true; $('#new-upload').hidden = true; uploadInputState(true);
});

function updateElapsed() {
  const target = $('#processing-elapsed'); if (!target || !recipe || !pending(recipe.status)) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(recipe.created_at)) / 1000));
  target.textContent = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s since this recording was created. Updates pause while this tab is hidden.`;
}
async function refreshPending() {
  if (detailBusy || document.hidden || !recipe || !pending(recipe.status)) return;
  const version = viewVersion; detailBusy = true;
  try {
    const data = await getRecipe(selectedId);
    if (version !== viewVersion) return;
    message(libraryMessage);
    if (data.status !== recipe.status) { drawRecipe(data); refreshList(); }
    else recipe = data;
  } catch (error) { if (version === viewVersion) message(libraryMessage, `Progress update failed. ${error.message}`, 'error'); }
  finally { detailBusy = false; lastDetail = Date.now(); }
}
$('#refresh-list').addEventListener('click', refreshList);
addEventListener('beforeunload', event => { if (hasDirty() || hasMutation() || uploadBusy) { event.preventDefault(); event.returnValue = ''; } });
addEventListener(CONFIG_EVENT, () => {
  ++connectionVersion; ++viewVersion; upload?.controller.abort(); upload = null; uploadBusy = false; listBusy = false; detailBusy = false;
  publishBusy = false; deleteBusy = false; deleteTarget = null; $('#delete-dialog').close(); $('#cancel-delete').disabled = false;
  uploadFields.disabled = false; uploadInputState(); $('#retry-upload').hidden = true; $('#new-upload').hidden = true; $('#upload-progress').hidden = true;
  recipe = null; editors = new Map(); metaDirty = false; metaSaving = false; recipes = []; listSignature = ''; $('#recipe-list').replaceChildren();
  if (selectedId) openRecipe(selectedId, true);
  refreshList();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshList(); refreshPending(); } });
setInterval(() => {
  if (document.hidden) return;
  updateElapsed();
  if (Date.now() - lastList >= 5000) refreshList();
  if (Date.now() - lastDetail >= 3000) refreshPending();
}, 1000);
document.querySelector('[data-open-settings]').innerHTML = icon('gear', { size: 21 });
mountChrome({ shouldPoll: () => !document.hidden });
if (selectedId) openRecipe(selectedId, true);
refreshList();
