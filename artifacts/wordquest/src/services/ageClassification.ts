import AsyncStorage from '@react-native-async-storage/async-storage';

export const AGE_CLASSIFICATION_STORAGE_KEY = '@wordquest/privacy/age-classification';
export const AGE_CLASSIFICATION_SCHEMA_VERSION = 1;

export type AgeBand = 'under13' | '13-17' | '18+' | 'unknown';
export type AgeClassificationSource = 'self-declared' | 'verified' | 'declined';

export interface AgeClassificationRecord {
  ageBand: AgeBand;
  source: AgeClassificationSource;
  schemaVersion: typeof AGE_CLASSIFICATION_SCHEMA_VERSION;
}

export type AgeClassificationLoadResult =
  | { status: 'loaded'; record: AgeClassificationRecord }
  | { status: 'missing' }
  | { status: 'corrupt' }
  | { status: 'read-error' };

function isRecord(value: unknown): value is AgeClassificationRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const ageBandIsValid =
    candidate.ageBand === 'under13' ||
    candidate.ageBand === '13-17' ||
    candidate.ageBand === '18+' ||
    candidate.ageBand === 'unknown';
  const sourceIsValid =
    candidate.source === 'self-declared' ||
    candidate.source === 'verified' ||
    candidate.source === 'declined';

  return (
    Object.keys(candidate).length === 3 &&
    ageBandIsValid &&
    sourceIsValid &&
    candidate.schemaVersion === AGE_CLASSIFICATION_SCHEMA_VERSION &&
    ((candidate.ageBand === 'unknown') === (candidate.source === 'declined'))
  );
}

/**
 * Serializes age-classification storage operations. A malformed value is left
 * untouched until the user explicitly selects or removes a classification.
 */
export class AgeClassificationStore {
  private operationQueue: Promise<void> = Promise.resolve();

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operationQueue.then(operation, operation);
    this.operationQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  load(): Promise<AgeClassificationLoadResult> {
    return this.serialize(async () => {
      let raw: string | null;
      try {
        raw = await AsyncStorage.getItem(AGE_CLASSIFICATION_STORAGE_KEY);
      } catch {
        return { status: 'read-error' };
      }

      if (raw === null) return { status: 'missing' };

      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return { status: 'corrupt' };
        return { status: 'loaded', record: parsed };
      } catch {
        return { status: 'corrupt' };
      }
    });
  }

  save(record: AgeClassificationRecord): Promise<void> {
    return this.serialize(async () => {
      if (!isRecord(record)) throw new Error('Invalid age classification.');
      await AsyncStorage.setItem(AGE_CLASSIFICATION_STORAGE_KEY, JSON.stringify(record));
    });
  }

  remove(): Promise<void> {
    return this.serialize(() => AsyncStorage.removeItem(AGE_CLASSIFICATION_STORAGE_KEY));
  }
}

export const ageClassificationStore = new AgeClassificationStore();

export function createAgeClassification(
  ageBand: Exclude<AgeBand, 'unknown'>,
): AgeClassificationRecord {
  return {
    ageBand,
    source: 'self-declared',
    schemaVersion: AGE_CLASSIFICATION_SCHEMA_VERSION,
  };
}

export function createDeclinedAgeClassification(): AgeClassificationRecord {
  return {
    ageBand: 'unknown',
    source: 'declined',
    schemaVersion: AGE_CLASSIFICATION_SCHEMA_VERSION,
  };
}

export function ageBandLabel(ageBand: AgeBand | null): string {
  switch (ageBand) {
    case 'under13':
      return 'Under 13';
    case '13-17':
      return '13–17';
    case '18+':
      return '18+';
    default:
      return 'Not provided';
  }
}
