import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { audioService } from '@/src/services/audio';
import { adProvider } from '@/src/services/ads';
import { BONUS_WORDS } from '@/src/data/bonusWords';
import { CATEGORIES, getCategory } from '@/src/data/categories';
import { consumeHint, generatePuzzle, getTimeBonus, isTimeExpired, matchPuzzleWord, scoreSelection, selectionWord, validateBonusWord } from '@/src/engine/gameEngine';
import { awardFirstCompletion, INITIAL_PROGRESS } from '@/src/engine/progression';
import { loadProgress, saveProgress } from '@/src/services/persistence';
import type { CategoryId, GameMode, GameSummary, Placement, Position, Puzzle, SavedProgress } from '@/src/types/game';

export interface ActiveGame {
  categoryId: CategoryId;
  mode: GameMode;
  puzzle: Puzzle;
  score: number;
  foundWords: string[];
  bonusWords: string[];
  hintsLeft: number;
  elapsedSeconds: number;
  elapsedMs: number;
  runningSince: number | null;
  ended: boolean;
}

interface GameContextValue {
  progress: SavedProgress;
  ready: boolean;
  selectedCategoryId: CategoryId;
  game: ActiveGame | null;
  summary: GameSummary | null;
  hintCells: Position[];
  error: string | null;
  selectCategory: (id: CategoryId) => void;
  startGame: (mode: GameMode) => boolean;
  recordSelection: (cells: Position[]) => 'puzzle' | 'bonus' | 'invalid' | 'duplicate';
  showHint: () => boolean;
  requestRewardedHint: () => Promise<boolean>;
  resumeClock: () => void;
  pauseClock: () => void;
  syncClock: () => void;
  toggleSound: () => void;
  resetSummary: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);
