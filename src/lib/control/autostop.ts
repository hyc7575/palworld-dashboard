import { OAuth2Client } from "google-auth-library";
import type { NextRequest } from "next/server";
import { getConfig } from "@/lib/config/env";
import { getVmStatus, stopVm } from "@/lib/gcp/compute";
import { getMetrics, saveWorld, shutdownServer } from "@/lib/palworld/client";
import { getServerControlState, updateServerControlState } from "@/lib/state/serverState";

let oidcClient: OAuth2Client | null = null;

function getOidcClient(): OAuth2Client {
  if (!oidcClient) oidcClient = new OAuth2Client();
  return oidcClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function verifyAutostopRequest(request: NextRequest): Promise<boolean> {
  const config = getConfig();
  const sharedSecret = request.headers.get("x-autostop-secret");
  if (config.autostopSecret && sharedSecret === config.autostopSecret) return true;

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  if (token && config.autostopOidcAudience) {
    const ticket = await getOidcClient().verifyIdToken({
      idToken: token,
      audience: config.autostopOidcAudience,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return false;
    if (config.autostopSchedulerServiceAccount && payload.email !== config.autostopSchedulerServiceAccount) {
      return false;
    }
    return true;
  }

  return config.mock && !config.autostopSecret && !config.autostopOidcAudience;
}

export async function runAutostopCheck(): Promise<{ action: string; message: string }> {
  const config = getConfig();
  const state = await getServerControlState();
  if (!state.autoStopEnabled) {
    return { action: "noop", message: "자동 종료가 꺼져 있습니다." };
  }

  const vm = await getVmStatus();
  if (vm.status !== "RUNNING") {
    if (state.emptySince) await updateServerControlState({ emptySince: null });
    return { action: "noop", message: "VM이 실행 중이 아닙니다." };
  }

  let metrics;
  try {
    metrics = await getMetrics();
  } catch (error) {
    console.warn("[autostop] Palworld metrics unavailable", error);
    return { action: "noop", message: "Palworld REST API가 아직 준비되지 않았습니다." };
  }

  if (metrics.uptime !== null && metrics.uptime < config.autostopGraceMinutes * 60) {
    return { action: "noop", message: "서버 시작 후 보호 시간입니다." };
  }

  if (metrics.currentPlayers > 0) {
    if (state.emptySince) await updateServerControlState({ emptySince: null });
    return { action: "reset-empty", message: "접속자가 있어 자동 종료 타이머를 초기화했습니다." };
  }

  const now = Date.now();
  if (!state.emptySince) {
    await updateServerControlState({
      emptySince: new Date(now).toISOString(),
    });
    return { action: "mark-empty", message: "0명 상태를 기록했습니다." };
  }

  const emptySinceMs = new Date(state.emptySince).getTime();
  const emptyForMs = Number.isFinite(emptySinceMs) ? now - emptySinceMs : 0;
  if (emptyForMs < config.autostopEmptyMinutes * 60 * 1000) {
    return { action: "wait", message: "0명 상태가 종료 기준 시간보다 짧습니다." };
  }

  const waitSeconds = config.palworldShutdownWaitSeconds;
  await saveWorld();
  await shutdownServer({
    waittime: waitSeconds,
    message: "접속자가 없어 자동으로 서버를 종료합니다.",
  });
  await sleep(waitSeconds * 1000);
  await stopVm();
  await updateServerControlState({
    emptySince: null,
    lastStoppedAt: new Date().toISOString(),
    lastActionBy: "autostop",
    lastActionType: "autostop",
  });

  return { action: "stopped", message: "0명 상태가 지속되어 서버를 자동 종료했습니다." };
}
