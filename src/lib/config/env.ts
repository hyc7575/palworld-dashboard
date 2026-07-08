export type AppConfig = {
  mock: boolean;
  controlPanelPassword: string;
  sessionSecret: string;
  gcpProjectId: string;
  gcpZone: string;
  gcpInstanceName: string;
  palworldRestBaseUrl: string;
  palworldAdminUsername: string;
  palworldAdminPassword: string;
  firestoreStateCollection: string;
  firestoreStateDocument: string;
  autostopEnabledDefault: boolean;
  autostopSecret: string;
  autostopOidcAudience: string;
  autostopSchedulerServiceAccount: string;
  autostopGraceMinutes: number;
  autostopEmptyMinutes: number;
  palworldStatusTimeoutMs: number;
  palworldPlayersTimeoutMs: number;
  palworldSaveTimeoutMs: number;
  palworldShutdownTimeoutMs: number;
  palworldShutdownWaitSeconds: number;
  computeOperationTimeoutMs: number;
};

let cachedConfig: AppConfig | null = null;

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw.toLowerCase() === "true" || raw === "1" || raw.toLowerCase() === "yes";
}

function readInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`환경변수 ${name} 값이 올바른 양의 정수가 아닙니다.`);
  }
  return value;
}

function required(name: string, options: { mock: boolean; mockFallback?: string } = { mock: false }): string {
  const raw = process.env[name];
  if (raw) return raw;
  if (options.mock && options.mockFallback !== undefined) return options.mockFallback;
  throw new Error(`필수 환경변수 ${name}이 설정되지 않았습니다.`);
}

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const mock = readBoolean("CONTROL_PANEL_MOCK", process.env.NODE_ENV !== "production");
  cachedConfig = {
    mock,
    controlPanelPassword: required("WEB_CONTROL_PASSWORD", {
      mock,
      mockFallback: "palworld",
    }),
    sessionSecret: required("SESSION_SECRET", {
      mock,
      mockFallback: "local-mock-session-secret-change-before-production",
    }),
    gcpProjectId: required("GCP_PROJECT_ID", { mock, mockFallback: "mock-project" }),
    gcpZone: required("GCP_ZONE", { mock, mockFallback: "asia-northeast3-a" }),
    gcpInstanceName: required("GCP_INSTANCE_NAME", { mock, mockFallback: "palworld-server" }),
    palworldRestBaseUrl: required("PALWORLD_REST_BASE_URL", {
      mock,
      mockFallback: "http://127.0.0.1:8212/v1/api",
    }).replace(/\/$/, ""),
    palworldAdminUsername: process.env.PALWORLD_ADMIN_USERNAME || "admin",
    palworldAdminPassword: required("PALWORLD_ADMIN_PASSWORD", {
      mock,
      mockFallback: "mock-admin-password",
    }),
    firestoreStateCollection: process.env.FIRESTORE_STATE_COLLECTION || "serverControl",
    firestoreStateDocument: process.env.FIRESTORE_STATE_DOCUMENT || "palworld",
    autostopEnabledDefault: readBoolean("AUTOSTOP_ENABLED_DEFAULT", true),
    autostopSecret: process.env.AUTOSTOP_SECRET || "",
    autostopOidcAudience: process.env.AUTOSTOP_OIDC_AUDIENCE || "",
    autostopSchedulerServiceAccount: process.env.AUTOSTOP_SCHEDULER_SERVICE_ACCOUNT || "",
    autostopGraceMinutes: readInteger("AUTOSTOP_GRACE_MINUTES", 20),
    autostopEmptyMinutes: readInteger("AUTOSTOP_EMPTY_MINUTES", 10),
    palworldStatusTimeoutMs: readInteger("PALWORLD_STATUS_TIMEOUT_MS", 5000),
    palworldPlayersTimeoutMs: readInteger("PALWORLD_PLAYERS_TIMEOUT_MS", 8000),
    palworldSaveTimeoutMs: readInteger("PALWORLD_SAVE_TIMEOUT_MS", 60000),
    palworldShutdownTimeoutMs: readInteger("PALWORLD_SHUTDOWN_TIMEOUT_MS", 60000),
    palworldShutdownWaitSeconds: readInteger("PALWORLD_SHUTDOWN_WAIT_SECONDS", 120),
    computeOperationTimeoutMs: readInteger("COMPUTE_OPERATION_TIMEOUT_MS", 180000),
  };

  if (!mock && !cachedConfig.autostopSecret && !cachedConfig.autostopOidcAudience) {
    throw new Error("AUTOSTOP_SECRET 또는 AUTOSTOP_OIDC_AUDIENCE 중 하나는 설정해야 합니다.");
  }

  if (process.env.NODE_ENV === "production" && cachedConfig.sessionSecret.length < 24) {
    throw new Error("SESSION_SECRET은 운영 환경에서 24자 이상이어야 합니다.");
  }

  return cachedConfig;
}
