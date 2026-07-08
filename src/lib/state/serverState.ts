import { Firestore, type DocumentData } from "@google-cloud/firestore";
import { getConfig } from "@/lib/config/env";
import { mockState } from "@/lib/mock/mockClients";
import type { ServerControlState } from "@/types/server";

let firestore: Firestore | null = null;

function defaultState(): ServerControlState {
  return {
    autoStopEnabled: getConfig().autostopEnabledDefault,
    emptySince: null,
    lastStartedAt: null,
    lastStoppedAt: null,
    lastActionBy: null,
    lastActionType: null,
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
