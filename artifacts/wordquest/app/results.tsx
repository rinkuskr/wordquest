import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton } from '@/src/components/ui';
import { CATEGORIES } from '@/src/data/categories';
import { useGame } from '@/src/game/GameProvider';
import { adProvider } from '@/src/services/ads';

export default function ResultsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { summary, selectCategory, resetSummary } = useGame();
  const completionTransitionHandled = useRef(false);
  const currentIndex = summary ? CATEGORIES.findIndex((item) => item.id === summary.categoryId) : -1;
  const nextCategory = CATEGORIES[currentIndex + 1];

  const recordCompletedTransition = () => {
    if (!summary?.completed || completionTransitionHandled.current) return;
    completionTransitionHandled.current = true;
    void adProvider.recordCompletedPuzzleTransition();
  };

  if (!summary) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.title, { color: colors.foreground }]}>No results yet</Text>
          <PrimaryButton title="Back home" onPress={() => router.replace('/')} style={styles.action} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={[styles.heroIcon, { backgroundColor: summary.completed ? '#fff0dc' : '#e5efff' }]}>
          <Feather
            name={summary.completed ? 'award' : 'rotate-cw'}
            size={35}
            color={summary.completed ? colors.orange : colors.primary}
          />
        </View>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
          {summary.completed ? 'PUZZLE COMPLETE' : 'TIME IS UP'}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {summary.completed ? 'Nicely done.' : 'Good effort.'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {summary.categoryName} · {summary.wordsFound} of {summary.totalWords} words found
        </Text>

        <View style={[styles.scoreCard, { backgroundColor: colors.navy }]}>
          <Text style={styles.scoreLabel}>FINAL SCORE</Text>
          <Text style={styles.score}>{summary.score}</Text>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreDetails}>
            <View style={styles.scoreDetail}>
              <Text style={styles.detailNumber}>{summary.bonusWords}</Text>
              <Text style={styles.detailLabel}>BONUS WORDS</Text>
            </View>
            <View style={styles.scoreDetail}>
              <Text style={styles.detailNumber}>{formatDuration(summary.elapsedSeconds)}</Text>
              <Text style={styles.detailLabel}>TIME</Text>
            </View>
            <View style={styles.scoreDetail}>
              <Text style={styles.detailNumber}>+{summary.timeBonus}</Text>
              <Text style={styles.detailLabel}>TIME BONUS</Text>
            </View>
          </View>
        </View>

        {summary.earnedCoins > 0 && (
          <View style={[styles.reward, { backgroundColor: '#fff7e8', borderColor: '#ffe7b5' }]}>
            <Feather name="circle" size={17} color={colors.orange} />
            <Text style={[styles.rewardText, { color: colors.foreground }]}>
              First chapter reward <Text style={{ fontWeight: '900' }}>+{summary.earnedCoins} coins</Text>
            </Text>
            <Feather name="check-circle" size={17} color="#28a667" />
          </View>
        )}

        <View style={styles.actions}>
          <PrimaryButton
            title={summary.completed && nextCategory ? 'Next world' : 'Play again'}
            icon={summary.completed && nextCategory ? 'arrow-right' : 'rotate-cw'}
            onPress={() => {
              recordCompletedTransition();
              if (summary.completed && nextCategory) selectCategory(nextCategory.id);
              resetSummary();
              router.replace('/modes');
            }}
            style={styles.action}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              recordCompletedTransition();
              resetSummary();
              router.replace('/');
            }}
            style={({ pressed }) => [styles.homeButton, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Feather name="home" size={17} color={colors.foreground} />
            <Text style={[styles.homeText, { color: colors.foreground }]}>Home</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 22 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 12 },
  heroIcon: { width: 70, height: 70, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { fontSize: 9, letterSpacing: 1.6, fontWeight: '900' },
  title: { fontSize: 31, fontWeight: '900', letterSpacing: -1.2, marginTop: 7 },
  subtitle: { fontSize: 12, marginTop: 5, textAlign: 'center' },
  scoreCard: { width: '100%', borderRadius: 25, padding: 22, alignItems: 'center', marginTop: 25 },
  scoreLabel: { fontSize: 9, letterSpacing: 1.5, color: '#bfc9e5', fontWeight: '800' },
  score: { fontSize: 54, fontWeight: '900', color: '#ffffff', lineHeight: 63, marginTop: 4 },
  scoreDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.17)', alignSelf: 'stretch', marginVertical: 15 },
  scoreDetails: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  scoreDetail: { flex: 1, alignItems: 'center' },
  detailNumber: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  detailLabel: { color: '#bfc9e5', fontSize: 8, fontWeight: '800', letterSpacing: 0.7, marginTop: 5 },
  reward: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 13 },
  rewardText: { flex: 1, fontSize: 12, fontWeight: '600' },
  actions: { width: '100%', marginTop: 20 },
  action: { width: '100%' },
  homeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15 },
  homeText: { fontWeight: '800', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
});
