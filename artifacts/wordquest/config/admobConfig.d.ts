export interface AdMobConfig {
  androidAppId: string;
  iosAppId?: string;
  bannerUnitId: string;
  interstitialUnitId: string;
  rewardedUnitId: string;
}

export declare const TEST_ADMOB_CONFIG: Readonly<AdMobConfig>;
export declare const REQUIRED_PRODUCTION_KEYS: readonly string[];

export declare function resolveAdMobConfig(
  environment?: Record<string, string | undefined>,
): AdMobConfig;
