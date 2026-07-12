export type VmStatus =
  | "TERMINATED"
  | "PROVISIONING"
  | "STAGING"
  | "RUNNING"
  | "STOPPING"
  | "SUSPENDING"
  | "SUSPENDED"
  | "UNKNOWN";

export type PalworldServerStatus =
  | "OFFLINE"
  | "STARTING_VM"
  | "BOOTING_SERVER"
  | "ONLINE"
  | "STOPPING"
  | "UNKNOWN";

export type MachineProfile = "low" | "normal";

export type LastActionType =
  | "start"
  | "start-low"
  | "start-normal"
  | "switch-low"
  | "switch-normal"
  | "shutdown"
  | "force-stop"
  | "autostop"
  | null;

export type ServerControlState = {
  autoStopEnabled: boolean;
  emptySince: string | null;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastActionBy: string | null;
  lastActionType: LastActionType;
  operationInProgress: boolean;
  operationType: string | null;
  operationStartedAt: string | null;
  operationId: string | null;
};

export type PalworldMetrics = {
  currentPlayers: number;
  maxPlayers: number;
  serverFps: number | null;
  uptime: number | null;
  raw?: unknown;
};

export type PlayerSummary = {
  name: string;
  level: number | null;
  ping: number | null;
};

export type VmSummary = {
  status: VmStatus;
  externalIp: string | null;
  internalIp: string | null;
  machineType: string | null;
};

export type AutoStopSummary = {
  enabled: boolean;
  emptySince: string | null;
  shutdownAfterMinutes: number;
  graceMinutes: number;
  remainingSeconds: number | null;
};

export type ServerStatusResponse = {
  vmStatus: VmStatus;
  serverStatus: PalworldServerStatus;
  connectAddress: string | null;
  currentPlayers: number | null;
  maxPlayers: number | null;
  serverFps: number | null;
  uptime: number | null;
  autoStop: AutoStopSummary;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastActionBy: string | null;
  lastActionType: LastActionType;
  currentProfile: MachineProfile | null;
  currentMachineType: string | null;
  machineProfiles: {
    low: string;
    normal: string;
  };
  message: string | null;
};

export type ApiError = {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ApiError;
    };
