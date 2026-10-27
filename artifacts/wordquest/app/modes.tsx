import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { IconButton, PageHeader, PrimaryButton } from '@/src/components/ui';
import { getCategory } from '@/src/data/categories';
import { useGame } from '@/src/game/GameProvider';
import type { GameMode } from '@/src/types/game';

export default function ModeSelectScreen() {
  const colors = useColors();
  const router = useRouter();
  const { selectedCategoryId, startGame, error, ready } = useGame();
  const category = getCategory(selectedCategoryId);
  const [mode, setMode] = useState<GameMode>('classic');
  const canPlay = ready && !!category?.words.length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <PageHeader title="Pick your pace" subtitle={category?.name ?? 'Choose a game mode'} onBack={() => router.back()} right={<IconButton icon="help-circle" accessibilityLabel="How to play" onPress={() => Alert.alert('How to play', 'Choose a mode, then drag across adjacent letters in a straight horizontal, vertical, or diagonal line. Find every listed word to complete the puzzle.')} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.categoryBanner, { backgroundColor: colors.navy }]}>
          <Text style={styles.categoryEmoji}>{category?.emoji ?? '🔎'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerEyebrow}>YOUR NEXT PUZZLE</Text>
            <Text style={styles.bannerTitle}>{category?.name ?? 'Word search'}</Text>
          </View>
          <Feather name="grid" size={20} color="#bdc8e8" />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CHOOSE A MODE</Text>
        <ModeCard
          selected={mode === 'classic'}
          title="Classic"
          subtitle="Take your time. Find every word."
          icon="compass"
          detail="No countdown"
          accent="#e5efff"
          accentColor={colors.primary}
          onPress={() => setMode('classic')}
        />
        <ModeCard
          selected={mode === 'time'}
          title="Time Mode"
          subtitle="Race the clock for a bigger score."
          icon="clock"
          detail="2 minutes"
          accent="#fff0dc"
          accentColor={colors.orange}
          onPress={() => setMode('time')}
        />

        <View style={[styles.rules, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.ruleRow}>
            <Feather name="target" size={17} color={colors.primary} />
            <Text style={[styles.ruleText, { color: colors.foreground }]}>10 points for each puzzle word</Text>
          </View>
          <View style={styles.ruleRow}>
            <Feather name="zap" size={17} color={colors.orange} />
            <Text style={[styles.ruleText, { color: colors.foreground }]}>Find extra words for bonus points</Text>
          </View>
          <View style={styles.ruleRow}>
            <Feather name="star" size={17} color={colors.pink} />
            <Text style={[styles.ruleText, { color: colors.foreground }]}>3 free hints in every puzzle</Text>
          </View>
        </View>

        {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
        <PrimaryButton
          title="Start puzzle"
          icon="play"
          disabled={!canPlay}
          onPress={() => {
            if (startGame(mode)) router.push('/game');
          }}
          testID="start-puzzle"
          style={styles.startButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeCard({
  selected, title, subtitle, icon, detail, accent, accentColor, onPress,
}: {
  selected: boolean; title: string; subtitle: string; icon: React.ComponentProps<typeof Feather>['name'];
  detail: string; accent: string; accentColor: string; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeCard,
        { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border },
        pressed && { opacity: 0.82 },
      ]}
    >
      <View style={[styles.modeIcon, { backgroundColor: accent }]}>
        <Feather name={icon} size={20} color={accentColor} />
      </View>
      <View style={styles.modeCopy}>
        <Text style={[styles.modeTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.modeSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
      <View style={styles.modeRight}>
        <Text style={[styles.modeDetail, { color: accentColor }]}>{detail}</Text>
        <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
          {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 20 },
  content: { paddingBottom: 28 },
  categoryBanner: { borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 25 },
  categoryEmoji: { fontSize: 29 },
  bannerEyebrow: { color: '#bfc9e5', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  bannerTitle: { color: '#ffffff', fontSize: 19, fontWeight: '800', marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 11 },
  modeCard: { minHeight: 91, borderRadius: 20, borderWidth: 1.5, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 },
  modeIcon: { height: 42, width: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  modeCopy: { flex: 1 },
  modeTitle: { fontSize: 15, fontWeight: '800' },
  modeSubtitle: { fontSize: 11, marginTop: 4 },
  modeRight: { alignItems: 'flex-end', gap: 9 },
  modeDetail: { fontSize: 9, fontWeight: '800' },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  rules: { borderWidth: 1, borderRadius: 19, padding: 15, gap: 13, marginTop: 7, marginBottom: 18 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  ruleText: { fontSize: 12, fontWeight: '600' },
  error: { fontSize: 12, marginBottom: 10 },
  startButton: { marginTop: 0 },
});
