import { expect, test } from 'bun:test';
import { createRemixPluginId } from '../src/lib/plugins/remix-id';
import { normalizePluginId, resolvePluginSaveId } from '../src/lib/plugins/utils';

test('a maximum-length legacy fork keeps its entire unique suffix on every new remix', () => {
  const sourceId = 'bloodline-v4-responsive-kinetic-typographyv4-remix-9bcf8a-remix-';
  expect(sourceId.length).toBe(64);
  const ids = Array.from({ length: 20 }, () => createRemixPluginId(sourceId));
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id).toMatch(/-remix-[a-f0-9]{12}$/);
    expect(normalizePluginId(id)).toBe(id);
    expect(id).not.toBe(sourceId);
  }
});

test('repeated remixes remain stable through the save pipeline', () => {
  let id = 'original-plugin';
  for (let i = 0; i < 10; i++) {
    const next = createRemixPluginId(id);
    expect(normalizePluginId(next)).toBe(next);
    expect(next).not.toBe(id);
    id = next;
  }
});

test('empty or non-ASCII names still produce a usable remix ID', () => {
  expect(createRemixPluginId('')).toMatch(/^plugin-remix-[a-f0-9]{12}$/);
  expect(createRemixPluginId('🔥')).toMatch(/^plugin-remix-[a-f0-9]{12}$/);
});

test('saving the existing legacy remix keeps its exact database and source key', async () => {
  const legacyId = 'bloodline-v4-responsive-kinetic-typographyv4-remix-9bcf8a-remix-';
  const savedSources = new Map([[legacyId, 'red source']]);
  const saveId = await resolvePluginSaveId(legacyId, async id => savedSources.has(id));
  savedSources.set(saveId, 'ocean-blue source');
  expect(saveId).toBe(legacyId);
  expect(savedSources.size).toBe(1);
  expect(savedSources.get(legacyId)).toBe('ocean-blue source');
  expect(await resolvePluginSaveId(legacyId, async () => false)).toBe(normalizePluginId(legacyId));
});

test('new names and new remix IDs keep normal creation behavior without a database lookup', async () => {
  const unexpectedLookup = async () => { throw new Error('No lookup needed'); };
  expect(await resolvePluginSaveId('New Ocean Theme!', unexpectedLookup)).toBe('new-ocean-theme');
  const remixId = createRemixPluginId('existing-plugin');
  expect(await resolvePluginSaveId(remixId, unexpectedLookup)).toBe(remixId);
});

test('a failed legacy-ID lookup stops the save instead of silently writing a second plugin', async () => {
  const legacyId = 'bloodline-v4-responsive-kinetic-typographyv4-remix-9bcf8a-remix-';
  await expect(resolvePluginSaveId(legacyId, async () => { throw new Error('database unavailable'); })).rejects.toThrow('database unavailable');
});
