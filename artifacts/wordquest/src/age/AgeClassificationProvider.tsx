import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AgeClassificationModal } from '@/src/components/AgeClassificationModal';
import { adProvider } from '@/src/services/ads';
import { initializeAdsForAgeClassification } from '@/src/services/ageAdPolicy';
import {
  ageClassificationStore,
  createAgeClassification,
  createDeclinedAgeClassification,
  type AgeBand,
  type AgeClassificationRecord,
} from '@/src/services/ageClassification';

interface AgeClassificationContextValue {
  classification: AgeClassificationRecord | null;
  isLoading: boolean;
  isSaving: boolean;
  isModalVisible: boolean;
  isInitialPrompt: boolean;
  canOpenAdsPrivacyOptions: boolean;
  restartRequired: boolean;
  notice: string | null;
  storageError: string | null;
  openAgeSettings: () => void;
  selectAgeBand: (ageBand: Exclude<AgeBand, 'unknown'>) => Promise<void>;
  declineAgeSelection: () => Promise<void>;
  removeAgeClassification: () => Promise<void>;
  continueWithoutAds: () => void;
}

const AgeClassificationContext = createContext<AgeClassificationContextValue | null>(null);

export function AgeClassificationProvider({ children }: { children: ReactNode }) {
  const [classification, setClassification] = useState<AgeClassificationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isInitialPrompt, setIsInitialPrompt] = useState(false);
  const [canOpenAdsPrivacyOptions, setCanOpenAdsPrivacyOptions] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const initialPromptPending = useRef(false);
  const operationActive = useRef(false);
  const classificationRevision = useRef(0);

  const initializeEligibleAds = useCallback(async (record: AgeClassificationRecord) => {
    const revision = classificationRevision.current;
    const decision = await initializeAdsForAgeClassification(record, adProvider);
    if (revision === classificationRevision.current) {
      setCanOpenAdsPrivacyOptions(decision.eligible);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void ageClassificationStore.load().then(async (result) => {
      if (!mounted) return;

      if (result.status === 'loaded') {
        setClassification(result.record);
        setIsLoading(false);
        setIsInitialPrompt(false);
        initialPromptPending.current = false;
        if (result.record.ageBand !== 'unknown') {
          await initializeEligibleAds(result.record);
        }
        return;
      }

      initialPromptPending.current = true;
      setIsInitialPrompt(true);
      setIsModalVisible(true);
      setIsLoading(false);
      if (result.status === 'corrupt') {
        setStorageError(
          'The saved age choice could not be read. No age was assumed; choose again or continue without ads.',
        );
      } else if (result.status === 'read-error') {
        setStorageError(
          'The saved age choice is temporarily unavailable. Ads are off until it can be read or you choose again.',
        );
      }
    });

    return () => {
      mounted = false;
    };
  }, [initializeEligibleAds]);

  const selectAgeBand = useCallback(
    async (ageBand: Exclude<AgeBand, 'unknown'>) => {
      if (operationActive.current) return;
      operationActive.current = true;
      setIsSaving(true);
      setStorageError(null);
      const isFirstChoice = initialPromptPending.current;
      const next = createAgeClassification(ageBand);

      if (!isFirstChoice) {
        classificationRevision.current += 1;
        adProvider.disableForSession();
        setCanOpenAdsPrivacyOptions(false);
      }

      try {
        await ageClassificationStore.save(next);
        setClassification(next);
        setIsModalVisible(false);
        setIsInitialPrompt(false);
        setNotice(null);

        if (isFirstChoice) {
          initialPromptPending.current = false;
          await initializeEligibleAds(next);
        } else {
          setRestartRequired(true);
          setNotice('Age choice saved. Ads are paused until WordQuest is restarted.');
        }
      } catch {
        setStorageError(
          'This age choice could not be saved. Ads remain off; retry or continue playing without ads.',
        );
        setNotice('Age settings could not be saved. Ads remain off for this session.');
      } finally {
        setIsSaving(false);
        operationActive.current = false;
      }
    },
    [initializeEligibleAds],
  );

  const continueWithoutAds = useCallback(() => {
    classificationRevision.current += 1;
    adProvider.disableForSession();
    setCanOpenAdsPrivacyOptions(false);
    setIsModalVisible(false);
    setIsInitialPrompt(false);
    if (initialPromptPending.current) {
      setClassification(createDeclinedAgeClassification());
      initialPromptPending.current = false;
      setRestartRequired(false);
      setNotice('Age was not saved. You can keep playing; ads are off for this session.');
    } else {
      setRestartRequired(true);
      setNotice('The saved choice was not changed. Ads are paused for this session; retry the change in Age and ads.');
    }
  }, []);

  const declineAgeSelection = useCallback(async () => {
    if (operationActive.current) return;
    if (!initialPromptPending.current) {
      setIsModalVisible(false);
      setStorageError(null);
      return;
    }

    operationActive.current = true;
    setIsSaving(true);
    setStorageError(null);
    const declined = createDeclinedAgeClassification();

    try {
      await ageClassificationStore.save(declined);
      setClassification(declined);
      setIsModalVisible(false);
      setIsInitialPrompt(false);
      initialPromptPending.current = false;
      setCanOpenAdsPrivacyOptions(false);
      setNotice(null);
    } catch {
      setStorageError(
        'Your choice could not be saved. Continue without ads for this session or retry when storage is available.',
      );
      setNotice('Age settings could not be saved. Ads remain off for this session.');
    } finally {
      setIsSaving(false);
      operationActive.current = false;
    }
  }, []);

  const removeAgeClassification = useCallback(async () => {
    if (operationActive.current || !classification) return;
    operationActive.current = true;
    setIsSaving(true);
    setStorageError(null);
    classificationRevision.current += 1;
    adProvider.disableForSession();
    setCanOpenAdsPrivacyOptions(false);

    try {
      await ageClassificationStore.remove();
      setClassification(null);
      setIsModalVisible(false);
      setIsInitialPrompt(false);
      setRestartRequired(true);
      setNotice('Saved age choice removed. Ads are paused until the app is reopened.');
    } catch {
      setStorageError(
        'The saved age choice could not be removed. Ads are paused for this session; retry when storage is available.',
      );
      setNotice('Age settings could not be removed. Ads remain off for this session.');
    } finally {
      setIsSaving(false);
      operationActive.current = false;
    }
  }, [classification]);

  const openAgeSettings = useCallback(() => {
    if (isLoading || isSaving) return;
    setIsInitialPrompt(false);
    setStorageError(null);
    setIsModalVisible(true);
  }, [isLoading, isSaving]);

  const value = useMemo<AgeClassificationContextValue>(
    () => ({
      classification,
      isLoading,
      isSaving,
      isModalVisible,
      isInitialPrompt,
      canOpenAdsPrivacyOptions,
      restartRequired,
      notice,
      storageError,
      openAgeSettings,
      selectAgeBand,
      declineAgeSelection,
      removeAgeClassification,
      continueWithoutAds,
    }),
    [
      classification,
      isLoading,
      isSaving,
      isModalVisible,
      isInitialPrompt,
      canOpenAdsPrivacyOptions,
      restartRequired,
      notice,
      storageError,
      openAgeSettings,
      selectAgeBand,
      declineAgeSelection,
      removeAgeClassification,
      continueWithoutAds,
    ],
  );

  return (
    <AgeClassificationContext.Provider value={value}>
      {children}
      <AgeClassificationModal
        visible={isModalVisible}
        currentAgeBand={classification?.ageBand ?? null}
        isInitialPrompt={isInitialPrompt}
        busy={isLoading || isSaving}
        error={storageError}
        onSelect={(ageBand) => void selectAgeBand(ageBand)}
        onDecline={() => void declineAgeSelection()}
        onRemove={() => void removeAgeClassification()}
        onContinueWithoutAds={continueWithoutAds}
      />
    </AgeClassificationContext.Provider>
  );
}

export function useAgeClassification() {
  const context = useContext(AgeClassificationContext);
  if (!context) {
    throw new Error('useAgeClassification must be used within AgeClassificationProvider');
  }
  return context;
}
