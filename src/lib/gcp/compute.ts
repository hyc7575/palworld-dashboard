import { GoogleAuth } from "google-auth-library";
import { getConfig } from "@/lib/config/env";
import { mockCompute } from "@/lib/mock/mockClients";
import type { VmStatus, VmSummary } from "@/types/server";

type ComputeInstanceResponse = {
  status?: string;
  machineType?: string;
  networkInterfaces?: Array<{
    networkIP?: string;
    accessConfigs?: Array<{
      natIP?: string;
    }>;
  }>;
};

type ComputeOperationResponse = {
  name?: string;
  status?: string;
  error?: {
    errors?: Array<{ code?: string; message?: string }>;
  };
};

export class ComputeOperationError extends Error {
  constructor(
    message: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = "ComputeOperationError";
  }
}

let authClient: GoogleAuth | null = null;

function getAuthClient(): GoogleAuth {
  if (!authClient) {
    authClient = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  return authClient;
}

function computeBaseUrl(): string {
  const config = getConfig();
  return `https://compute.googleapis.com/compute/v1/projects/${encodeURIComponent(
    config.gcpProjectId,
  )}/zones/${encodeURIComponent(config.gcpZone)}/instances/${encodeURIComponent(config.gcpInstanceName)}`;
}

function operationUrl(operationName: string): string {
  const config = getConfig();
  return `https://compute.googleapis.com/compute/v1/projects/${encodeURIComponent(
    config.gcpProjectId,
  )}/zones/${encodeURIComponent(config.gcpZone)}/operations/${encodeURIComponent(operationName)}`;
}

function machineTypeName(machineType: string | undefined): string | null {
  if (!machineType) return null;
  const marker = "/machineTypes/";
  const index = machineType.lastIndexOf(marker);
  return index >= 0 ? machineType.slice(index + marker.length) : machineType;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestCompute<T>(
  url: string,
  method: "GET" | "POST" = "GET",
  timeoutMs?: number,
): Promise<T> {
  const client = await getAuthClient().getClient();
  const response = await client.request<T>({
    url,
    method,
    timeout: timeoutMs,
  });
  return response.data;
}

function normalizeVmStatus(status: string | undefined): VmStatus {
  switch (status) {
    case "TERMINATED":
    case "PROVISIONING":
    case "STAGING":
    case "RUNNING":
    case "STOPPING":
    case "SUSPENDING":
    case "SUSPENDED":
      return status;
    default:
      return "UNKNOWN";
  }
}

export async function getVmStatus(): Promise<VmSummary> {
  if (getConfig().mock) return mockCompute.getVmStatus();

  const instance = await requestCompute<ComputeInstanceResponse>(computeBaseUrl());
  const primaryInterface = instance.networkInterfaces?.[0];

  return {
    status: normalizeVmStatus(instance.status),
    externalIp: primaryInterface?.accessConfigs?.[0]?.natIP ?? null,
    internalIp: primaryInterface?.networkIP ?? null,
    machineType: machineTypeName(instance.machineType),
  };
}

async function waitForOperation(operation: ComputeOperationResponse): Promise<void> {
  const config = getConfig();
  const operationName = operation.name;
  if (!operationName) {
    throw new ComputeOperationError("Compute Engine operation 정보를 받지 못했습니다.");
  }

  const deadline = Date.now() + config.computeOperationTimeoutMs;
  let current = operation;
  while (current.status !== "DONE") {
    if (Date.now() >= deadline) {
      throw new ComputeOperationError("Compute Engine operation 대기 시간이 초과되었습니다.", "OPERATION_TIMEOUT");
    }
    await sleep(Math.min(config.computeOperationPollIntervalMs, Math.max(0, deadline - Date.now())));
    current = await requestCompute<ComputeOperationResponse>(operationUrl(operationName), "GET", config.computeOperationTimeoutMs);
  }

  const failure = current.error?.errors?.[0];
  if (failure) {
    throw new ComputeOperationError(failure.message || "Compute Engine operation이 실패했습니다.", failure.code);
  }
}

async function requestAndWait(path: string): Promise<void> {
  const config = getConfig();
  const operation = await requestCompute<ComputeOperationResponse>(
    `${computeBaseUrl()}${path}`,
    "POST",
    config.computeOperationTimeoutMs,
  );
  await waitForOperation(operation);
}

export async function startVm(): Promise<void> {
  const config = getConfig();
  if (config.mock) return mockCompute.startVm();
  await requestAndWait("/start");
}

export async function stopVm(): Promise<void> {
  const config = getConfig();
  if (config.mock) return mockCompute.stopVm();
  await requestAndWait("/stop");
}

export async function setVmMachineType(machineType: string): Promise<void> {
  const config = getConfig();
  if (config.mock) return mockCompute.setMachineType(machineType);
  const client = await getAuthClient().getClient();
  const response = await client.request<ComputeOperationResponse>({
    url: `${computeBaseUrl()}/setMachineType`,
    method: "POST",
    data: {
      machineType: `zones/${config.gcpZone}/machineTypes/${machineType}`,
    },
    timeout: config.computeOperationTimeoutMs,
  });
  await waitForOperation(response.data);
}

export async function getVmExternalIp(): Promise<string | null> {
  return (await getVmStatus()).externalIp;
}

export async function getVmInternalIp(): Promise<string | null> {
  return (await getVmStatus()).internalIp;
}
