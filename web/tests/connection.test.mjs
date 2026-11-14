import test from 'node:test';
import assert from 'node:assert/strict';
import { probeConnection } from '../shared/connection.js';
import { ApiError } from '../shared/api.js';

const h = { ai_mode: 'gemini', storage: 'supabase', contract_version: '2.0' };
test('public homepage checks health without touching the key-protected library', async () => {
  let privateCalls = 0;
  const result = await probeConnection({ requiresKey: false, readHealth: async () => h,
    readRecipes: async () => { privateCalls++; throw new ApiError({ status: 401 }); } });
  assert.equal(result.state, 'ok'); assert.equal(privateCalls, 0); assert.deepEqual(result.h, h);
});
test('tools continue reporting a missing or rejected private key', async () => {
  const result = await probeConnection({ demoKey: 'incorrect-test-key', readHealth: async () => h,
    readRecipes: async () => { throw new ApiError({ status: 401 }); } });
  assert.equal(result.state, 'unauthorized'); assert.deepEqual(result.h, h);
});
test('public pages retain fake-mode and offline warnings', async () => {
  const fake = await probeConnection({ requiresKey: false, readHealth: async () => ({ ...h, ai_mode: 'fake' }) });
  assert.equal(fake.state, 'fake');
  const down = await probeConnection({ requiresKey: false, readHealth: async () => { throw new Error('Network unavailable'); } });
  assert.equal(down.state, 'down'); assert.equal(down.detail, 'Network unavailable');
});
test('a protected library failure is not incorrectly labelled live', async () => {
  const result = await probeConnection({ demoKey: 'test-key', readHealth: async () => h,
    readRecipes: async () => { throw new ApiError({ status: 500, message: 'Storage unavailable' }); } });
  assert.equal(result.state, 'down'); assert.equal(result.detail, 'Storage unavailable');
});
test('an empty key prompts connection without claiming a key was rejected', async () => {
  let reads = 0;
  const result = await probeConnection({ demoKey: '', readHealth: async () => h, readRecipes: async () => { reads++; } });
  assert.equal(result.state, 'key_required'); assert.equal(reads, 0); assert.deepEqual(result.h, h);
});
