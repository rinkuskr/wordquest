import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useColors } from '@/hooks/useColors';
import { nativeAdsConfig } from '@/src/services/ads';
import { useAdsState } from '@/src/services/useAdsState';

export default function AdBannerSlot() {
  const colors = useColors();
  const adsState = useAdsState();
  if (adsState !== 'ready') return null;

  return (
    <View
      accessibilityLabel="Advertisement"
      style={[styles.slot, { backgroundColor: colors.background }]}
    >
      <BannerAd
        unitId={nativeAdsConfig.bannerUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => {
          // Keep the slot reserved; no-fill must never affect gameplay.
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
});
