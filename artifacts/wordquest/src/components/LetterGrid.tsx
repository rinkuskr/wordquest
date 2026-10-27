import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { withOpacity, HIGHLIGHT_COLORS } from '@/src/theme/highlights';
import { audioService } from '@/src/services/audio';
import { pointToGridCell, straightLineBetween } from '@/src/engine/gridTouch';
import type { Placement, Position, Puzzle } from '@/src/types/game';

interface LetterGridProps {
  puzzle: Puzzle;
  foundWords: readonly string[];
  hintCells: readonly Position[];
  onSelection: (cells: Position[]) => void;
}

function samePosition(a: Position, b: Position) {
  return a.row === b.row && a.col === b.col;
}

export default function LetterGrid({ puzzle, foundWords, hintCells, onSelection }: LetterGridProps) {
  const colors = useColors();
  const [boardWidth, setBoardWidth] = useState(0);
  const [selectedCells, setSelectedCells] = useState<Position[]>([]);
  const selectedCellsRef = useRef<Position[]>([]);
  const pulse = useMemo(() => new Animated.Value(0.2), []);
  const isHinted = useCallback(
    (row: number, col: number) => hintCells.some((cell) => cell.row === row && cell.col === col),
    [hintCells],
  );

  useEffect(() => {
    if (!hintCells.length) {
      pulse.stopAnimation();
      pulse.setValue(0.2);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 250, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.25, duration: 250, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    );
    animation.start();
    return () => animation.stop();
  }, [hintCells, pulse]);

  const foundCellColors = useMemo(() => {
    const result = new Map<string, string>();
    puzzle.placements.forEach((placement: Placement, index) => {
      if (!foundWords.includes(placement.word)) return;
      for (const cell of placement.cells) {
        result.set(`${cell.row}:${cell.col}`, HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length]);
      }
    });
    return result;
  }, [foundWords, puzzle.placements]);

  const pointToCell = useCallback((x: number, y: number): Position | null => {
    if (!boardWidth) return null;
    return pointToGridCell(x, y, boardWidth, puzzle.size);
  }, [boardWidth, puzzle.size]);

  const startSelection = useCallback((x: number, y: number) => {
    const cell = pointToCell(x, y);
    const next = cell ? [cell] : [];
    selectedCellsRef.current = next;
    setSelectedCells(next);
    if (cell) void audioService.play('swipe');
  }, [pointToCell]);

  const updateSelection = useCallback((x: number, y: number) => {
    const target = pointToCell(x, y);
    if (!target) return;
    const previous = selectedCellsRef.current;
    if (!previous.length) {
      selectedCellsRef.current = [target];
      setSelectedCells([target]);
      return;
    }
    const next = straightLineBetween(previous[0], target);
    if (!next.length) return;
    selectedCellsRef.current = next;
    setSelectedCells(next);
  }, [pointToCell]);

  const finishSelection = useCallback(() => {
    const selection = selectedCellsRef.current;
    if (selection.length > 1) onSelection(selection);
    selectedCellsRef.current = [];
    setSelectedCells([]);
  }, [onSelection]);

  const clearSelection = useCallback(() => {
    selectedCellsRef.current = [];
    setSelectedCells([]);
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => runOnJS(startSelection)(event.x, event.y))
        .onUpdate((event) => runOnJS(updateSelection)(event.x, event.y))
        .onEnd(() => runOnJS(finishSelection)())
        .onFinalize(() => runOnJS(clearSelection)()),
    [clearSelection, finishSelection, startSelection, updateSelection],
  );

  const selected = (row: number, col: number) =>
    selectedCells.some((cell) => samePosition(cell, { row, col }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={(event) => setBoardWidth(event.nativeEvent.layout.width)}
        style={[styles.board, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessibilityLabel="Letter grid. Drag in a straight line to select a word."
        testID="letter-grid"
      >
        {puzzle.grid.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map((letter, colIndex) => {
              const selectedHere = selected(rowIndex, colIndex);
              const foundColor = foundCellColors.get(`${rowIndex}:${colIndex}`);
              const hinted = isHinted(rowIndex, colIndex);
              return (
                <View
                  key={`${rowIndex}-${colIndex}`}
                  style={[
                    styles.cell,
                    { backgroundColor: foundColor ? withOpacity(foundColor, 0.35) : 'transparent' },
                    selectedHere && { backgroundColor: withOpacity(colors.primary, 0.2), borderColor: colors.primary, borderWidth: 1 },
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.letter,
                      { color: foundColor ? colors.found : colors.foreground },
                      selectedHere && { color: colors.primary, fontWeight: '900' },
                    ]}
                  >
                    {letter}
                  </Text>
                  {foundColor && <View style={[styles.foundMark, { backgroundColor: foundColor }]} />}
                  {hinted && (
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.hintOverlay, { opacity: pulse }]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  board: { width: '100%', aspectRatio: 1, borderRadius: 18, padding: 5, borderWidth: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1, margin: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  letter: { fontSize: 13, fontWeight: '700', zIndex: 1 },
  foundMark: { position: 'absolute', width: 4, height: 4, borderRadius: 3, right: 2, top: 2 },
  hintOverlay: { position: 'absolute', inset: 0, borderRadius: 6, backgroundColor: '#ffd84d', borderWidth: 1, borderColor: '#f2ac16' },
});
