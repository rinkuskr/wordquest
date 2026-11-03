import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { audioService } from '@/src/services/audio';
import { adProvider } from '@/src/services/ads';
import { BONUS_WORDS } from '@/src/data/bonusWords';
import { getCategory } from '@/src/data/categories';
import { getCategoryPuzzlePlan } from '@/src/data/difficulty';
import {
  createDailyChallenge,
  DAILY_CHALLENGE_VERSION,
  getDailyChallengeDefinition,
  getUtcDateKey,
  hasDailyCompletionForDate,
  validateDailyRunSnapshot,
} from '@/src/engine/dailyChallenge';
import { elapsedMilliseconds, monotonicNow } from '@/src/engine/gameClock';
import { consumeHint, generatePuzzle, getTimeBonus, isTimeExpired, resolveWordSelection, scoreSelection, selectionWord } from '@/src/engine/gameEngine';
import { awardFirstCompletion, INITIAL_PROGRESS } from '@/src/engine/progression';
import {
  acceptRecoveredDailyHistory as acceptStoredDailyHistoryRecovery,
  loadDailyHistory,
  recordDailyCompletion,
  startFreshDailyHistory as startFreshStoredDailyHistory,
  INITIAL_DAILY_HISTORY,
  type DailyHistoryLoadResult,
} from '@/src/services/dailyChallengePersistence';
import {
  archiveAndClearDailyRun,
  clearDailyRun,
  discardRecoveredDailyRun,
  DAILY_RUN_APP_VERSION,
  loadDailyRun,
  saveDailyRun,
  type DailyRunLoadResult,
} from '@/src/services/dailyRunPersistence';
import {
  acceptRecoveredProgress as acceptStoredProgressRecovery,
  loadProgress,
  saveProgress,
  startFreshProgress as startFreshStoredProgress,
  type ProgressLoadResult,
} from '@/src/services/persistence';
import type {
  CategoryId,
  DailyActiveRunSnapshot,
  DailyChallengeHistory,
  DailyChallengeRecord,
  GameMode,
  GameSummary,
  Placement,
  Position,
  Puzzle,
  SavedProgress,
} from '@/src/types/game';

type ProgressLoadStatus = 'loading' | 'ready' | 'read-error' | 'recovery-required';
type ProgressRecovery = Extract<ProgressLoadResult, { status: 'recovery-required' }>;
type DailyLoadStatus = 'loading' | 'ready' | 'read-error' | 'recovery-required';
type DailyRecovery = Extract<DailyHistoryLoadResult, { status: 'recovery-required' }>;
type DailyRunLoadStatus = 'loading' | 'loaded' | 'ready' | 'read-error' | 'recovery-required';
type DailyRunRecovery = Extract<DailyRunLoadResult, { status: 'recovery-required' }>;
type DailyRunSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface ActiveGame {
  categoryId: CategoryId;
  mode: GameMode;
  puzzle: Puzzle;
  timeLimitSeconds: number;
  score: number;
  foundWords: string[];
  bonusWords: string[];
  hintsLeft: number;
  elapsedSeconds: number;
  elapsedMs: number;
  runningSince: number | null;
  ended: boolean;
  dailyChallengeDate?: string;
}

function createDailyRunSnapshot(current: ActiveGame): DailyActiveRunSnapshot | null {
  if (!current.dailyChallengeDate) return null;
  const definition = getDailyChallengeDefinition(current.dailyChallengeDate);
  const elapsedMs = elapsedMilliseconds(
    current.elapsedMs,
    current.runningSince,
    monotonicNow(),
  );
  return {
    version: 1,
    challengeVersion: DAILY_CHALLENGE_VERSION,
    appVersion: DAILY_RUN_APP_VERSION,
    dateKey: current.dailyChallengeDate,
    categoryId: current.categoryId,
    seed: definition.seed,
    gridSize: current.puzzle.size,
    timeLimitSeconds: current.timeLimitSeconds,
    foundWords: [...current.foundWords],
    bonusWords: [...current.bonusWords],
    score: current.score,
    hintsLeft: current.hintsLeft,
    elapsedMs,
    status: 'in-progress',
  };
}

