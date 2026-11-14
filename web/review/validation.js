export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const wordCount = value => String(value ?? '').trim().split(/\s+/u).filter(Boolean).length;

export function uploadErrors({ file, title, consent }) {
  const errors = [];
  if (!String(title ?? '').trim() || title.trim().length > 80) errors.push('Enter a title of 1–80 characters.');
  if (!consent) errors.push('Consent is required before uploading.');
  if (!file) errors.push('Choose an MP4 recording.');
  else {
    if (!/\.mp4$/i.test(file.name) || !['', 'video/mp4', 'application/mp4'].includes(file.type)) errors.push('Choose an MP4 file. Other video formats are not supported.');
    if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) errors.push('The recording must be non-empty and no larger than 500 MB.');
  }
  return errors;
}

export function mistakeId(text, used = []) {
  let base = String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'mistake';
  if (!/^[a-z]/.test(base)) base = `mistake_${base}`;
  let id = base, suffix = 2;
  while (used.includes(id)) id = `${base}_${suffix++}`;
  return id;
}

export function validateStep(draft) {
  const errors = {};
  for (const [name, limit] of [['title', 4], ['key_line', 8]]) {
    if (!draft[name]?.trim()) errors[name] = 'This field is required.';
    else if (wordCount(draft[name]) > limit) errors[name] = `Use at most ${limit} words.`;
  }
  if (!draft.instruction?.trim()) errors.instruction = 'Add the full spoken instruction.';
  if (draft.success_criteria.length > 20) errors.success_criteria = 'Use at most 20 criteria.';
  if (draft.timer_s !== null && (!Number.isInteger(draft.timer_s) || draft.timer_s < 0 || draft.timer_s > 86400)) errors.timer_s = 'Use whole seconds from 0 to 86400, or leave empty.';
  if (!Number.isFinite(draft.timestamp_s) || draft.timestamp_s < 0) errors.timestamp_s = 'Use a non-negative timestamp in seconds.';
  if (draft.watch_fors.length > 20) errors.watch_fors = 'Use at most 20 known mistakes.';
  const ids = new Set();
  draft.watch_fors.forEach((watch, index) => {
    const prefix = `watch.${index}.`;
    if (!/^[a-z][a-z0-9_]*$/.test(watch.id) || ids.has(watch.id)) errors[prefix + 'id'] = 'Use a unique snake_case ID.';
    ids.add(watch.id);
    for (const name of ['mistake', 'headline', 'fix', 'spoken']) {
      if (!watch[name]?.trim()) errors[prefix + name] = 'This field is required.';
    }
    if (wordCount(watch.headline) > 4) errors[prefix + 'headline'] = 'Use at most 4 words.';
    if (wordCount(watch.fix) > 8) errors[prefix + 'fix'] = 'Use at most 8 words.';
  });
  return errors;
}

export function stepDraft(step) {
  return {
    title: step.title, key_line: step.key_line, instruction: step.instruction,
    success_criteria: [...step.success_criteria], timer_s: step.timer_s,
    timestamp_s: step.timestamp_s, watch_fors: step.watch_fors.map(w => ({ ...w })),
  };
}

export function imageUrl(raw, revision = '') {
  if (!raw) return null;
  try {
    const url = new URL(raw, globalThis.location?.origin || 'http://localhost');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (revision) url.searchParams.set('review_frame', revision);
    return url.href;
  } catch { return null; }
}
