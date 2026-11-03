import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { CoinPill, PageHeader } from '@/src/components/ui';
import AdBannerSlot from '@/src/components/AdBannerSlot';
import { CATEGORIES, isCategoryUnlocked } from '@/src/data/categories';
import { useGame } from '@/src/game/GameProvider';
import { audioService } from '@/src/services/audio';

export default function CategoriesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { progress, ready, selectCategory } = useGame();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <PageHeader
          title="Choose a world"
          subtitle="Complete one to unlock the next"
          onBack={() => router.back()}
          right={ready ? <CoinPill amount={progress.coins} /> : undefined}
        />
        <View style={styles.collectionLine}>
          <View style={[styles.line, { backgroundColor: colors.primary }]} />
          <Text style={[styles.collectionText, { color: colors.mutedForeground }]}>15 WORLDS · ONE WORD AT A TIME</Text>
        </View>
        <FlatList
          style={styles.listView}
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const unlocked = isCategoryUnlocked(index, progress.completedLevels);
            const completed = progress.completedLevels.includes(item.id);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}${!ready ? ', progress unavailable' : unlocked ? '' : ', locked'}`}
                disabled={!ready || !unlocked}
                testID={`category-${item.id}`}
                onPress={() => {
                  selectCategory(item.id);
                  void audioService.play('tap');
                  router.push('/modes');
                }}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.card, borderColor: completed ? colors.primary : colors.border },
                  !unlocked && styles.locked,
                  pressed && unlocked && styles.pressed,
                ]}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.emoji}>{item.emoji}</Text>
                  {completed ? (
                    <View style={[styles.statusIcon, { backgroundColor: '#e1f6ec' }]}>
                      <Feather name="check" size={13} color="#28a667" />
                    </View>
                  ) : !unlocked ? (
                    <Feather name="lock" size={15} color={colors.mutedForeground} />
                  ) : (
                    <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
                  )}
                </View>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.status, { color: completed ? '#28a667' : colors.mutedForeground }]}>
                  {!ready
                    ? 'PROGRESS UNAVAILABLE'
                    : completed
                      ? 'COMPLETED'
                      : unlocked
                        ? 'READY TO EXPLORE'
                        : `COMPLETE ${CATEGORIES[index - 1]?.name.toUpperCase() ?? 'PREVIOUS'}`}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
      <AdBannerSlot />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  collectionLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  line: { width: 19, height: 3, borderRadius: 2 },
  collectionText: { fontSize: 9, letterSpacing: 1.1, fontWeight: '800' },
  listView: { flex: 1 },
  list: { paddingBottom: 15 },
  row: { gap: 12 },
  card: { flex: 1, minHeight: 125, borderRadius: 21, borderWidth: 1, padding: 15, marginBottom: 12 },
  locked: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.82 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emoji: { fontSize: 23 },
  statusIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 14, fontSize: 15, fontWeight: '800' },
  status: { marginTop: 5, fontSize: 8, fontWeight: '800', letterSpacing: 0.65 },
});
