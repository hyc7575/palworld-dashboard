import { getConfig } from "@/lib/config/env";
import { ComputeOperationError, getVmStatus, setVmMachineType, startVm, stopVm } from "@/lib/gcp/compute";
import { getPlayers, saveWorld, shutdownServer } from "@/lib/palworld/client";
import { updateServerControlState, withServerControlLock } from "@/lib/state/serverState";
import { ControlOperationError } from "@/lib/control/errors";
import { getMachineProfile } from "@/lib/control/profiles";
import type { MachineProfile, ServerControlState, VmSummary } from "@/types/server";

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function startServerUnlocked(actor: string): Promise<{ status: "STARTING_VM" | "ALREADY_RUNNING" }> {
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

export async function startServer(actor = "shared"): Promise<{ status: "STARTING_VM" | "ALREADY_RUNNING" }> {
  return withServerControlLock("start", () => startServerUnlocked(actor));
}

export async function saveServer(): Promise<{ status: "SAVE_REQUESTED" }> {
  await saveWorld();
  return { status: "SAVE_REQUESTED" };
}

export async function shutdownServerGracefully(actor = "shared"): Promise<{ status: "SHUTDOWN_REQUESTED" }> {
  return withServerControlLock("shutdown", async () => {
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
  });
}

export async function forceStopServer(actor = "shared"): Promise<{ status: "FORCE_STOPPED" }> {
  return withServerControlLock("force-stop", async () => {
    await stopVm();
    await updateServerControlState({
      emptySince: null,
      lastStoppedAt: nowIso(),
      lastActionBy: actor,
      lastActionType: "force-stop",
    });
    return { status: "FORCE_STOPPED" };
  });
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

type ProfileActionResult = {
  status: "STARTING_VM" | "RESTARTING_VM" | "ALREADY_SELECTED";
  profile: MachineProfile;
  machineType: string;
  currentMachineType: string | null;
  currentVmStatus: VmSummary["status"];
};

function actionDetails(profile: MachineProfile, machineType: string, vm: VmSummary, failedStage: string) {
  return {
    requestedProfile: profile,
    requestedMachineType: machineType,
    currentMachineType: vm.machineType,
    currentVmStatus: vm.status,
    failedStage,
  };
}

function isCapacityError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  const reason = error instanceof ComputeOperationError ? error.reason || "" : "";
  return /ZONE_RESOURCE_POOL_EXHAUSTED|RESOURCE_POOL_EXHAUSTED|resource.*exhausted/i.test(`${reason} ${text}`);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof ComputeOperationError && error.reason === "OPERATION_TIMEOUT";
}

async function profileStep<T>(
  stage: string,
  profile: MachineProfile,
  machineType: string,
  vm: VmSummary,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ControlOperationError) throw error;
    const details = actionDetails(profile, machineType, vm, stage);
    if (isTimeoutError(error)) {
      throw new ControlOperationError("Compute operation 대기 시간이 초과되었습니다.", "COMPUTE_OPERATION_TIMEOUT", 504, details);
    }
    if (stage === "players" || stage === "save" || stage === "shutdown") {
      throw new ControlOperationError(
        "Palworld 저장 또는 정상 종료에 실패했습니다. 서버 종료를 제어판에서 수동으로 먼저 진행한 후 다시 시도해주세요.",
        "PALWORLD_GRACEFUL_SHUTDOWN_FAILED",
        502,
        details,
      );
    }
    if (stage === "stop") {
      throw new ControlOperationError("VM 중지에 실패했습니다.", "VM_STOP_FAILED", 502, details);
    }
    if (stage === "set-machine-type") {
      const message = isCapacityError(error)
        ? "선택한 machine type의 현재 zone 자원이 부족합니다."
        : "machine type 변경에 실패했습니다.";
      throw new ControlOperationError(message, isCapacityError(error) ? "MACHINE_TYPE_CAPACITY_EXHAUSTED" : "MACHINE_TYPE_CHANGE_FAILED", 502, details);
    }
    throw new ControlOperationError("VM 재시작에 실패했습니다.", "VM_RESTART_FAILED", 502, details);
  }
}

export async function startServerWithProfile(profile: MachineProfile, actor = "shared"): Promise<ProfileActionResult> {
  const target = getMachineProfile(profile);
  return withServerControlLock(`profile-${target.actionLabel}`, async () => {
    const vm = await profileStep("get-vm", profile, target.machineType, {
      status: "UNKNOWN",
      externalIp: null,
      internalIp: null,
      machineType: null,
    }, getVmStatus);

    if (vm.status !== "TERMINATED" && vm.status !== "RUNNING") {
      throw new ControlOperationError(
        "VM 상태가 전환 중이어서 프로필을 변경할 수 없습니다.",
        "VM_STATE_TRANSITION",
        409,
        actionDetails(profile, target.machineType, vm, "get-vm"),
      );
    }

    if (vm.status === "TERMINATED") {
      if (vm.machineType !== target.machineType) {
        await profileStep("set-machine-type", profile, target.machineType, vm, () => setVmMachineType(target.machineType));
      }
      await profileStep("start", profile, target.machineType, vm, startVm);
      await updateServerControlState({
        emptySince: null,
        lastStartedAt: nowIso(),
        lastActionBy: actor,
        lastActionType: profile === "low" ? "start-low" : "start-normal",
      });
      return {
        status: "STARTING_VM",
        profile,
        machineType: target.machineType,
        currentMachineType: vm.machineType,
        currentVmStatus: vm.status,
      };
    }

    if (vm.machineType === target.machineType) {
      return {
        status: "ALREADY_SELECTED",
        profile,
        machineType: target.machineType,
        currentMachineType: vm.machineType,
        currentVmStatus: vm.status,
      };
    }

    const players = await profileStep("players", profile, target.machineType, vm, getPlayers);
    if (players.length > 0) {
      throw new ControlOperationError(
        `현재 접속자 ${players.length}명이 있어 사양을 변경할 수 없습니다.`,
        "PLAYERS_CONNECTED",
        409,
        { ...actionDetails(profile, target.machineType, vm, "players"), currentPlayerCount: players.length },
      );
    }

    const waitSeconds = getConfig().palworldShutdownWaitSeconds;
    await profileStep("save", profile, target.machineType, vm, saveWorld);
    await profileStep("shutdown", profile, target.machineType, vm, () =>
      shutdownServer({ waittime: waitSeconds, message: "서버 사양 변경을 위해 안전하게 종료합니다." }),
    );
    await sleep(waitSeconds * 1000);
    await profileStep("stop", profile, target.machineType, vm, stopVm);
    const stoppedVm = await profileStep("verify-terminated", profile, target.machineType, vm, getVmStatus);
    if (stoppedVm.status !== "TERMINATED") {
      throw new ControlOperationError("VM이 완전히 중지되지 않아 machine type을 변경할 수 없습니다.", "VM_NOT_TERMINATED", 502, actionDetails(profile, target.machineType, stoppedVm, "verify-terminated"));
    }
    await profileStep("set-machine-type", profile, target.machineType, stoppedVm, () => setVmMachineType(target.machineType));
    await profileStep("start", profile, target.machineType, stoppedVm, startVm);
    await updateServerControlState({
      emptySince: null,
      lastStartedAt: nowIso(),
      lastStoppedAt: nowIso(),
      lastActionBy: actor,
      lastActionType: profile === "low" ? "switch-low" : "switch-normal",
    });
    return {
      status: "RESTARTING_VM",
      profile,
      machineType: target.machineType,
      currentMachineType: vm.machineType,
      currentVmStatus: vm.status,
    };
  });
}
