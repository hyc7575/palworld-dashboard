import { getConfig } from "@/lib/config/env";
import type { MachineProfile } from "@/types/server";

export type MachineProfileDetails = {
  profile: MachineProfile;
  machineType: string;
  label: "저사양" | "일반";
  actionLabel: "low" | "normal";
};

export function isMachineProfile(value: unknown): value is MachineProfile {
  return value === "low" || value === "normal";
}

export function getMachineProfile(profile: MachineProfile): MachineProfileDetails {
  const config = getConfig();
  if (profile === "low") {
    return {
      profile,
      machineType: config.palworldMachineTypeLow,
      label: "저사양",
      actionLabel: "low",
    };
  }

  return {
    profile,
    machineType: config.palworldMachineTypeNormal,
    label: "일반",
    actionLabel: "normal",
  };
}

export function getProfileForMachineType(machineType: string | null): MachineProfile | null {
  if (!machineType) return null;
  const config = getConfig();
  if (machineType === config.palworldMachineTypeLow) return "low";
  if (machineType === config.palworldMachineTypeNormal) return "normal";
  return null;
}
