'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export type OnboardingStepId = 'cloneSample' | 'editUi' | 'editRules' | 'runPlayground' | 'explainTrace';

export type OnboardingState = {
  open: boolean;
  dismissed: boolean;
  activeVersionId: string | null;
  steps: Partial<Record<OnboardingStepId, boolean>>;
};

export type OnboardingApi = {
  state: OnboardingState;
  open: () => void;
  close: () => void;
  dismiss: () => void;
  reset: () => void;
  setActiveVersionId: (versionId: string) => void;
  completeStep: (step: OnboardingStepId) => void;
  isComplete: (step: OnboardingStepId) => boolean;
};

const STORAGE_KEY = 'rf:onboarding:v1';

const defaultState: OnboardingState = {
  open: false,
  dismissed: false,
  activeVersionId: null,
  steps: {},
};

function readState(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      open: Boolean(parsed.open),
      dismissed: Boolean(parsed.dismissed),
      activeVersionId: typeof parsed.activeVersionId === 'string' ? parsed.activeVersionId : null,
      steps: parsed.steps && typeof parsed.steps === 'object' ? (parsed.steps as OnboardingState['steps']) : {},
    };
  } catch {
    return defaultState;
  }
}

function writeState(state: OnboardingState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const Ctx = createContext<OnboardingApi | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const versionIdFromUrl = searchParams.get('versionId')?.trim() ?? '';
  const [state, setState] = useState<OnboardingState>(() => defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = readState();
    // First visit: open automatically.
    if (!next.dismissed && next.open === false && next.activeVersionId === null && Object.keys(next.steps).length === 0) {
      next.open = true;
    }
    setState(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeState(state);
  }, [hydrated, state]);

  // Keep activeVersionId synced from URLs like:
  // - /builder?versionId=...
  // - /builder/rules?versionId=...
  // - /playground?versionId=...
  useEffect(() => {
    if (!versionIdFromUrl) return;
    setState((current) => {
      if (current.activeVersionId === versionIdFromUrl) return current;
      return {
        ...current,
        activeVersionId: versionIdFromUrl,
        steps: { ...current.steps, cloneSample: true },
      };
    });
  }, [pathname, versionIdFromUrl]);

  const open = useCallback(() => setState((current) => (current.open ? current : { ...current, open: true })), []);
  const close = useCallback(() => setState((current) => (!current.open ? current : { ...current, open: false })), []);
  const dismiss = useCallback(
    () =>
      setState((current) =>
        current.dismissed && !current.open ? current : { ...current, dismissed: true, open: false },
      ),
    [],
  );

  const reset = useCallback(() => {
    setState({ ...defaultState, open: true });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const setActiveVersionId = useCallback((versionId: string) => {
    const next = versionId.trim();
    if (!next) return;
    setState((current) => {
      const alreadySet = current.activeVersionId === next;
      const alreadyMarked = current.steps.cloneSample === true;
      if (alreadySet && alreadyMarked) return current;
      return {
        ...current,
        activeVersionId: next,
        steps: { ...current.steps, cloneSample: true },
      };
    });
  }, []);

  const completeStep = useCallback((step: OnboardingStepId) => {
    setState((current) => {
      if (current.steps[step] === true) return current;
      return { ...current, steps: { ...current.steps, [step]: true } };
    });
  }, []);

  const isComplete = useCallback((step: OnboardingStepId) => Boolean(state.steps[step]), [state.steps]);

  const api = useMemo<OnboardingApi>(
    () => ({
      state,
      open,
      close,
      dismiss,
      reset,
      setActiveVersionId,
      completeStep,
      isComplete,
    }),
    [close, completeStep, dismiss, isComplete, open, reset, setActiveVersionId, state],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useOnboarding(): OnboardingApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}
