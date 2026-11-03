import { describe, expect, it, vi } from 'vitest';
import {
  initializeAdsForAgeClassification,
  resolveAgeAdsDecision,
  resolveTeenAdEligibility,
} from '../src/services/ageAdPolicy';
import { createAgeClassification } from '../src/services/ageClassification';

describe('age-based ad startup policy', () => {
  it.each(['under13', 'unknown'] as const)('does not initialize ads for %s users', async (ageBand) => {
    const initialize = vi.fn(async () => 'ready' as const);
    const result = await initializeAdsForAgeClassification(
      ageBand === 'unknown' ? null : createAgeClassification('under13'),
      { initialize },
    );

    expect(result.eligible).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
  });

  it('fails closed for teens until regional policy eligibility is explicitly confirmed', async () => {
    const initialize = vi.fn(async () => 'ready' as const);

    expect(resolveTeenAdEligibility().status).toBe('unknown');
    const result = await initializeAdsForAgeClassification(
      createAgeClassification('13-17'),
      { initialize },
    );

    expect(result.eligible).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
  });

  it('uses TEEN and the resolved UMP under-age flag for an explicitly eligible teen', async () => {
    const initialize = vi.fn(async () => 'ready' as const);
    const result = await initializeAdsForAgeClassification(
      createAgeClassification('13-17'),
      { initialize },
      { status: 'eligible', tagForUnderAgeOfConsent: true },
    );

    expect(result).toMatchObject({
      eligible: true,
      treatment: 'TEEN',
      tagForUnderAgeOfConsent: true,
    });
    expect(initialize).toHaveBeenCalledWith({
      ageRestrictedTreatment: 'TEEN',
      tagForUnderAgeOfConsent: true,
    });
  });

  it('uses UNSPECIFIED and clears the UMP under-age flag only for the adult band', async () => {
    const initialize = vi.fn(async () => 'ready' as const);
    const result = await initializeAdsForAgeClassification(
      createAgeClassification('18+'),
      { initialize },
    );

    expect(result).toMatchObject({
      eligible: true,
      treatment: 'UNSPECIFIED',
      tagForUnderAgeOfConsent: false,
    });
    expect(initialize).toHaveBeenCalledWith({
      ageRestrictedTreatment: 'UNSPECIFIED',
      tagForUnderAgeOfConsent: false,
    });
  });

  it('exposes an explicit ineligible decision without inventing a country rule', () => {
    expect(
      resolveAgeAdsDecision('13-17', {
        status: 'ineligible',
        reason: 'This region has not been cleared.',
      }),
    ).toMatchObject({ eligible: false, reason: 'This region has not been cleared.' });
  });
});
