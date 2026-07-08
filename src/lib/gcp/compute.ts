import { GoogleAuth } from "google-auth-library";
import { getConfig } from "@/lib/config/env";
import { mockCompute } from "@/lib/mock/mockClients";
import type { VmStatus, VmSummary } from "@/types/server";

type ComputeInstanceResponse = {
  status?: string;
  networkInterfaces?: Array<{
    networkIP?: string;
    accessConfigs?: Array<{
      natIP?: string;
    }>;
  }>;
};

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

async function requestCompute<T>(url: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const client = await getAuthClient().getClient();
  const response = await client.request<T>({
    url,
    method,
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
  };
}

export async function startVm(): Promise<void> {
  if (getConfig().mock) return mockCompute.startVm();
  await requestCompute(`${computeBaseUrl()}/start`, "POST");
}

export async function stopVm(): Promise<void> {
  if (getConfig().mock) return mockCompute.stopVm();
  await requestCompute(`${computeBaseUrl()}/stop`, "POST");
}

export async function getVmExternalIp(): Promise<string | null> {
  return (await getVmStatus()).externalIp;
}

export async function getVmInternalIp(): Promise<string | null> {
  return (await getVmStatus()).internalIp;
}