interface GameContextValue {
  progress: SavedProgress;
  ready: boolean;
  progressLoadStatus: ProgressLoadStatus;
  progressRecovery: ProgressRecovery | null;
  progressSaveError: string | null;
  dailyHistory: DailyChallengeHistory;
  dailyLoadStatus: DailyLoadStatus;
  dailyRecovery: DailyRecovery | null;
  dailySaveError: string | null;
  dailySavePending: boolean;
  dailyRunLoadStatus: DailyRunLoadStatus;
  dailyRunRecovery: DailyRunRecovery | null;
  dailyRunSaveError: string | null;
  dailyRunSaveStatus: DailyRunSaveStatus;
  selectedCategoryId: CategoryId;
  game: ActiveGame | null;
  summary: GameSummary | null;
  hintCells: Position[];
  error: string | null;
  retryLoadProgress: () => Promise<void>;
  acceptRecoveredProgress: () => Promise<boolean>;
  startFreshProgress: () => Promise<boolean>;
  retrySaveProgress: () => Promise<boolean>;
  retryLoadDailyHistory: () => Promise<void>;
  acceptRecoveredDailyHistory: () => Promise<boolean>;
  startFreshDailyHistory: () => Promise<boolean>;
  retrySaveDailyChallenge: () => Promise<boolean>;
  retryLoadDailyRun: () => Promise<boolean>;
  discardCorruptDailyRun: () => Promise<boolean>;
  retryDailyRunRecovery: () => Promise<boolean>;
  retrySaveDailyRun: () => Promise<boolean>;
  selectCategory: (id: CategoryId) => void;
  startGame: (mode: GameMode) => boolean;
  startDailyChallenge: (dateKey: string) => boolean;
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
  const [progressLoadStatus, setProgressLoadStatus] = useState<ProgressLoadStatus>('loading');
  const [progressRecovery, setProgressRecovery] = useState<ProgressRecovery | null>(null);
  const [progressSaveError, setProgressSaveError] = useState<string | null>(null);
  const [dailyHistory, setDailyHistory] = useState<DailyChallengeHistory>(INITIAL_DAILY_HISTORY);
  const [dailyLoadStatus, setDailyLoadStatus] = useState<DailyLoadStatus>('loading');
  const [dailyRecovery, setDailyRecovery] = useState<DailyRecovery | null>(null);
  const [dailySaveError, setDailySaveError] = useState<string | null>(null);
  const [pendingDailyRecord, setPendingDailyRecord] = useState<DailyChallengeRecord | null>(null);
  const [dailyRunLoadStatus, setDailyRunLoadStatus] = useState<DailyRunLoadStatus>('loading');
  const [dailyRunRecovery, setDailyRunRecovery] = useState<DailyRunRecovery | null>(null);
  const [dailyRunSaveError, setDailyRunSaveError] = useState<string | null>(null);
  const [dailyRunSaveStatus, setDailyRunSaveStatus] = useState<DailyRunSaveStatus>('idle');
  const [loadedDailyRun, setLoadedDailyRun] = useState<DailyActiveRunSnapshot | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<CategoryId>('animals');
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [hintCells, setHintCells] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latestGame = useRef<ActiveGame | null>(null);
  const completionHandled = useRef(false);
  const dailyRunArchivePending = useRef(false);
  const dailyRunRestoreAttempted = useRef<string | null>(null);
  const hintTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCountdownSecond = useRef<number | null>(null);

  const retryLoadProgress = useCallback(async () => {
    setReady(false);
    setProgressLoadStatus('loading');
    try {
      const result = await loadProgress();
      if (result.status === 'loaded') {
        setProgress(result.progress);
        setReady(true);
        setProgressLoadStatus('ready');
        setProgressRecovery(null);
        return;
      }
      setProgressLoadStatus(result.status);
      setProgressRecovery(result.status === 'recovery-required' ? result : null);
    } catch {
      setProgressLoadStatus('read-error');
      setProgressRecovery(null);
    }
  }, []);

