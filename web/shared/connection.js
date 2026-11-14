import { health, listRecipes, ApiError } from './api.js';

/** Public pages probe health; tools also verify access to private recipes. */
export async function probeConnection({ requiresKey = true, readHealth = health, readRecipes = listRecipes } = {}) {
  let h;
  try { h = await readHealth(); }
  catch (error) { return { state: 'down', detail: error.message || 'No answer' }; }
  if (requiresKey) {
    try { await readRecipes('published'); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) return { state: 'unauthorized', h };
      return { state: 'down', detail: error.message || 'Cannot reach the recipe library', h };
    }
  }
  return { state: h.ai_mode === 'fake' ? 'fake' : 'ok', h };
}
