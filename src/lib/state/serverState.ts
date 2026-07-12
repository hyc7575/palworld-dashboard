import { Firestore, type DocumentData } from "@google-cloud/firestore";
import { getConfig } from "@/lib/config/env";
import { mockState } from "@/lib/mock/mockClients";
import type { ServerControlState } from "@/types/server";
import { ControlOperationError } from "@/lib/control/errors";

let firestore: Firestore | null = null;

function defaultState(): ServerControlState {
  return {
    autoStopEnabled: getConfig().autostopEnabledDefault,
    emptySince: null,
    lastStartedAt: null,
    lastStoppedAt: null,
    lastActionBy: null,
    lastActionType: null,
    operationInProgress: false,
    operationType: null,
    operationStartedAt: null,
    operationId: null,
  };
}

function getFirestore(): Firestore {
  if (!firestore) {
    firestore = new Firestore({
      projectId: getConfig().gcpProjectId,
    });
  }
  return firestore;
}

function stateDoc() {
  const config = getConfig();
  return getFirestore().collection(config.firestoreStateCollection).doc(config.firestoreStateDocument);
}

function normalizeState(data: DocumentData | undefined): ServerControlState {
  return {
    ...defaultState(),
    ...data,
  } as ServerControlState;
}

export async function getServerControlState(): Promise<ServerControlState> {
  if (getConfig().mock) return mockState.getState(defaultState());
  const snapshot = await stateDoc().get();
  return normalizeState(snapshot.exists ? snapshot.data() : undefined);
}

export async function updateServerControlState(patch: Partial<ServerControlState>): Promise<ServerControlState> {
  if (getConfig().mock) return mockState.updateState(patch);
  await stateDoc().set(patch, { merge: true });
  return getServerControlState();
}

function operationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function lockExpired(startedAt: string | null, timeoutMs: number): boolean {
  if (!startedAt) return true;
  const startedMs = new Date(startedAt).getTime();
  return !Number.isFinite(startedMs) || Date.now() - startedMs >= timeoutMs;
}

export async function withServerControlLock<T>(operationType: string, fn: () => Promise<T>): Promise<T> {
  const config = getConfig();
  const id = operationId();
  const startedAt = new Date().toISOString();

  if (config.mock) {
    const state = await getServerControlState();
    if (state.operationInProgress && !lockExpired(state.operationStartedAt, config.controlOperationLockTimeoutMs)) {
      throw new ControlOperationError("다른 서버 제어 작업이 진행 중입니다. 완료 후 다시 시도해주세요.", "OPERATION_IN_PROGRESS", 409);
    }
    await updateServerControlState({ operationInProgress: true, operationType, operationStartedAt: startedAt, operationId: id });
  } else {
    await getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateDoc());
      const state = normalizeState(snapshot.exists ? snapshot.data() : undefined);
      if (state.operationInProgress && !lockExpired(state.operationStartedAt, config.controlOperationLockTimeoutMs)) {
        throw new ControlOperationError("다른 서버 제어 작업이 진행 중입니다. 완료 후 다시 시도해주세요.", "OPERATION_IN_PROGRESS", 409);
      }
      transaction.set(
        stateDoc(),
        { operationInProgress: true, operationType, operationStartedAt: startedAt, operationId: id },
        { merge: true },
      );
    });
  }

  try {
    return await fn();
  } finally {
    if (config.mock) {
      const state = await getServerControlState();
      if (state.operationId === id) {
        await updateServerControlState({ operationInProgress: false, operationType: null, operationStartedAt: null, operationId: null });
      }
    } else {
      await getFirestore().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(stateDoc());
        const state = normalizeState(snapshot.exists ? snapshot.data() : undefined);
        if (state.operationId === id) {
          transaction.set(
            stateDoc(),
            { operationInProgress: false, operationType: null, operationStartedAt: null, operationId: null },
            { merge: true },
          );
        }
      });
    }
  }
}
