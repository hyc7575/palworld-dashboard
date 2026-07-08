import { getConfig } from "@/lib/config/env";
import { mockPalworld } from "@/lib/mock/mockClients";
import type { PalworldMetrics, PlayerSummary } from "@/types/server";

type HttpMethod = "GET" | "POST";
type PalworldRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  timeoutMs?: number;
  attempts?: number;
  ignoreResponseBody?: boolean;
};

export class PalworldRequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Palworld REST API 요청 시간이 ${timeoutMs}ms를 초과했습니다.`);
    this.name = "PalworldRequestTimeoutError";
  }
}

function authHeader(): string {
  const config = getConfig();
  return `Basic ${Buffer.from(`${config.palworldAdminUsername}:${config.palworldAdminPassword}`).toString("base64")}`;
}

async function palworldRequest<T>(path: string, options: PalworldRequestOptions = {}): Promise<T> {
  const config = getConfig();
  const url = `${config.palworldRestBaseUrl}/${path.replace(/^\//, "")}`;
  const timeoutMs = options.timeoutMs ?? config.palworldStatusTimeoutMs;
  const attempts = options.attempts ?? 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        Authorization: authHeader(),
        Accept: "application/json",
      };
      if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Palworld REST API 응답 오류: ${response.status}`);
      }

      if (options.ignoreResponseBody) {
        void response.body?.cancel();
        return undefined as T;
      }

      const text = await response.text();
      return (text.trim() ? JSON.parse(text) : undefined) as T;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new PalworldRequestTimeoutError(timeoutMs);
      }
      if (attempt === attempts - 1) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Palworld REST API 요청에 실패했습니다.");
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readFirstNumber(source: Record<string, unknown>, keys: string[], fallback: number | null): number | null {
  for (const key of keys) {
    const value = numberFrom(source[key]);
    if (value !== null) return value;
  }
  return fallback;
}

export async function getMetrics(): Promise<PalworldMetrics> {
  const config = getConfig();
  if (config.mock) return mockPalworld.getMetrics();

  const raw = await palworldRequest<Record<string, unknown>>("metrics", {
    timeoutMs: config.palworldStatusTimeoutMs,
  });
  const currentPlayers = readFirstNumber(raw, ["currentPlayers", "current_players", "currentplayernum"], 0) ?? 0;
  const maxPlayers =
    readFirstNumber(raw, ["maxPlayers", "max_players", "maxplayernum", "server_player_max_num"], 0) ?? 0;

  return {
    currentPlayers,
    maxPlayers,
    serverFps: readFirstNumber(raw, ["serverFps", "server_fps", "serverfps", "fps"], null),
    uptime: readFirstNumber(raw, ["uptime", "upTime", "server_uptime"], null),
    raw,
  };
}

function sanitizePlayer(rawPlayer: Record<string, unknown>): PlayerSummary {
  return {
    name:
      String(rawPlayer.name ?? rawPlayer.playerName ?? rawPlayer.nickname ?? rawPlayer.userName ?? "이름 없음").trim() ||
      "이름 없음",
    level: readFirstNumber(rawPlayer, ["level", "playerLevel"], null),
    ping: readFirstNumber(rawPlayer, ["ping", "latency"], null),
  };
}

export async function getPlayers(): Promise<PlayerSummary[]> {
  const config = getConfig();
  if (config.mock) return mockPalworld.getPlayers();

  const raw = await palworldRequest<unknown>("players", {
    timeoutMs: config.palworldPlayersTimeoutMs,
  });
  const players = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { players?: unknown[] }).players)
      ? (raw as { players: unknown[] }).players
      : [];

  return players
    .filter((player): player is Record<string, unknown> => typeof player === "object" && player !== null)
    .map(sanitizePlayer);
}

export async function saveWorld(): Promise<void> {
  const config = getConfig();
  if (config.mock) return mockPalworld.saveWorld();
  await palworldRequest("save", {
    method: "POST",
    timeoutMs: config.palworldSaveTimeoutMs,
    attempts: 1,
    ignoreResponseBody: true,
  });
}

export async function shutdownServer({
  waittime,
  message,
}: {
  waittime: number;
  message: string;
}): Promise<void> {
  const config = getConfig();
  if (config.mock) return mockPalworld.shutdownServer();
  await palworldRequest("shutdown", {
    method: "POST",
    body: {
      waittime,
      message,
    },
    timeoutMs: config.palworldShutdownTimeoutMs,
    attempts: 1,
    ignoreResponseBody: true,
  });
}

export async function announce(message: string): Promise<void> {
  if (getConfig().mock) return mockPalworld.announce();
  await palworldRequest("announce", {
    method: "POST",
    body: { message },
    ignoreResponseBody: true,
  });
}
