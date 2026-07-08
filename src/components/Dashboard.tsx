"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoStopStatus } from "@/components/AutoStopStatus";
import { DangerZone } from "@/components/DangerZone";
import { PlayerList } from "@/components/PlayerList";
import { ServerActionPanel } from "@/components/ServerActionPanel";
import { ServerStatusCard } from "@/components/ServerStatusCard";
import type { ApiResponse, PlayerSummary, ServerStatusResponse } from "@/types/server";

type ActionName = "start" | "save" | "shutdown" | "force-stop" | "autostop";

async function readApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

type PlayersApiResponse =
  | ApiResponse<PlayerSummary[]>
  | {
      ok: false;
      players: PlayerSummary[];
      message: string;
    };

async function readPlayersApi(): Promise<PlayerSummary[]> {
  const response = await fetch("/api/players", { cache: "no-store" });
  const payload = (await response.json()) as PlayersApiResponse;

  if (payload.ok) return payload.data;
  if ("players" in payload) return payload.players;
  throw new Error(payload.error.message);
}

function userMessage(error: unknown): string {
  if (!(error instanceof Error)) return "요청을 처리하지 못했습니다.";
  if (/AbortError|TimeoutError|operation was aborted|fetch failed|Failed to fetch/i.test(`${error.name} ${error.message}`)) {
    return "서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.";
  }
  return error.message;
}

export function Dashboard() {
  const [status, setStatus] = useState<ServerStatusResponse | null>(null);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<ActionName | null>(null);
  const actionInFlight = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const nextStatus = await readApi<ServerStatusResponse>("/api/status");
      setStatus(nextStatus);
      setError(null);

      if (nextStatus.serverStatus === "ONLINE") {
        const nextPlayers = await readPlayersApi();
        setPlayers(nextPlayers);
      } else {
        setPlayers([]);
      }
    } catch (nextError) {
      setError(userMessage(nextError));
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const pollingMs = useMemo(() => {
    if (!status) return 15000;
    return status.serverStatus === "STARTING_VM" ||
      status.serverStatus === "BOOTING_SERVER" ||
      status.serverStatus === "STOPPING"
      ? 10000
      : 15000;
  }, [status]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, pollingMs);
    return () => window.clearInterval(id);
  }, [pollingMs, refresh]);

  async function runAction(action: ActionName, fn: () => Promise<unknown>, success: string) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setLoadingAction(action);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(success);
      await refresh();
    } catch (nextError) {
      setError(userMessage(nextError));
    } finally {
      actionInFlight.current = false;
      setLoadingAction(null);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Palworld 서버 제어판</h1>
          {/* <p>친구들이 들어오기 쉽게 켜고, 안전하게 저장하고, 조용할 때 자동으로 종료합니다.</p> */}
        </div>
        <button className="button-subtle" onClick={logout} type="button">
          로그아웃
        </button>
      </header>

      <div className="grid">
        <div className="stack">
          {error ? <div className="error">{error}</div> : null}
          {notice ? <div className="success">{notice}</div> : null}
          <ServerStatusCard onRefresh={refresh} status={status} />
          <PlayerList players={players} />
        </div>

        <div className="stack">
          <ServerActionPanel
            loadingAction={loadingAction}
            onRefresh={refresh}
            onSave={() =>
              runAction(
                "save",
                () => readApi("/api/save", { method: "POST" }),
                "서버 저장을 요청했습니다.",
              )
            }
            onShutdown={() =>
              runAction(
                "shutdown",
                () => readApi("/api/shutdown", { method: "POST" }),
                "서버 종료 요청을 보냈습니다.",
              )
            }
            onStart={() =>
              runAction("start", () => readApi("/api/start", { method: "POST" }), "VM 켜는 중입니다.")
            }
            status={status}
          />
          <AutoStopStatus
            loading={loadingAction === "autostop"}
            onToggle={(enabled) =>
              runAction(
                "autostop",
                () =>
                  readApi("/api/autostop", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enabled }),
                  }),
                enabled ? "자동 종료를 켰습니다." : "자동 종료를 껐습니다.",
              )
            }
            status={status}
          />
          <DangerZone
            loading={loadingAction === "force-stop"}
            onForceStop={() =>
              runAction(
                "force-stop",
                () => readApi("/api/force-stop", { method: "POST" }),
                "강제 VM 중지를 요청했습니다.",
              )
            }
            status={status}
          />
        </div>
      </div>
    </main>
  );
}
