import React, { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useColors } from '@/hooks/useColors';
import { GameProvider } from '@/src/game/GameProvider';
import { useGame } from '@/src/game/GameProvider';
import { AgeClassificationProvider, useAgeClassification } from '@/src/age/AgeClassificationProvider';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  const {
    progressLoadStatus,
    progressRecovery,
    progressSaveError,
    retryLoadProgress,
    acceptRecoveredProgress,
    startFreshProgress,
    retrySaveProgress,
  } = useGame();
  const {
    notice: ageNotice,
    storageError: ageStorageError,
    restartRequired: ageRestartRequired,
  } = useAgeClassification();

  const showProgressRecovery =
    progressLoadStatus === 'read-error' || progressLoadStatus === 'recovery-required';
  const showNotice = showProgressRecovery || !!progressSaveError;

  const confirmStartFresh = () => {
    Alert.alert(
      'Start with fresh progress?',
      'The original saved data has been backed up on this device. This replaces the active save with the 300-coin starting progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start fresh', style: 'destructive', onPress: () => void startFreshProgress() },
      ],
    );
  };

  return (
    <View style={styles.root}>
      {showNotice && (
        <View
          accessibilityRole="alert"
          style={[styles.progressNotice, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {showProgressRecovery && (
            <>
              <Text style={[styles.noticeTitle, { color: colors.foreground }]}>
                {progressLoadStatus === 'read-error' ? 'Saved progress is unavailable' : 'Saved progress needs recovery'}
              </Text>
              <Text style={[styles.noticeMessage, { color: colors.mutedForeground }]}>
                {progressRecovery?.message ??
                  "We couldn't read your saved progress. Nothing was reset or overwritten. Check device storage and retry."}
              </Text>
              <View style={styles.noticeActions}>
                <NoticeAction title="Retry loading" onPress={() => void retryLoadProgress()} />
                {progressRecovery?.backupSaved && progressRecovery.recoveredProgress && (
                  <NoticeAction
                    title="Use recovered progress"
                    onPress={() => void acceptRecoveredProgress()}
                  />
                )}
                {progressRecovery?.backupSaved && (
                  <NoticeAction title="Start fresh" onPress={confirmStartFresh} />
                )}
              </View>
            </>
          )}
          {!!progressSaveError && (
            <>
              <Text style={[styles.noticeTitle, { color: colors.foreground }]}>Progress was not saved</Text>
              <Text style={[styles.noticeMessage, { color: colors.mutedForeground }]}>
                {progressSaveError}
              </Text>
              <View style={styles.noticeActions}>
                <NoticeAction title="Retry saving" onPress={() => void retrySaveProgress()} />
              </View>
            </>
          )}
        </View>
      )}
      {!!ageNotice && (
        <View
          accessibilityRole="alert"
          style={[styles.ageNotice, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.noticeTitle, { color: colors.foreground }]}>
            {ageRestartRequired ? 'Ads paused' : 'Age and ad settings'}
          </Text>
          <Text style={[styles.noticeMessage, { color: colors.mutedForeground }]}>{ageNotice}</Text>
        </View>
      )}
      {!!ageStorageError && !ageNotice && (
        <View
          accessibilityRole="alert"
          style={[styles.ageNotice, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.noticeTitle, { color: colors.foreground }]}>Age choice unavailable</Text>
          <Text style={[styles.noticeMessage, { color: colors.mutedForeground }]}>{ageStorageError}</Text>
        </View>
      )}
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="modes" />
        <Stack.Screen name="game" />
        <Stack.Screen name="results" />
      </Stack>
    </View>
  );
}

function NoticeAction({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.noticeAction}>
      <Text style={styles.noticeActionText}>{title}</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <GameProvider>
              <AgeClassificationProvider>
                <RootLayoutNav />
              </AgeClassificationProvider>
            </GameProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressNotice: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 5,
  },
  ageNotice: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 4,
  },
  noticeTitle: { fontSize: 13, fontWeight: '800' },
  noticeMessage: { fontSize: 12, lineHeight: 17 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  noticeAction: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 11,
    backgroundColor: '#e8efff',
  },
  noticeActionText: { color: '#2459bd', fontSize: 11, fontWeight: '800' },
});
