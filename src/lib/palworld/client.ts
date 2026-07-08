import { getConfig } from "@/lib/config/env";
import { mockPalworld } from "@/lib/mock/mockClients";
import type { PalworldMetrics, PlayerSummary } from "@/types/server";

type HttpMethod = "GET" | "POST";

function authHeader(): string {
  const config = getConfig();
  return `Basic ${Buffer.from(`${config.palworldAdminUsername}:${config.palworldAdminPassword}`).toString("base64")}`;
}

async function palworldRequest<T>(path: string, options: { method?: HttpMethod; body?: unknown } = {}): Promise<T> {
  const config = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  const url = `${config.palworldRestBaseUrl}/${path.replace(/^\//, "")}`;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: options.method || "GET",
          headers: {
            Authorization: authHeader(),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Palworld REST API 응답 오류: ${response.status}`);
        }

        if (response.status === 204) return undefined as T;
        const text = await response.text();
        return (text ? JSON.parse(text) : undefined) as T;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
    throw new Error("Palworld REST API 요청에 실패했습니다.");
  } finally {
    clearTimeout(timeout);
  }
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
  if (getConfig().mock) return mockPalworld.getMetrics();

  const raw = await palworldRequest<Record<string, unknown>>("metrics");
  const currentPlayers = readFirstNumber(raw, ["currentPlayers", "current_players", "currentplayernum"], 0) ?? 0;
  const maxPlayers = readFirstNumber(raw, ["maxPlayers", "max_players", "server_player_max_num"], 0) ?? 0;

  return {
    currentPlayers,
    maxPlayers,
    serverFps: readFirstNumber(raw, ["serverFps", "server_fps", "fps"], null),
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
  if (getConfig().mock) return mockPalworld.getPlayers();

  const raw = await palworldRequest<unknown>("players");
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
  if (getConfig().mock) return mockPalworld.saveWorld();
  await palworldRequest("save", { method: "POST" });
}

export async function shutdownServer({
  waittime,
  message,
}: {
  waittime: number;
  message: string;
}): Promise<void> {
  if (getConfig().mock) return mockPalworld.shutdownServer();
  await palworldRequest("shutdown", {
    method: "POST",
    body: {
      waittime,
      message,
    },
  });
}

export async function announce(message: string): Promise<void> {
  if (getConfig().mock) return mockPalworld.announce();
  await palworldRequest("announce", {
    method: "POST",
    body: { message },
  });
}
