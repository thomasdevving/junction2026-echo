import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadErrors, mistakeId, validateStep, stepDraft, imageUrl, MAX_VIDEO_BYTES, wordCount } from '../review/validation.js';
import { putVideo, createRecipe, patchStep, publishRecipe, deleteRecipe } from '../shared/api.js';

const validStep = () => ({ title: 'Add fillings', key_line: 'One even layer, edge to edge', instruction: 'Spread the filling evenly.', success_criteria: ['Filling reaches every edge'], timer_s: null, timestamp_s: 12, watch_fors: [] });
const file = { name: 'lesson.mp4', type: 'video/mp4', size: 1024 };

test('upload validation requires consent and rejects unsupported or oversized files before creation', () => {
  assert.deepEqual(uploadErrors({ file, title: 'Lesson', consent: true }), []);
  assert.match(uploadErrors({ file, title: 'Lesson', consent: false }).join(' '), /Consent/);
  for (const invalid of [{ ...file, name: 'movie.mov', type: 'video/quicktime' }, { ...file, size: MAX_VIDEO_BYTES + 1 }, { ...file, size: 0 }, null]) {
    assert.ok(uploadErrors({ file: invalid, title: 'Lesson', consent: true }).length);
  }
  assert.ok(uploadErrors({ file, title: ' '.repeat(3), consent: true }).length);
  assert.ok(uploadErrors({ file, title: 'x'.repeat(81), consent: true }).length);
});
test('MP4 extension remains required when MIME is empty or misleading', () => {
  assert.deepEqual(uploadErrors({ file: { ...file, type: '' }, title: 'Lesson', consent: true }), []);
  assert.ok(uploadErrors({ file: { ...file, name: 'document.txt' }, title: 'Lesson', consent: true }).length);
});
test('lens word limits include Unicode whitespace and block an invalid step', () => {
  assert.equal(wordCount(' One\n even\t layer '), 3);
  const draft = validStep(); draft.title = 'one two three four five'; draft.key_line = 'one two three four five six seven eight nine';
  const errors = validateStep(draft); assert.ok(errors.title); assert.ok(errors.key_line);
});
test('timers and reference timestamps reject invalid numeric input', () => {
  for (const value of [-1, 1.5, Infinity, NaN, 86401]) assert.ok(validateStep({ ...validStep(), timer_s: value }).timer_s);
  for (const value of [-1, Infinity, NaN]) assert.ok(validateStep({ ...validStep(), timestamp_s: value }).timestamp_s);
  assert.deepEqual(validateStep(validStep()), {});
  assert.deepEqual(validateStep({ ...validStep(), timer_s: 0 }), {});
});
test('new mistake IDs are stable-format, collision-free and safe for non-Latin input', () => {
  assert.equal(mistakeId('Crème piled up!'), 'creme_piled_up');
  assert.equal(mistakeId('Crème piled up!', ['creme_piled_up', 'creme_piled_up_2']), 'creme_piled_up_3');
  assert.equal(mistakeId('123 wrong'), 'mistake_123_wrong');
  assert.match(mistakeId('米'), /^[a-z][a-z0-9_]*$/);
});
test('known mistakes reject duplicate IDs, empty fields and overlong lens copy', () => {
  const watch = { id: 'filling_piled', mistake: 'Filling piled up', headline: 'Filling piled up', fix: 'Spread to the edges', spoken: 'Spread the filling to the edges.' };
  assert.deepEqual(validateStep({ ...validStep(), watch_fors: [watch] }), {});
  const errors = validateStep({ ...validStep(), watch_fors: [watch, { ...watch, headline: 'one two three four five', spoken: '' }] });
  assert.ok(errors['watch.1.id']); assert.ok(errors['watch.1.headline']); assert.ok(errors['watch.1.spoken']);
});
test('drafts do not mutate the original watch-for or criteria arrays', () => {
  const step = { ...validStep(), watch_fors: [{ id: 'one', mistake: 'Original' }] };
  const draft = stepDraft(step); draft.watch_fors[0].mistake = 'Changed'; draft.success_criteria.push('Another');
  assert.equal(step.watch_fors[0].mistake, 'Original'); assert.equal(step.success_criteria.length, 1);
});
test('reference refresh preserves signed query parameters and refuses executable URLs', () => {
  const url = new URL(imageUrl('https://media.example/still.jpg?token=signed%2Bvalue', '123'));
  assert.equal(url.searchParams.get('token'), 'signed+value'); assert.equal(url.searchParams.get('review_frame'), '123');
  assert.equal(imageUrl('javascript:alert(1)'), null); assert.equal(imageUrl(null), null);
});

test('review API methods send the contract payload and URL-encode resource IDs', async () => {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => key === 'gc.demoKey' ? 'unit-test-key' : key === 'gc.apiBase' ? 'https://api.example' : null };
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return new Response('{}', { status: options.method === 'DELETE' ? 200 : 200 }); };
  try {
    await createRecipe({ title: 'Lesson', step_marks_s: [], consent: true });
    await patchStep('step/one', { timestamp_s: 12.1 }); await publishRecipe('recipe/one'); await deleteRecipe('recipe/one');
    assert.equal(calls[0].headers['X-Demo-Key'], 'unit-test-key'); assert.equal(JSON.parse(calls[0].body).consent, true);
    assert.match(calls[1].url, /steps\/step%2Fone$/); assert.equal(calls[1].method, 'PATCH');
    assert.equal(calls[2].method, 'POST'); assert.match(calls[2].url, /\/publish$/); assert.equal(calls[3].method, 'DELETE');
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});

test('signed video PUT has no demo-key or credential header, reports progress, and surfaces failure', async () => {
  const previous = globalThis.XMLHttpRequest;
  let xhr;
  class Upload {
    constructor() { xhr = this; this.headers = {}; this.upload = {}; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    send(body) { this.body = body; }
    abort() { this.onabort(); }
  }
  globalThis.XMLHttpRequest = Upload;
  try {
    const values = [], result = putVideo('https://media.example/source.mp4?token=opaque', file, value => values.push(value));
    assert.equal(xhr.method, 'PUT'); assert.deepEqual(xhr.headers, { 'Content-Type': 'video/mp4' }); assert.equal(xhr.body, file);
    xhr.upload.onprogress({ lengthComputable: true, loaded: 2, total: 4 }); xhr.status = 200; xhr.onload(); await result;
    assert.deepEqual(values, [50]);
    const failed = putVideo('https://media.example/source.mp4', file); xhr.status = 403; xhr.onload();
    await assert.rejects(failed, /HTTP 403/);
    const controller = new AbortController(), aborted = putVideo('https://media.example/source.mp4', file, undefined, { signal: controller.signal });
    controller.abort(); await assert.rejects(aborted, /stopped/);
  } finally { globalThis.XMLHttpRequest = previous; }
});
