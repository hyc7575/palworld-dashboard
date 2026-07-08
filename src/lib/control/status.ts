import { getConfig } from "@/lib/config/env";
import { getVmStatus } from "@/lib/gcp/compute";
import { getMetrics } from "@/lib/palworld/client";
import { getServerControlState } from "@/lib/state/serverState";
import type { PalworldServerStatus, ServerStatusResponse, VmStatus } from "@/types/server";

function serverStatusFromVm(vmStatus: VmStatus): PalworldServerStatus {
  if (vmStatus === "RUNNING") return "UNKNOWN";
  if (vmStatus === "PROVISIONING" || vmStatus === "STAGING") return "STARTING_VM";
  if (vmStatus === "STOPPING" || vmStatus === "SUSPENDING") return "STOPPING";
  if (vmStatus === "TERMINATED" || vmStatus === "SUSPENDED") return "OFFLINE";
  return "UNKNOWN";
}

function remainingSeconds(emptySince: string | null, emptyMinutes: number): number | null {
  if (!emptySince) return null;
  const started = new Date(emptySince).getTime();
  if (!Number.isFinite(started)) return null;
  const shutdownAt = started + emptyMinutes * 60 * 1000;
  return Math.max(0, Math.ceil((shutdownAt - Date.now()) / 1000));
}

export async function getCurrentStatus(): Promise<ServerStatusResponse> {
  const config = getConfig();
  const [vm, state] = await Promise.all([getVmStatus(), getServerControlState()]);
  const connectAddress = vm.externalIp ? `${vm.externalIp}:8211` : null;

  if (vm.status !== "RUNNING") {
    return {
      vmStatus: vm.status,
      serverStatus: serverStatusFromVm(vm.status),
      connectAddress,
      currentPlayers: null,
      maxPlayers: null,
      serverFps: null,
      uptime: null,
      autoStop: {
        enabled: state.autoStopEnabled,
        emptySince: state.emptySince,
        shutdownAfterMinutes: config.autostopEmptyMinutes,
        graceMinutes: config.autostopGraceMinutes,
        remainingSeconds: remainingSeconds(state.emptySince, config.autostopEmptyMinutes),
      },
      lastStartedAt: state.lastStartedAt,
      lastStoppedAt: state.lastStoppedAt,
      lastActionBy: state.lastActionBy,
      lastActionType: state.lastActionType,
      message: vm.status === "TERMINATED" ? "서버가 꺼져 있습니다." : "VM 상태가 전환되는 중입니다.",
    };
  }

  try {
    const metrics = await getMetrics();
    return {
      vmStatus: vm.status,
      serverStatus: "ONLINE",
      connectAddress,
      currentPlayers: metrics.currentPlayers,
      maxPlayers: metrics.maxPlayers,
      serverFps: metrics.serverFps,
      uptime: metrics.uptime,
      autoStop: {
        enabled: state.autoStopEnabled,
        emptySince: state.emptySince,
        shutdownAfterMinutes: config.autostopEmptyMinutes,
        graceMinutes: config.autostopGraceMinutes,
        remainingSeconds: remainingSeconds(state.emptySince, config.autostopEmptyMinutes),
      },
      lastStartedAt: state.lastStartedAt,
      lastStoppedAt: state.lastStoppedAt,
      lastActionBy: state.lastActionBy,
      lastActionType: state.lastActionType,
      message: "접속 가능합니다.",
    };
  } catch (error) {
    console.warn("[status] Palworld metrics request failed", error);
    return {
      vmStatus: vm.status,
      serverStatus: "BOOTING_SERVER",
      connectAddress,
      currentPlayers: null,
      maxPlayers: null,
      serverFps: null,
      uptime: null,
      autoStop: {
        enabled: state.autoStopEnabled,
        emptySince: state.emptySince,
        shutdownAfterMinutes: config.autostopEmptyMinutes,
        graceMinutes: config.autostopGraceMinutes,
        remainingSeconds: remainingSeconds(state.emptySince, config.autostopEmptyMinutes),
      },
      lastStartedAt: state.lastStartedAt,
      lastStoppedAt: state.lastStoppedAt,
      lastActionBy: state.lastActionBy,
      lastActionType: state.lastActionType,
      message: "VM은 켜졌지만 Palworld 서버가 아직 준비되지 않았습니다.",
    };
  }
}
