import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  rejectReads: false,
  rejectWrites: false,
  rejectRemoves: false,
  writes: 0,
  getItem: vi.fn(async (key: string) => {
    if (storage.rejectReads) throw new Error('simulated read failure');
    return storage.values.get(key) ?? null;
  }),
  setItem: vi.fn(async (key: string, value: string) => {
    storage.writes += 1;
    if (storage.rejectWrites) throw new Error('simulated write failure');
    storage.values.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    if (storage.rejectRemoves) throw new Error('simulated remove failure');
    storage.values.delete(key);
  }),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: storage.getItem,
    setItem: storage.setItem,
    removeItem: storage.removeItem,
  },
}));

import {
  AGE_CLASSIFICATION_SCHEMA_VERSION,
  AGE_CLASSIFICATION_STORAGE_KEY,
  AgeClassificationStore,
  createAgeClassification,
  createDeclinedAgeClassification,
} from '../src/services/ageClassification';

describe('local age classification storage', () => {
  beforeEach(() => {
    storage.values.clear();
    storage.rejectReads = false;
    storage.rejectWrites = false;
    storage.rejectRemoves = false;
    storage.writes = 0;
    vi.clearAllMocks();
  });

  it('returns missing when no age choice is stored without saving a default', async () => {
    const store = new AgeClassificationStore();

    await expect(store.load()).resolves.toEqual({ status: 'missing' });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ['under13', 'self-declared'],
    ['13-17', 'self-declared'],
    ['18+', 'self-declared'],
    ['unknown', 'declined'],
  ] as const)('loads a valid %s classification', async (ageBand, source) => {
    const record = {
      ageBand,
      source,
      schemaVersion: AGE_CLASSIFICATION_SCHEMA_VERSION,
    };
    storage.values.set(AGE_CLASSIFICATION_STORAGE_KEY, JSON.stringify(record));

    await expect(new AgeClassificationStore().load()).resolves.toEqual({
      status: 'loaded',
      record,
    });
  });

  it('stores only the coarse age band, source, and schema version', async () => {
    const store = new AgeClassificationStore();
    const classification = createAgeClassification('18+');

    await store.save(classification);

    expect(storage.values.get(AGE_CLASSIFICATION_STORAGE_KEY)).toBe(
      '{"ageBand":"18+","source":"self-declared","schemaVersion":1}',
    );
    expect(storage.values.get(AGE_CLASSIFICATION_STORAGE_KEY)).not.toContain('birth');
    expect(storage.values.get(AGE_CLASSIFICATION_STORAGE_KEY)).not.toContain('dateOfBirth');
  });

  it('persists a declined choice as unknown, not as an adult', async () => {
    const store = new AgeClassificationStore();

    await store.save(createDeclinedAgeClassification());

    await expect(store.load()).resolves.toEqual({
      status: 'loaded',
      record: { ageBand: 'unknown', source: 'declined', schemaVersion: 1 },
    });
  });

  it('treats a temporary read rejection as unknown and does not write defaults', async () => {
    const store = new AgeClassificationStore();
    storage.rejectReads = true;

    await expect(store.load()).resolves.toEqual({ status: 'read-error' });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('can retry a temporary read failure and load the existing choice', async () => {
    const store = new AgeClassificationStore();
    const record = createAgeClassification('13-17');
    storage.values.set(AGE_CLASSIFICATION_STORAGE_KEY, JSON.stringify(record));
    storage.rejectReads = true;

    await expect(store.load()).resolves.toEqual({ status: 'read-error' });
    storage.rejectReads = false;
    await expect(store.load()).resolves.toEqual({ status: 'loaded', record });
  });

  it('preserves malformed JSON until the user explicitly saves or removes it', async () => {
    const store = new AgeClassificationStore();
    const malformed = '{"ageBand":';
    storage.values.set(AGE_CLASSIFICATION_STORAGE_KEY, malformed);

    await expect(store.load()).resolves.toEqual({ status: 'corrupt' });
    expect(storage.values.get(AGE_CLASSIFICATION_STORAGE_KEY)).toBe(malformed);
    expect(storage.setItem).not.toHaveBeenCalled();

    await store.save(createAgeClassification('18+'));
    expect(storage.values.get(AGE_CLASSIFICATION_STORAGE_KEY)).not.toBe(malformed);
  });

  it.each([
    '{"ageBand":"18","source":"self-declared","schemaVersion":1}',
    '{"ageBand":"18+","source":"declined","schemaVersion":1}',
    '{"ageBand":"unknown","source":"self-declared","schemaVersion":1}',
    '{"ageBand":"under13","source":"self-declared","schemaVersion":99}',
  ])('treats invalid saved values as unknown without overwriting them', async (raw) => {
    const store = new AgeClassificationStore();
    storage.values.set(AGE_CLASSIFICATION_STORAGE_KEY, raw);

    await expect(store.load()).resolves.toEqual({ status: 'corrupt' });
    expect(storage.values.get(AGE_CLASSIFICATION_STORAGE_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('surfaces write and removal failures without pretending they succeeded', async () => {
    const store = new AgeClassificationStore();
    storage.rejectWrites = true;
    await expect(store.save(createAgeClassification('18+'))).rejects.toThrow('simulated write failure');

    storage.rejectWrites = false;
    storage.values.set(AGE_CLASSIFICATION_STORAGE_KEY, JSON.stringify(createAgeClassification('18+')));
    storage.rejectRemoves = true;
    await expect(store.remove()).rejects.toThrow('simulated remove failure');
    expect(storage.values.has(AGE_CLASSIFICATION_STORAGE_KEY)).toBe(true);
  });

  it('uses the dedicated age-classification key', () => {
    expect(AGE_CLASSIFICATION_STORAGE_KEY).toBe('@wordquest/privacy/age-classification');
  });
});
