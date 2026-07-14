import type { PalworldMetrics, PlayerSummary, ServerControlState, VmSummary } from "@/types/server";

type MockStore = {
  vm: VmSummary;
  state: ServerControlState;
  players: PlayerSummary[];
  startedAt: number;
  operations: string[];
  failNextOperation: string | null;
};

const globalForMock = globalThis as typeof globalThis & {
  __palworldMockStore?: MockStore;
};

function initialState(): ServerControlState {
  const now = new Date().toISOString();
  return {
    autoStopEnabled: true,
    emptySince: null,
    lastStartedAt: now,
    lastStoppedAt: null,
    lastActionBy: "mock",
    lastActionType: "start",
    operationInProgress: false,
    operationType: null,
    operationStartedAt: null,
    operationId: null,
  };
}

export function getMockStore(): MockStore {
  if (!globalForMock.__palworldMockStore) {
    globalForMock.__palworldMockStore = {
      vm: {
        status: "RUNNING",
        externalIp: "203.0.113.24",
        internalIp: "10.0.0.24",
        machineType: "e2-highmem-4",
      },
      state: initialState(),
      players: [
        { name: "밤하늘", level: 42, ping: 23 },
        { name: "초코팜", level: 31, ping: 37 },
      ],
      startedAt: Date.now() - 1000 * 60 * 48,
      operations: [],
      failNextOperation: null,
    };
  }
  return globalForMock.__palworldMockStore;
}

function recordOperation(name: string): void {
  const store = getMockStore();
  store.operations.push(name);
  if (store.failNextOperation === name) {
    store.failNextOperation = null;
    throw new Error(`mock ${name} failure`);
  }
}

export const mockCompute = {
  async getVmStatus(): Promise<VmSummary> {
    return getMockStore().vm;
  },
  async startVm(): Promise<void> {
    recordOperation("start");
    const store = getMockStore();
    store.vm.status = "RUNNING";
    store.startedAt = Date.now();
  },
  async stopVm(): Promise<void> {
    recordOperation("stop");
    const store = getMockStore();
    store.vm.status = "TERMINATED";
    store.players = [];
  },
  async setMachineType(machineType: string): Promise<void> {
    recordOperation("set-machine-type");
    getMockStore().vm.machineType = machineType;
  },
  async getVmExternalIp(): Promise<string | null> {
    return getMockStore().vm.externalIp;
  },
  async getVmInternalIp(): Promise<string | null> {
    return getMockStore().vm.internalIp;
  },
};

export const mockPalworld = {
  async getMetrics(): Promise<PalworldMetrics> {
    const store = getMockStore();
    if (store.vm.status !== "RUNNING") throw new Error("Palworld 서버가 실행 중이 아닙니다.");
    return {
      currentPlayers: store.players.length,
      maxPlayers: 12,
      serverFps: 59,
      uptime: Math.floor((Date.now() - store.startedAt) / 1000),
    };
  },
  async getPlayers(): Promise<PlayerSummary[]> {
    return getMockStore().players;
  },
  async saveWorld(): Promise<void> {
    recordOperation("save");
    return;
  },
  async shutdownServer(): Promise<void> {
    recordOperation("shutdown");
    return;
  },
  async announce(): Promise<void> {
    recordOperation("announce");
    return;
  },
};

export const mockState = {
  async getState(defaultState: ServerControlState): Promise<ServerControlState> {
    const store = getMockStore();
    store.state = { ...defaultState, ...store.state };
    return store.state;
  },
  async updateState(patch: Partial<ServerControlState>): Promise<ServerControlState> {
    const store = getMockStore();
    store.state = {
      ...store.state,
      ...patch,
    };
    return store.state;
  },
};
