import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { CoinPill, IconButton, PrimaryButton } from '@/src/components/ui';
import AdBannerSlot from '@/src/components/AdBannerSlot';
import { useGame } from '@/src/game/GameProvider';
import { adProvider } from '@/src/services/ads';
import { audioService } from '@/src/services/audio';

const tiles = [
  ['W', 'O', 'R', 'D'],
  ['Q', 'U', 'E', 'S'],
  ['T', 'A', 'L', 'V'],
];

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { progress, ready, progressLoadStatus, toggleSound } = useGame();

  const openPrivacyOptions = async () => {
    const opened = await adProvider.showPrivacyOptionsForm();
    if (!opened) {
      Alert.alert('Privacy options', 'No privacy options are currently required for this device.');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={[styles.brandMark, { backgroundColor: colors.navy }]}>
              <Feather name="search" size={18} color="#ffffff" />
            </View>
            <Text style={[styles.brandName, { color: colors.foreground }]}>WordQuest</Text>
          </View>
          <View style={styles.actions}>
            {ready && <CoinPill amount={progress.coins} />}
            <IconButton
              icon={progress.soundEnabled ? 'volume-2' : 'volume-x'}
              accessibilityLabel={progress.soundEnabled ? 'Turn sound off' : 'Turn sound on'}
              onPress={toggleSound}
            />
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.kicker}>
            <View style={[styles.kickerDot, { backgroundColor: colors.orange }]} />
            <Text style={[styles.kickerText, { color: colors.mutedForeground }]}>A LITTLE PUZZLE, A BIG ADVENTURE</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Find your{'\n'}next <Text style={{ color: colors.primary }}>word.</Text>
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Slow down, scan the grid, and follow every hidden word.
          </Text>
        </View>

        <View style={[styles.board, { backgroundColor: colors.navy }]}>
          <View style={styles.boardTop}>
            <View style={styles.boardLabel}>
              <View style={styles.liveDot} />
              <Text style={styles.boardLabelText}>TODAY'S FOCUS</Text>
            </View>
            <Feather name="more-horizontal" size={20} color="#c5cde3" />
          </View>
          <View style={styles.previewGrid}>
            {tiles.flatMap((row, rowIndex) =>
              row.map((letter, colIndex) => {
                const accent = rowIndex === 1 && colIndex < 3;
                return (
                  <View
                    key={`${rowIndex}-${colIndex}`}
                    style={[
                      styles.previewCell,
                      { backgroundColor: accent ? colors.orange : 'rgba(255,255,255,0.12)' },
                    ]}
                  >
                    <Text style={[styles.previewLetter, { color: accent ? colors.navy : '#ffffff' }]}>{letter}</Text>
                  </View>
                );
              }),
            )}
          </View>
          <View style={styles.boardBottom}>
            <Text style={styles.boardBottomText}>A fresh puzzle awaits</Text>
            <Feather name="arrow-up-right" size={16} color="#d3daf0" />
          </View>
          <View style={[styles.boardOrb, { backgroundColor: colors.primary }]} />
        </View>

        <View style={styles.progressRow}>
          <View style={[styles.progressIcon, { backgroundColor: '#e3edff' }]}>
            <Feather name="layers" size={18} color={colors.primary} />
          </View>
          <View style={styles.progressCopy}>
            <Text style={[styles.progressTitle, { color: colors.foreground }]}>
              {!ready
                ? progressLoadStatus === 'loading'
                  ? 'Loading your saved progress'
                  : 'Your saved progress is unavailable'
                : progress.completedLevels.length === 0
                ? 'Your first chapter is ready'
                : `${progress.completedLevels.length} chapter${progress.completedLevels.length === 1 ? '' : 's'} complete`}
            </Text>
            <Text style={[styles.progressSubtitle, { color: colors.mutedForeground }]}>
              {ready
                ? 'Start with Animals and unlock each next world.'
                : 'Your saved coins and unlocked worlds will appear after progress loads.'}
            </Text>
          </View>
          <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
        </View>

        <PrimaryButton
          title="Choose a category"
          icon="play"
          disabled={!ready}
          onPress={() => {
            void audioService.play('tap');
            router.push('/categories');
          }}
          testID="home-play"
          style={styles.playButton}
        />
        <Pressable
          disabled={!ready}
          onPress={() => router.push('/categories')}
          style={({ pressed }) => [styles.secondaryLink, { opacity: !ready ? 0.45 : pressed ? 0.65 : 1 }]}
        >
          <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>Explore the 15 categories</Text>
          <Feather name="arrow-right" size={15} color={colors.mutedForeground} />
        </Pressable>
        {Platform.OS === 'android' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Privacy options"
            testID="privacy-options"
            onPress={() => void openPrivacyOptions()}
            style={({ pressed }) => [styles.privacyLink, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Feather name="shield" size={13} color={colors.mutedForeground} />
            <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>Privacy options</Text>
          </Pressable>
        )}
      </ScrollView>
      <AdBannerSlot />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 9, paddingBottom: 30 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hero: { paddingTop: 34, paddingBottom: 20 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  kickerDot: { width: 7, height: 7, borderRadius: 4 },
  kickerText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { fontSize: 45, lineHeight: 49, fontWeight: '900', letterSpacing: -2.1 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 11, maxWidth: 280 },
  board: { minHeight: 226, borderRadius: 28, padding: 20, overflow: 'hidden', position: 'relative' },
  boardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boardLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#64e2a2' },
  boardLabelText: { color: '#c5cde3', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  previewGrid: { flexDirection: 'row', gap: 5, alignSelf: 'center', marginTop: 19 },
  previewCell: { width: 37, height: 37, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  previewLetter: { fontSize: 16, fontWeight: '800' },
  boardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, zIndex: 1 },
  boardBottomText: { fontSize: 13, fontWeight: '700', color: '#d3daf0' },
  boardOrb: { width: 110, height: 110, borderRadius: 55, position: 'absolute', right: -49, bottom: -57, opacity: 0.2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 23 },
  progressIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  progressCopy: { flex: 1 },
  progressTitle: { fontWeight: '800', fontSize: 14 },
  progressSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  playButton: { marginTop: 2 },
  secondaryLink: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8, paddingVertical: 18 },
  secondaryText: { fontSize: 13, fontWeight: '700' },
  privacyLink: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: 9 },
  privacyText: { fontSize: 10, fontWeight: '700' },
});
