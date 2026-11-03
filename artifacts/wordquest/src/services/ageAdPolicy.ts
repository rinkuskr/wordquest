import type { AdsAgeRestrictedTreatment, AdsProvider } from './ads.core';
import type { AgeBand, AgeClassificationRecord } from './ageClassification';

export type TeenAdEligibility =
  | { status: 'eligible'; tagForUnderAgeOfConsent: boolean }
  | { status: 'ineligible' | 'unknown'; reason: string };

export interface AgeAdsDecision {
  eligible: boolean;
  reason: string;
  treatment?: AdsAgeRestrictedTreatment;
  tagForUnderAgeOfConsent?: boolean;
}

/**
 * Teen ad eligibility intentionally remains unresolved until the product's
 * country-specific legal and platform requirements have been reviewed.
 */
export function resolveTeenAdEligibility(): TeenAdEligibility {
  return {
    status: 'unknown',
    reason: 'Teen ad eligibility has not been confirmed for the user’s region.',
  };
}

export function resolveAgeAdsDecision(
  ageBand: AgeBand,
  teenEligibility: TeenAdEligibility = resolveTeenAdEligibility(),
): AgeAdsDecision {
  if (ageBand === 'under13') {
    return { eligible: false, reason: 'Ads are disabled for users under 13.' };
  }

  if (ageBand === 'unknown') {
    return { eligible: false, reason: 'Ads are disabled until an age range is selected.' };
  }

  if (ageBand === '13-17') {
    if (teenEligibility.status !== 'eligible') {
      return {
        eligible: false,
        reason: teenEligibility.reason,
      };
    }

    return {
      eligible: true,
      reason: 'Teen ad eligibility was explicitly confirmed.',
      treatment: 'TEEN',
      tagForUnderAgeOfConsent: teenEligibility.tagForUnderAgeOfConsent,
    };
  }

  return {
    eligible: true,
    reason: 'Adult age range selected.',
    treatment: 'UNSPECIFIED',
    tagForUnderAgeOfConsent: false,
  };
}

export async function initializeAdsForAgeClassification(
  record: AgeClassificationRecord | null,
  provider: Pick<AdsProvider, 'initialize'>,
  teenEligibility: TeenAdEligibility = resolveTeenAdEligibility(),
): Promise<AgeAdsDecision> {
  const decision = resolveAgeAdsDecision(record?.ageBand ?? 'unknown', teenEligibility);
  if (!decision.eligible || !decision.treatment) return decision;

  await provider.initialize({
    ageRestrictedTreatment: decision.treatment,
    tagForUnderAgeOfConsent: decision.tagForUnderAgeOfConsent,
  });
  return decision;
}
