import { getConfig } from "@/lib/config/env";
import { getVmStatus, startVm, stopVm } from "@/lib/gcp/compute";
import { saveWorld, shutdownServer } from "@/lib/palworld/client";
import { updateServerControlState } from "@/lib/state/serverState";
import type { ServerControlState } from "@/types/server";

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function startServer(actor = "shared"): Promise<{ status: "STARTING_VM" | "ALREADY_RUNNING" }> {
  const vm = await getVmStatus();
  if (vm.status === "RUNNING") {
    await updateServerControlState({
      lastActionBy: actor,
      lastActionType: "start",
    });
    return { status: "ALREADY_RUNNING" };
  }

  await startVm();
  await updateServerControlState({
    emptySince: null,
    lastStartedAt: nowIso(),
    lastActionBy: actor,
    lastActionType: "start",
  });
  return { status: "STARTING_VM" };
}

export async function saveServer(): Promise<{ status: "SAVE_REQUESTED" }> {
  await saveWorld();
  return { status: "SAVE_REQUESTED" };
}

export async function shutdownServerGracefully(actor = "shared"): Promise<{ status: "SHUTDOWN_REQUESTED" }> {
  const waitSeconds = getConfig().palworldShutdownWaitSeconds;
  await saveWorld();
  await shutdownServer({
    waittime: waitSeconds,
    message: "서버가 곧 종료됩니다. 진행 상황은 제어판에서 확인해 주세요.",
  });
  await sleep(waitSeconds * 1000);
  await stopVm();
  await updateServerControlState({
    emptySince: null,
    lastStoppedAt: nowIso(),
    lastActionBy: actor,
    lastActionType: "shutdown",
  });
  return { status: "SHUTDOWN_REQUESTED" };
}

export async function forceStopServer(actor = "shared"): Promise<{ status: "FORCE_STOPPED" }> {
  await stopVm();
  await updateServerControlState({
    emptySince: null,
    lastStoppedAt: nowIso(),
    lastActionBy: actor,
    lastActionType: "force-stop",
  });
  return { status: "FORCE_STOPPED" };
}

export async function setAutoStopEnabled(enabled: boolean, actor = "shared"): Promise<ServerControlState> {
  const patch: Partial<ServerControlState> = {
    autoStopEnabled: enabled,
    lastActionBy: actor,
  };

  if (!enabled) {
    patch.emptySince = null;
  }

  return updateServerControlState(patch);
}
