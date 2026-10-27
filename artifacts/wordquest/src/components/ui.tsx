import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function Screen({
  children,
  style,
}: React.PropsWithChildren<{ style?: ViewStyle }>) {
  const colors = useColors();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  badge,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  badge?: number;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }]}
      hitSlop={10}
    >
      <Feather name={icon} size={21} color={colors.foreground} />
      {badge !== undefined && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  icon,
  style,
  ...props
}: PressableProps & { title: string; icon?: React.ComponentProps<typeof Feather>['name']; style?: ViewStyle }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: colors.primary, opacity: disabled ? 0.48 : pressed ? 0.84 : 1 },
        style,
      ]}
      {...props}
    >
      {icon && <Feather name={icon} size={19} color="#ffffff" />}
      <Text style={styles.primaryText}>{title}</Text>
      <Feather name="arrow-right" size={18} color="#ffffff" />
    </Pressable>
  );
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      {onBack ? <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={onBack} /> : <View style={styles.iconButton} />}
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle && <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>}
      </View>
      {right ?? <View style={styles.iconButton} />}
    </View>
  );
}

export function CoinPill({ amount }: { amount: number }) {
  const colors = useColors();
  return (
    <View style={[styles.coinPill, { backgroundColor: colors.card }]}>
      <Feather name="circle" size={15} color={colors.orange} />
      <Text style={[styles.coinText, { color: colors.foreground }]}>{amount}</Text>
    </View>
  );
}

export function LoadingLine() {
  return <ActivityIndicator color="#2f80ed" />;
}

export const sharedStyles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#e7e7ed' },
  label: { fontSize: 12, letterSpacing: 1.2, fontWeight: '700', textTransform: 'uppercase', color: '#777783' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 22 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 0, top: 0, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f83f8f' },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  primaryButton: { minHeight: 58, borderRadius: 20, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  primaryText: { flex: 1, color: '#ffffff', fontSize: 16, fontWeight: '800' },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 18 },
  headerText: { flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, marginTop: 3 },
  coinPill: { minHeight: 38, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12 },
  coinText: { fontWeight: '800', fontSize: 14 },
});
