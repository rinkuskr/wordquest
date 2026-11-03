import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { IconButton } from '@/src/components/ui';
import LetterGrid from '@/src/components/LetterGrid';
import { getCategory } from '@/src/data/categories';
import { getCategoryPuzzlePlan } from '@/src/data/difficulty';
import { useGame } from '@/src/game/GameProvider';
import { audioService } from '@/src/services/audio';
import { useAdsState } from '@/src/services/useAdsState';
import { useGameClock } from '@/src/hooks/useGameClock';
import { getGameBoardSize } from '@/src/engine/gameLayout';

export default function GameScreen() {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { game, hintCells, showHint, requestRewardedHint, recordSelection, resumeClock, pauseClock, syncClock } = useGame();
  const [notice, setNotice] = useState<string | null>(null);
  const adsState = useAdsState();
  const category = game ? getCategory(game.categoryId) : undefined;
  const boardSize = getGameBoardSize(width, height - insets.top - insets.bottom);

  useGameClock({
    active: !!game && !game.ended,
    resumeClock,
    pauseClock,
    syncClock,
  });

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 1250);
    return () => clearTimeout(timeout);
  }, [notice]);

  const onSelection = useCallback((cells: { row: number; col: number }[]) => {
    const result = recordSelection(cells);
    if (result === 'puzzle') setNotice('Word found · +10');
    else if (result === 'bonus') setNotice('Bonus word · +5');
    else if (result === 'invalid') setNotice('Not a word');
  }, [recordSelection]);

  if (!game || !category) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.empty}>
          <IconButton icon="arrow-left" accessibilityLabel="Back to modes" onPress={() => router.back()} />
          <View style={[styles.emptyIcon, { backgroundColor: '#fff0dc' }]}>
            <Feather name="clock" size={27} color={colors.orange} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No active puzzle</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Choose a category and start a new puzzle to play.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const plan = getCategoryPuzzlePlan(category);
  const remaining = Math.max(0, game.timeLimitSeconds - game.elapsedSeconds);
  const timeText = game.mode === 'time' ? remaining : game.elapsedSeconds;
  const isUrgent = game.mode === 'time' && remaining < 30;
  const foundSet = new Set(game.foundWords);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <IconButton icon="x" accessibilityLabel="Exit puzzle" onPress={() => { pauseClock(); router.back(); }} />
        <View style={styles.categoryHeading}>
          <Text style={[styles.categoryName, { color: colors.foreground }]}>{category.emoji} {category.name}</Text>
          <Text style={[styles.modeCaption, { color: colors.mutedForeground }]}>
            {`${plan.tier.toUpperCase()} · ${game.mode === 'classic' ? 'CLASSIC MODE' : 'TIME MODE'}`}
          </Text>
        </View>
        <View style={[styles.scorePill, { backgroundColor: '#fff0dc' }]}>
          <Feather name="star" size={14} color={colors.orange} />
          <Text style={[styles.scoreText, { color: colors.foreground }]}>{game.score}</Text>
        </View>
      </View>

      <View style={styles.timerRow}>
        <View style={styles.wordsProgress}>
          <Text style={[styles.wordsCount, { color: colors.foreground }]}>{game.foundWords.length}</Text>
          <Text style={[styles.wordsDivider, { color: colors.mutedForeground }]}> / {game.puzzle.words.length} words</Text>
        </View>
        <View style={[styles.timer, { backgroundColor: isUrgent ? '#ffe7ef' : colors.card }]}>
          <Feather name="clock" size={15} color={isUrgent ? colors.pink : colors.primary} />
          <Text style={[styles.timerText, { color: isUrgent ? colors.pink : colors.foreground }]}>
            {formatTime(timeText)}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${game.puzzle.words.length ? (game.foundWords.length / game.puzzle.words.length) * 100 : 0}%` }]} />
      </View>
      {game.puzzle.placementDiagnostics &&
        !game.puzzle.placementDiagnostics.distributionSatisfied && (
          <Text style={[styles.layoutNotice, { color: colors.orange }]}>
            Target diagonal count was not reached within the retry limit ({game.puzzle.placementDiagnostics.actualDiagonalCount}/{game.puzzle.placementDiagnostics.requestedDiagonalCount}); all words remain playable.
          </Text>
        )}

      <View style={styles.playArea}>
        <View style={[styles.gridWrap, { width: boardSize }]}>
          <LetterGrid
            puzzle={game.puzzle}
            foundWords={game.foundWords}
            hintCells={hintCells}
            onSelection={onSelection}
          />
          {!!notice && (
            <View pointerEvents="none" style={[styles.notice, { backgroundColor: colors.navy }]}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.wordSection}>
        <View style={styles.wordHeading}>
          <Text style={[styles.wordLabel, { color: colors.mutedForeground }]}>FIND THESE WORDS</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use a hint"
            disabled={game.hintsLeft <= 0}
            testID="hint-button"
            onPress={() => {
              const used = showHint();
              setNotice(used ? 'Follow the yellow highlight' : 'No hints remaining');
              if (used) void audioService.play('tap');
            }}
            style={({ pressed }) => [
              styles.hintButton,
              { backgroundColor: '#fff2ca', opacity: game.hintsLeft <= 0 ? 0.45 : pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="sun" size={15} color="#a76c05" />
            <Text style={styles.hintText}>Hint</Text>
            <View style={styles.hintBadge}><Text style={styles.hintCount}>{game.hintsLeft}</Text></View>
          </Pressable>
        </View>
        {game.hintsLeft === 0 && adsState === 'ready' && (
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              const granted = await requestRewardedHint();
              setNotice(granted ? 'Extra hint added' : 'The ad was not completed');
            }}
            style={({ pressed }) => [styles.rewardedButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="play-circle" size={14} color={colors.primary} />
            <Text style={[styles.rewardedText, { color: colors.primary }]}>Watch an ad for one more hint</Text>
          </Pressable>
        )}
        <ScrollView style={styles.wordListScroll} contentContainerStyle={styles.wordList} showsVerticalScrollIndicator={false}>
          {game.puzzle.words.map((word) => {
            const found = foundSet.has(word);
            return (
              <View
                key={word}
                style={[
                  styles.wordChip,
                  { backgroundColor: found ? '#e6e6eb' : colors.card, borderColor: found ? '#e6e6eb' : colors.border },
                ]}
              >
                {found && <Feather name="check" size={11} color="#777783" />}
                <Text style={[styles.wordText, { color: found ? colors.found : colors.foreground }, found && styles.wordFound]}>
                  {word}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
      <Text style={[styles.dragHint, { color: colors.mutedForeground }]}>Drag across letters in a straight line</Text>
    </SafeAreaView>
  );
}

function formatTime(total: number) {
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 17 },
  top: { width: '100%', maxWidth: 520, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', minHeight: 50, marginTop: 2 },
  categoryHeading: { flex: 1, alignItems: 'center' },
  categoryName: { fontSize: 15, fontWeight: '800' },
  modeCaption: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginTop: 4 },
  scorePill: { minWidth: 59, height: 35, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  scoreText: { fontSize: 13, fontWeight: '800' },
  timerRow: { width: '100%', maxWidth: 520, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 10 },
  wordsProgress: { flexDirection: 'row', alignItems: 'baseline' },
  wordsCount: { fontSize: 22, fontWeight: '900' },
  wordsDivider: { fontSize: 13, fontWeight: '600' },
  timer: { minWidth: 94, height: 37, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timerText: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '800' },
  progressTrack: { width: '100%', maxWidth: 520, alignSelf: 'center', height: 5, backgroundColor: '#e2e2e9', borderRadius: 4, overflow: 'hidden', marginBottom: 13 },
  progressFill: { height: 5, borderRadius: 4 },
  playArea: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  gridWrap: { aspectRatio: 1, maxWidth: 520, alignSelf: 'center', position: 'relative' },
  notice: { position: 'absolute', alignSelf: 'center', bottom: 12, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14 },
  noticeText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  wordSection: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  wordHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 10 },
  wordLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  hintButton: { borderRadius: 14, minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9 },
  hintText: { color: '#76510e', fontSize: 11, fontWeight: '800' },
  hintBadge: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#f83f8f', alignItems: 'center', justifyContent: 'center' },
  hintCount: { color: '#ffffff', fontSize: 9, fontWeight: '900' },
  rewardedButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 7 },
  rewardedText: { fontSize: 10, fontWeight: '800' },
  wordListScroll: { flexGrow: 0, maxHeight: 100 },
  wordList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingBottom: 4 },
  wordChip: { borderWidth: 1, borderRadius: 10, minHeight: 28, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  wordText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  wordFound: { textDecorationLine: 'line-through' },
  dragHint: { width: '100%', maxWidth: 520, alignSelf: 'center', textAlign: 'center', fontSize: 10, paddingTop: 8, paddingBottom: 3 },
  layoutNotice: { width: '100%', textAlign: 'center', fontSize: 10, fontWeight: '700', paddingTop: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 38 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 19 },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9 },
});
