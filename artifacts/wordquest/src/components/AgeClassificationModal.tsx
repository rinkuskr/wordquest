import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { ageBandLabel, type AgeBand } from '@/src/services/ageClassification';

interface AgeClassificationModalProps {
  visible: boolean;
  currentAgeBand: AgeBand | null;
  isInitialPrompt: boolean;
  busy: boolean;
  error: string | null;
  onSelect: (ageBand: Exclude<AgeBand, 'unknown'>) => void;
  onDecline: () => void;
  onRemove: () => void;
  onContinueWithoutAds: () => void;
}

const ageOptions: Array<{ ageBand: Exclude<AgeBand, 'unknown'>; label: string }> = [
  { ageBand: 'under13', label: 'Under 13' },
  { ageBand: '13-17', label: '13–17' },
  { ageBand: '18+', label: '18+' },
];

export function AgeClassificationModal({
  visible,
  currentAgeBand,
  isInitialPrompt,
  busy,
  error,
  onSelect,
  onDecline,
  onRemove,
  onContinueWithoutAds,
}: AgeClassificationModalProps) {
  const colors = useColors();

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onDecline}
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(10, 18, 38, 0.56)' }]}>
        <View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: colors.primary }]}>WORDQUEST · PRIVACY</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
            Choose an age range
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            This helps apply age-appropriate ad settings. You can skip and keep playing; ads will stay off.
          </Text>

          {!isInitialPrompt && (
            <Text style={[styles.currentValue, { color: colors.mutedForeground }]}>
              Current selection: {ageBandLabel(currentAgeBand)}
            </Text>
          )}

          <View style={styles.options}>
            {ageOptions.map(({ ageBand, label }) => (
              <Pressable
                key={ageBand}
                accessibilityRole="button"
                accessibilityLabel={label}
                disabled={busy}
                onPress={() => onSelect(ageBand)}
                testID={`age-band-${ageBand}`}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: busy ? 0.55 : pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text style={[styles.optionText, { color: colors.foreground }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {error && (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
              {error}
            </Text>
          )}

          {busy && <ActivityIndicator color={colors.primary} />}

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onDecline}
              testID="age-band-decline"
              style={styles.textAction}
            >
              <Text style={[styles.textActionLabel, { color: colors.mutedForeground }]}>
                {isInitialPrompt ? 'Not now' : 'Close'}
              </Text>
            </Pressable>
            {!isInitialPrompt && currentAgeBand !== null && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onRemove}
                testID="age-band-remove"
                style={styles.textAction}
              >
                <Text style={[styles.textActionLabel, { color: colors.destructive }]}>
                  Remove saved choice
                </Text>
              </Pressable>
            )}
          </View>

          {!!error && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onContinueWithoutAds}
              testID="age-band-continue-without-ads"
              style={styles.continueAction}
            >
              <Text style={[styles.continueLabel, { color: colors.primary }]}>
                Continue without ads
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    padding: 22,
    gap: 12,
  },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
  description: { fontSize: 14, lineHeight: 21 },
  currentValue: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  options: { gap: 9, marginTop: 4 },
  option: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  optionText: { fontSize: 15, fontWeight: '800' },
  error: { fontSize: 12, lineHeight: 18 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  textAction: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 4 },
  textActionLabel: { fontSize: 12, fontWeight: '800' },
  continueAction: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  continueLabel: { fontSize: 12, fontWeight: '900' },
});