export function GameProvider({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const [progress, setProgress] = useState<SavedProgress>(INITIAL_PROGRESS);
  const [ready, setReady] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategoryId>('animals');
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [hintCells, setHintCells] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latestGame = useRef<ActiveGame | null>(null);
  const completionHandled = useRef(false);
  const hintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCountdownSecond = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadProgress().then((loaded) => {
      if (!alive) return;
      setProgress(loaded);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ready) void saveProgress(progress).catch(() => {
      setError('Progress could not be saved. Check available device storage.');
    });
  }, [progress, ready]);

  useEffect(() => {
    audioService.setEnabled(progress.soundEnabled);
  }, [progress.soundEnabled]);

  useEffect(() => {
    latestGame.current = game;
  }, [game]);

  useEffect(() => () => {
    if (hintTimeout.current) clearTimeout(hintTimeout.current);
  }, []);

  const selectCategory = useCallback((id: CategoryId) => {
    setSelectedCategoryId(id);
    setError(null);
  }, []);

  const startGame = useCallback((mode: GameMode) => {
    const category = getCategory(selectedCategoryId);
    if (!category || category.words.length === 0) {
      setError('This category does not have any puzzle words configured.');
      return false;
    }
    try {
      completionHandled.current = false;
      setSummary(null);
      setHintCells([]);
      setError(null);
      const next: ActiveGame = {
        categoryId: category.id,
        mode,
        puzzle: generatePuzzle(category.words),
        score: 0,
        foundWords: [],
        bonusWords: [],
        hintsLeft: 3,
        elapsedSeconds: 0,
        elapsedMs: 0,
        runningSince: null,
        ended: false,
      };
      latestGame.current = next;
      lastCountdownSecond.current = null;
      setGame(next);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create this puzzle.');
      return false;
    }
  }, [selectedCategoryId]);

  const finishGame = useCallback((current: ActiveGame, completed: boolean) => {
    if (completionHandled.current) return;
    completionHandled.current = true;
    const category = getCategory(current.categoryId);
    if (!category) return;
    const elapsedMs = current.elapsedMs + (
      current.runningSince === null ? 0 : Math.max(0, Date.now() - current.runningSince)
    );
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const settled = { ...current, elapsedMs, elapsedSeconds, runningSince: null };
    const remaining = Math.max(0, 120 - elapsedSeconds);
    const timeBonus = completed ? getTimeBonus(current.mode, remaining) : 0;
    const reward = completed
      ? awardFirstCompletion(progress, current.categoryId)
      : { progress, reward: 0, isFirstCompletion: false };
    if (completed && reward.isFirstCompletion) setProgress(reward.progress);
    const finalScore = current.score + timeBonus;
    setGame({ ...settled, score: finalScore, ended: true });
    const result: GameSummary = {
      categoryId: current.categoryId,
      categoryName: category.name,
      mode: current.mode,
      score: finalScore,
      wordsFound: current.foundWords.length,
      totalWords: current.puzzle.words.length,
      bonusWords: current.bonusWords.length,
      elapsedSeconds,
      timeBonus,
      earnedCoins: reward.reward,
      completed,
      newCategoryReward: reward.isFirstCompletion,
    };
    setSummary(result);
    setHintCells([]);
    void audioService.play(completed ? 'complete' : 'game-over');
    void Haptics.notificationAsync(
      completed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => undefined);
    router.replace('/results');
  }, [progress, router]);

  const recordSelection = useCallback((cells: Position[]) => {
    const current = latestGame.current;
    if (!current || current.ended) return 'invalid' as const;
    const raw = selectionWord(current.puzzle.grid, cells);
    if (!raw) {
      void audioService.play('wrong');
      return 'invalid' as const;
    }
    const unfound = current.puzzle.words.filter((word) => !current.foundWords.includes(word));
    const puzzleWord = matchPuzzleWord(raw, unfound);
    if (puzzleWord) {
      const next: ActiveGame = {
        ...current,
        score: current.score + scoreSelection('puzzle'),
        foundWords: [...current.foundWords, puzzleWord],
      };
      latestGame.current = next;
      setGame(next);
      void audioService.play('correct');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (next.foundWords.length === next.puzzle.words.length) finishGame(next, true);
      return 'puzzle' as const;
    }
    const normalizedBonus = validateBonusWord(raw, current.puzzle.words, current.bonusWords, BONUS_WORDS);
    if (normalizedBonus) {
      const next = {
        ...current,
        score: current.score + scoreSelection('bonus'),
        bonusWords: [...current.bonusWords, normalizedBonus],
      };
      latestGame.current = next;
      setGame(next);
      void audioService.play('bonus');
      return 'bonus' as const;
    }
    const candidate = BONUS_WORDS.has(raw.toUpperCase())
      ? raw.toUpperCase()
      : [...raw.toUpperCase()].reverse().join('');
    if (BONUS_WORDS.has(candidate) && current.bonusWords.includes(candidate)) {
      return 'duplicate' as const;
    }
    if (current.puzzle.words.some((word) =>
      word === raw.toUpperCase() || [...word].reverse().join('') === raw.toUpperCase(),
    )) {
      return 'duplicate' as const;
    }
    void audioService.play('wrong');
    return 'invalid' as const;
  }, [finishGame]);

  const showHint = useCallback(() => {
    const current = latestGame.current;
    if (!current || current.ended) return false;
    const available: Placement[] = current.puzzle.placements.filter(
      ({ word }) => !current.foundWords.includes(word),
    );
    const consumption = consumeHint(current.hintsLeft, available.length > 0);
    if (!consumption.consumed) return false;
    const chosen = available[Math.floor(Math.random() * available.length)];
    const next = { ...current, hintsLeft: consumption.hintsLeft };
    latestGame.current = next;
    setGame(next);
    setHintCells(chosen.cells);
    if (hintTimeout.current) clearTimeout(hintTimeout.current);
    hintTimeout.current = setTimeout(() => setHintCells([]), 1500);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    return true;
  }, []);

  const requestRewardedHint = useCallback(async () => {
    const current = latestGame.current;
    if (!current || current.ended) return false;
    try {
      const result = await adProvider.showRewarded();
      if (!result.rewarded) return false;
      const latest = latestGame.current;
      if (!latest || latest.ended) return false;
      const next = { ...latest, hintsLeft: latest.hintsLeft + 1 };
      latestGame.current = next;
      setGame(next);
      return true;
    } catch {
      return false;
    }
  }, []);

  const resumeClock = useCallback(() => {
    const current = latestGame.current;
    if (!current || current.ended || current.runningSince !== null) return;
    const next = { ...current, runningSince: Date.now() };
    latestGame.current = next;
    setGame(next);
  }, []);

  const pauseClock = useCallback(() => {
    const current = latestGame.current;
    if (!current || current.runningSince === null || current.ended) return;
    const now = Date.now();
    const elapsedMs = current.elapsedMs + Math.max(0, now - current.runningSince);
    const next = { ...current, elapsedMs, elapsedSeconds: Math.floor(elapsedMs / 1000), runningSince: null };
    latestGame.current = next;
    setGame(next);
  }, []);

  const syncClock = useCallback(() => {
    const current = latestGame.current;
    if (!current || current.ended || current.runningSince === null) return;
    const elapsedMs = current.elapsedMs + Math.max(0, Date.now() - current.runningSince);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds === current.elapsedSeconds) return;
    const next = { ...current, elapsedSeconds };
    latestGame.current = next;
    setGame(next);
    if (isTimeExpired(current.mode, elapsedSeconds)) finishGame(next, false);
    else if (current.mode === 'time') {
      const remaining = Math.max(0, 120 - elapsedSeconds);
      if (remaining < 30 && remaining > 0 && lastCountdownSecond.current !== remaining) {
        lastCountdownSecond.current = remaining;
        void audioService.play('countdown');
      }
    }
  }, [finishGame]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') resumeClock();
      else pauseClock();
    });
    return () => subscription.remove();
  }, [pauseClock, resumeClock]);

  const toggleSound = useCallback(() => {
    setProgress((current) => ({ ...current, soundEnabled: !current.soundEnabled }));
    void audioService.play('tap');
  }, []);

  const resetSummary = useCallback(() => {
    setSummary(null);
    setGame(null);
    setError(null);
  }, []);

  const value = useMemo<GameContextValue>(() => ({
    progress,
    ready,
    selectedCategoryId,
    game,
    summary,
    hintCells,
    error,
    selectCategory,
    startGame,
    recordSelection,
    showHint,
    requestRewardedHint,
    resumeClock,
    pauseClock,
    syncClock,
    toggleSound,
    resetSummary,
  }), [
    progress, ready, selectedCategoryId, game, summary, hintCells, error,
    selectCategory, startGame, recordSelection, showHint, requestRewardedHint, resumeClock,
    pauseClock, syncClock, toggleSound, resetSummary,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider.');
  return context;
}