  useEffect(() => {
    void retryLoadProgress();
  }, [retryLoadProgress]);

  const retryLoadDailyHistory = useCallback(async () => {
    setDailyLoadStatus('loading');
    try {
      const result = await loadDailyHistory();
      if (result.status === 'loaded') {
        setDailyHistory(result.history);
        setDailyLoadStatus('ready');
        setDailyRecovery(null);
        return;
      }
      setDailyLoadStatus(result.status);
      setDailyRecovery(result.status === 'recovery-required' ? result : null);
    } catch {
      setDailyLoadStatus('read-error');
      setDailyRecovery(null);
    }
  }, []);

  useEffect(() => {
    void retryLoadDailyHistory();
  }, [retryLoadDailyHistory]);

  const retryLoadDailyRun = useCallback(async () => {
    setDailyRunLoadStatus('loading');
    try {
      const result = await loadDailyRun();
      if (result.status === 'loaded') {
        setLoadedDailyRun(result.snapshot);
        setDailyRunRecovery(null);
        setDailyRunLoadStatus('loaded');
        return true;
      }
      setLoadedDailyRun(null);
      setDailyRunLoadStatus(result.status);
      setDailyRunRecovery(result.status === 'recovery-required' ? result : null);
      return false;
    } catch {
      setLoadedDailyRun(null);
      setDailyRunLoadStatus('read-error');
      setDailyRunRecovery(null);
      return false;
    }
  }, []);

  useEffect(() => {
    void retryLoadDailyRun();
  }, [retryLoadDailyRun]);

  const persistDailyRunSnapshot = useCallback(async (current: ActiveGame) => {
    const snapshot = createDailyRunSnapshot(current);
    if (!snapshot) return true;
    setDailyRunSaveStatus((status) => status === 'saved' ? 'saved' : 'saving');
    try {
      await saveDailyRun(snapshot);
      setDailyRunSaveStatus('saved');
      setDailyRunSaveError(null);
      return true;
    } catch {
      setDailyRunSaveStatus('error');
      setDailyRunSaveError("This Daily Challenge couldn't be saved. Your current attempt is still playable; retry to protect it across restarts.");
      return false;
    }
  }, []);

  const retrySaveDailyRun = useCallback(async () => {
    const current = latestGame.current;
    if (current?.dailyChallengeDate && !current.ended) {
      return persistDailyRunSnapshot(current);
    }
    if (!current?.dailyChallengeDate || pendingDailyRecord) return false;
    try {
      await clearDailyRun();
      setLoadedDailyRun(null);
      setDailyRunSaveError(null);
      setDailyRunSaveStatus('saved');
      return true;
    } catch {
      setDailyRunSaveStatus('error');
      setDailyRunSaveError('The saved Daily Challenge attempt still could not be cleared. Retry when device storage is available.');
      return false;
    }
  }, [pendingDailyRecord, persistDailyRunSnapshot]);

  const discardCorruptDailyRun = useCallback(async () => {
    if (!dailyRunRecovery?.backupSaved) return false;
    try {
      await discardRecoveredDailyRun();
      setLoadedDailyRun(null);
      setDailyRunRecovery(null);
      setDailyRunLoadStatus('ready');
      setDailyRunSaveError(null);
      return true;
    } catch {
      setDailyRunRecovery((current) => current
        ? { ...current, message: 'The damaged attempt could not be discarded. Its safety copy remains; retry when storage is available.' }
        : current);
      return false;
    }
  }, [dailyRunRecovery]);

  const retryDailyRunRecovery = useCallback(async () => {
    if (dailyRunArchivePending.current) {
      const archived = await archiveAndClearDailyRun();
      if (!archived) {
        setDailyRunRecovery({
          status: 'recovery-required',
          backupSaved: false,
          message: 'The outdated attempt could not be safely archived and cleared. Nothing was overwritten; retry recovery.',
        });
        return false;
      }
      dailyRunArchivePending.current = false;
      setLoadedDailyRun(null);
      setDailyRunRecovery(null);
      setDailyRunLoadStatus('ready');
      return true;
    }
    if (dailyRunRecovery?.backupSaved) return discardCorruptDailyRun();
    return retryLoadDailyRun();
  }, [dailyRunRecovery, discardCorruptDailyRun, retryLoadDailyRun]);

  useEffect(() => {
    if (ready) {
      void saveProgress(progress).catch(() => {
        setProgressSaveError("Progress couldn't be saved. Your current session is still available; retry to save it.");
      });
    }
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
    if (!ready) {
      setError('Load or recover your saved progress before starting a puzzle.');
      return false;
    }
    const category = getCategory(selectedCategoryId);
    if (!category || category.words.length === 0) {
      setError('This category does not have any puzzle words configured.');
      return false;
    }
    try {
      const plan = getCategoryPuzzlePlan(category);
      completionHandled.current = false;
      setSummary(null);
      setHintCells([]);
      setError(null);
      const next: ActiveGame = {
        categoryId: category.id,
        mode,
        puzzle: generatePuzzle(plan.targetWords, Math.random, {
          gridSize: plan.gridSize,
          diagonalWordCount: plan.diagonalWordCount,
          allowReducedDiagonalFallback: true,
        }),
        timeLimitSeconds: plan.timeLimitSeconds,
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
  }, [ready, selectedCategoryId]);

  const startDailyChallenge = useCallback((dateKey: string) => {
    if (dailyLoadStatus !== 'ready' || dailyRunLoadStatus !== 'ready') {
      setError('Load or recover your saved Daily Challenge data before starting.');
      return false;
    }
    if (pendingDailyRecord?.dateKey === dateKey) {
      setError('Save the previous daily result before starting another attempt.');
      return false;
    }
    if (game?.dailyChallengeDate === dateKey && !game.ended) return true;
    try {
      const challenge = createDailyChallenge(dateKey);
      completionHandled.current = false;
      setSummary(null);
      setHintCells([]);
      setError(null);
      const next: ActiveGame = {
        categoryId: challenge.categoryId,
        mode: 'time',
        puzzle: challenge.puzzle,
        timeLimitSeconds: challenge.timeLimitSeconds,
        score: 0,
        foundWords: [],
        bonusWords: [],
        hintsLeft: 3,
        elapsedSeconds: 0,
        elapsedMs: 0,
        runningSince: null,
        ended: false,
        dailyChallengeDate: challenge.dateKey,
      };
      latestGame.current = next;
      lastCountdownSecond.current = null;
      setGame(next);
      setLoadedDailyRun(null);
      void persistDailyRunSnapshot(next);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create today’s challenge.');
      return false;
    }
  }, [dailyLoadStatus, dailyRunLoadStatus, game, pendingDailyRecord, persistDailyRunSnapshot]);

  const acceptRecoveredProgress = useCallback(async () => {
    if (!progressRecovery?.recoveredProgress || !progressRecovery.backupSaved) return false;
    try {
      const recovered = await acceptStoredProgressRecovery();
      setProgress(recovered);
      setProgressRecovery(null);
      setProgressLoadStatus('ready');
      setReady(true);
      return true;
    } catch {
      setProgressRecovery((current) => current
        ? { ...current, message: 'Recovered progress could not be saved. The preserved original data is unchanged; retry recovery.' }
        : current);
      return false;
    }
  }, [progressRecovery]);

  const startFreshProgress = useCallback(async () => {
    if (!progressRecovery?.backupSaved) return false;
    try {
      const fresh = await startFreshStoredProgress();
      setProgress(fresh);
      setProgressRecovery(null);
      setProgressLoadStatus('ready');
      setReady(true);
      return true;
    } catch {
      setProgressRecovery((current) => current
        ? { ...current, message: 'Fresh progress could not be saved. The preserved original data is unchanged; retry when storage is available.' }
        : current);
      return false;
    }
  }, [progressRecovery]);

  const retrySaveProgress = useCallback(async () => {
    if (!ready) return false;
    try {
      await saveProgress(progress);
      setProgressSaveError(null);
      return true;
    } catch {
      setProgressSaveError("Progress still couldn't be saved. Your current session is still available; retry again when device storage is available.");
      return false;
    }
  }, [progress, ready]);

  const acceptRecoveredDailyHistory = useCallback(async () => {
    if (!dailyRecovery?.backupSaved || !dailyRecovery.recoveredHistory) return false;
    try {
      const history = await acceptStoredDailyHistoryRecovery();
      setDailyHistory(history);
      setDailyRecovery(null);
      setDailyLoadStatus('ready');
      return true;
    } catch {
      setDailyRecovery((current) => current
        ? { ...current, message: 'Recovered daily history could not be saved. The preserved original data is unchanged; retry recovery.' }
        : current);
      return false;
    }
  }, [dailyRecovery]);

  const startFreshDailyHistory = useCallback(async () => {
    if (!dailyRecovery?.backupSaved) return false;
    try {
      const history = await startFreshStoredDailyHistory();
      setDailyHistory(history);
      setDailyRecovery(null);
      setDailyLoadStatus('ready');
      return true;
    } catch {
      setDailyRecovery((current) => current
        ? { ...current, message: 'New daily history could not be saved. The preserved original data is unchanged; retry when storage is available.' }
        : current);
      return false;
    }
  }, [dailyRecovery]);

  const saveDailyCompletion = useCallback(async (record: DailyChallengeRecord) => {
    setPendingDailyRecord(record);
    try {
      const result = await recordDailyCompletion(record);
      setDailyHistory(result.history);
      setDailySaveError(null);
      setPendingDailyRecord(null);
      setSummary((current) => current?.dailyChallenge?.dateKey === record.dateKey
        ? {
            ...current,
            dailyChallenge: {
              dateKey: record.dateKey,
              isPersonalBest: result.isPersonalBest,
              bestScore: result.record.bestScore,
            },
          }
        : current);
      return true;
    } catch {
      setDailySaveError("Today's result couldn't be saved. Your result remains on this screen; retry to save it.");
      return false;
    }
  }, []);

  const retrySaveDailyChallenge = useCallback(async () => {
    if (!pendingDailyRecord) return false;
    const saved = await saveDailyCompletion(pendingDailyRecord);
    if (!saved) return false;
    try {
      await clearDailyRun();
      setLoadedDailyRun(null);
      setDailyRunSaveError(null);
      setDailyRunSaveStatus('saved');
      return true;
    } catch {
      setDailyRunSaveStatus('error');
      setDailyRunSaveError("Today's result is saved, but the old attempt could not be cleared. It won't be restored over the completed result; retry the cleanup.");
      return false;
    }
  }, [pendingDailyRecord, saveDailyCompletion]);

  const finishGame = useCallback((current: ActiveGame, completed: boolean) => {
    if (completionHandled.current) return;
    completionHandled.current = true;
    const category = getCategory(current.categoryId);
    if (!category) return;
    const dailyChallengeExpired = !!current.dailyChallengeDate &&
      current.dailyChallengeDate !== getUtcDateKey(new Date());
    const didComplete = completed && !dailyChallengeExpired;
    const elapsedMs = elapsedMilliseconds(
      current.elapsedMs,
      current.runningSince,
      monotonicNow(),
    );
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const settled = { ...current, elapsedMs, elapsedSeconds, runningSince: null };
    const remaining = Math.max(0, current.timeLimitSeconds - elapsedSeconds);
    const timeBonus = didComplete ? getTimeBonus(current.mode, remaining) : 0;
    const existingDailyRecord = current.dailyChallengeDate
      ? dailyHistory.records.find((record) => record.dateKey === current.dailyChallengeDate)
      : undefined;
    const reward = didComplete && !current.dailyChallengeDate
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
      completed: didComplete,
      newCategoryReward: reward.isFirstCompletion,
      ...(current.dailyChallengeDate
        ? {
            dailyChallenge: {
              dateKey: current.dailyChallengeDate,
              isPersonalBest: didComplete && (!existingDailyRecord || finalScore > existingDailyRecord.bestScore),
              bestScore: Math.max(existingDailyRecord?.bestScore ?? 0, finalScore),
            },
          }
        : {}),
    };
    setSummary(result);
    if (didComplete && current.dailyChallengeDate) {
      void (async () => {
        // Keep the final found-word state recoverable if writing the result fails.
        await persistDailyRunSnapshot(settled);
        const saved = await saveDailyCompletion({
          dateKey: current.dailyChallengeDate!,
          categoryId: current.categoryId,
          bestScore: finalScore,
          completionTimeSeconds: elapsedSeconds,
          wordsFound: current.foundWords.length,
          totalWords: current.puzzle.words.length,
        });
        if (!saved) return;
        try {
          await clearDailyRun();
          setLoadedDailyRun(null);
          setDailyRunSaveStatus('saved');
          setDailyRunSaveError(null);
        } catch {
          setDailyRunSaveStatus('error');
          setDailyRunSaveError("Today's result is saved, but the old attempt could not be cleared. It won't be restored over the completed result; retry the cleanup.");
        }
      })();
    } else if (current.dailyChallengeDate) {
      void (async () => {
        const expiredSnapshot = {
          ...settled,
          elapsedMs: Math.max(elapsedMs, current.timeLimitSeconds * 1000),
        };
        await persistDailyRunSnapshot(expiredSnapshot);
        try {
          await clearDailyRun();
          setLoadedDailyRun(null);
          setDailyRunSaveError(null);
        } catch {
          setDailyRunSaveStatus('error');
          setDailyRunSaveError("The expired Daily Challenge attempt couldn't be cleared. Retry the cleanup before starting again.");
        }
      })();
    }
    setHintCells([]);
    void audioService.play(didComplete ? 'complete' : 'game-over');
    void Haptics.notificationAsync(
      didComplete ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => undefined);
    router.replace('/results');
  }, [dailyHistory.records, persistDailyRunSnapshot, progress, router, saveDailyCompletion]);

  useEffect(() => {
    if (dailyLoadStatus !== 'ready' || dailyRunLoadStatus !== 'loaded') return;
    const today = getUtcDateKey(new Date());
    const restoreKey = `${today}:${loadedDailyRun?.dateKey ?? 'none'}:${loadedDailyRun?.seed ?? ''}`;
    if (dailyRunRestoreAttempted.current === restoreKey) return;
    dailyRunRestoreAttempted.current = restoreKey;

    if (!loadedDailyRun) {
      setDailyRunLoadStatus('ready');
      return;
    }

    const hasTodayCompletion = hasDailyCompletionForDate(dailyHistory.records, today);
    if (hasTodayCompletion) {
      setLoadedDailyRun(null);
      setDailyRunLoadStatus('ready');
      void clearDailyRun().catch(() => {
        setDailyRunSaveStatus('error');
        setDailyRunSaveError("Today's result is already saved, but the old attempt couldn't be cleared. It won't be restored over the completed result.");
      });
      return;
    }

    const validation = validateDailyRunSnapshot(
      loadedDailyRun,
      today,
      DAILY_RUN_APP_VERSION,
    );
    if (validation.status !== 'valid') {
      dailyRunArchivePending.current = true;
      void archiveAndClearDailyRun().then((archived) => {
        if (archived) {
          dailyRunArchivePending.current = false;
          setLoadedDailyRun(null);
          setDailyRunRecovery(null);
          setDailyRunLoadStatus('ready');
          return;
        }
        setDailyRunRecovery({
          status: 'recovery-required',
          backupSaved: false,
          message: validation.status === 'expired'
            ? 'This Daily Challenge attempt has expired. Its data could not be safely archived yet; retry recovery before starting another challenge.'
            : 'This saved Daily Challenge attempt is incompatible with the current puzzle configuration. Its data could not be safely archived yet; retry recovery.',
        });
        setDailyRunLoadStatus('recovery-required');
      }).catch(() => {
        setDailyRunRecovery({
          status: 'recovery-required',
          backupSaved: false,
          message: 'The saved Daily Challenge attempt could not be safely archived. Nothing was overwritten; retry recovery.',
        });
        setDailyRunLoadStatus('recovery-required');
      });
      return;
    }

    const restored: ActiveGame = {
      categoryId: validation.challenge.categoryId,
      mode: 'time',
      puzzle: validation.challenge.puzzle,
      timeLimitSeconds: validation.challenge.timeLimitSeconds,
      score: validation.score,
      foundWords: validation.foundWords,
      bonusWords: validation.bonusWords,
      hintsLeft: validation.hintsLeft,
      elapsedSeconds: Math.floor(validation.elapsedMs / 1000),
      elapsedMs: validation.elapsedMs,
      runningSince: null,
      ended: false,
      dailyChallengeDate: today,
    };
    completionHandled.current = false;
    latestGame.current = restored;
    setSummary(null);
    setHintCells([]);
    setGame(restored);
    setDailyRunSaveStatus('saved');
    setDailyRunSaveError(null);
    setDailyRunLoadStatus('ready');

    if (validation.isComplete) finishGame(restored, true);
  }, [
    dailyHistory.records,
    dailyLoadStatus,
    dailyRunLoadStatus,
    finishGame,
    loadedDailyRun,
  ]);

  const recordSelection = useCallback((cells: Position[]) => {
    const current = latestGame.current;
    if (!current || current.ended) return 'invalid' as const;
    const elapsedMs = elapsedMilliseconds(
      current.elapsedMs,
      current.runningSince,
      monotonicNow(),
    );
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (isTimeExpired(current.mode, elapsedSeconds, current.timeLimitSeconds)) {
      finishGame({
        ...current,
        elapsedMs,
        elapsedSeconds,
        runningSince: null,
      }, false);
      return 'invalid' as const;
    }
    const raw = selectionWord(current.puzzle.grid, cells);
    if (!raw) {
      void audioService.play('wrong');
      return 'invalid' as const;
    }
    const resolution = resolveWordSelection(
      raw,
      current.puzzle.words,
      current.foundWords,
      current.bonusWords,
      BONUS_WORDS,
    );
    if (resolution.kind === 'puzzle') {
      const next: ActiveGame = {
        ...current,
        score: current.score + scoreSelection('puzzle'),
        foundWords: [...current.foundWords, resolution.word],
      };
      latestGame.current = next;
      setGame(next);
      if (next.dailyChallengeDate) void persistDailyRunSnapshot(next);
      void audioService.play('correct');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (next.foundWords.length === next.puzzle.words.length) finishGame(next, true);
      return 'puzzle' as const;
    }
    if (resolution.kind === 'bonus') {
      const next = {
        ...current,
        score: current.score + scoreSelection('bonus'),
        bonusWords: [...current.bonusWords, resolution.word],
      };
      latestGame.current = next;
      setGame(next);
      if (next.dailyChallengeDate) void persistDailyRunSnapshot(next);
      void audioService.play('bonus');
      return 'bonus' as const;
    }
    if (resolution.kind === 'duplicate') return 'duplicate' as const;
    void audioService.play('wrong');
    return 'invalid' as const;
  }, [finishGame, persistDailyRunSnapshot]);

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
    if (next.dailyChallengeDate) void persistDailyRunSnapshot(next);
    setHintCells(chosen.cells);
    if (hintTimeout.current) clearTimeout(hintTimeout.current);
    hintTimeout.current = setTimeout(() => setHintCells([]), 1500);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    return true;
  }, [persistDailyRunSnapshot]);

  const requestRewardedHint = useCallback(async () => {
    const current = latestGame.current;
    if (!current || current.ended || current.dailyChallengeDate) return false;
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
    const next = { ...current, runningSince: monotonicNow() };
    latestGame.current = next;
    setGame(next);
  }, []);

  const pauseClock = useCallback(() => {
    const current = latestGame.current;
    if (!current || current.runningSince === null || current.ended) return;
    const elapsedMs = elapsedMilliseconds(
      current.elapsedMs,
      current.runningSince,
      monotonicNow(),
    );
    const next = { ...current, elapsedMs, elapsedSeconds: Math.floor(elapsedMs / 1000), runningSince: null };
    latestGame.current = next;
    setGame(next);
    if (next.dailyChallengeDate) void persistDailyRunSnapshot(next);
  }, [persistDailyRunSnapshot]);

  const syncClock = useCallback(() => {
    const current = latestGame.current;
    if (!current || current.ended || current.runningSince === null) return;
    const elapsedMs = elapsedMilliseconds(
      current.elapsedMs,
      current.runningSince,
      monotonicNow(),
    );
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds === current.elapsedSeconds) return;
    const next = { ...current, elapsedSeconds };
    latestGame.current = next;
    setGame(next);
    if (next.dailyChallengeDate) void persistDailyRunSnapshot(next);
    if (isTimeExpired(current.mode, elapsedSeconds, current.timeLimitSeconds)) finishGame(next, false);
    else if (current.mode === 'time') {
      const remaining = Math.max(0, current.timeLimitSeconds - elapsedSeconds);
      if (remaining < 30 && remaining > 0 && lastCountdownSecond.current !== remaining) {
        lastCountdownSecond.current = remaining;
        void audioService.play('countdown');
      }
    }
  }, [finishGame, persistDailyRunSnapshot]);

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
    progressLoadStatus,
    progressRecovery,
    progressSaveError,
    dailyHistory,
    dailyLoadStatus,
    dailyRecovery,
    dailySaveError,
    dailySavePending: pendingDailyRecord !== null,
    dailyRunLoadStatus,
    dailyRunRecovery,
    dailyRunSaveError,
    dailyRunSaveStatus,
    selectedCategoryId,
    game,
    summary,
    hintCells,
    error,
    retryLoadProgress,
    acceptRecoveredProgress,
    startFreshProgress,
    retrySaveProgress,
    retryLoadDailyHistory,
    acceptRecoveredDailyHistory,
    startFreshDailyHistory,
    retrySaveDailyChallenge,
    retryLoadDailyRun,
    discardCorruptDailyRun,
    retryDailyRunRecovery,
    retrySaveDailyRun,
    selectCategory,
    startGame,
    startDailyChallenge,
    recordSelection,
    showHint,
    requestRewardedHint,
    resumeClock,
    pauseClock,
    syncClock,
    toggleSound,
    resetSummary,
  }), [
    progress, ready, progressLoadStatus, progressRecovery, progressSaveError,
    dailyHistory, dailyLoadStatus, dailyRecovery, dailySaveError, pendingDailyRecord,
    dailyRunLoadStatus, dailyRunRecovery, dailyRunSaveError, dailyRunSaveStatus,
    selectedCategoryId, game, summary, hintCells, error,
    retryLoadProgress, acceptRecoveredProgress, startFreshProgress, retrySaveProgress,
    retryLoadDailyHistory, acceptRecoveredDailyHistory, startFreshDailyHistory, retrySaveDailyChallenge,
    retryLoadDailyRun, discardCorruptDailyRun, retryDailyRunRecovery, retrySaveDailyRun,
    selectCategory, startGame, startDailyChallenge, recordSelection, showHint, requestRewardedHint, resumeClock,
    pauseClock, syncClock, toggleSound, resetSummary,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider.');
  return context;
}
