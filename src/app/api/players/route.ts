import { requireAuthenticated } from "@/lib/auth/session";
import { getVmStatus } from "@/lib/gcp/compute";
import { fail, ok } from "@/lib/http/api";
import { getPlayers } from "@/lib/palworld/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unavailableMessage = "팰월드 서버 API가 아직 응답하지 않습니다.";

function unavailable() {
  return Response.json({
    ok: false,
    players: [],
    message: unavailableMessage,
  });
}

function isPalworldUnavailableError(error: unknown, seen = new Set<unknown>()): boolean {
  if (error === null || (typeof error !== "object" && typeof error !== "string") || seen.has(error)) {
    return false;
  }
  seen.add(error);

  if (typeof error === "string") {
    return /abort|timeout|timed out|fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(error);
  }

  const details = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    cause?: unknown;
  };
  const text = [details.name, details.message, details.code]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return (
    /AbortError|TimeoutError|abort|timeout|timed out|fetch failed|ECONNREFUSED|ETIMEDOUT/i.test(text) ||
    isPalworldUnavailableError(details.cause, seen)
  );
}

export async function GET() {
  const unauthorized = await requireAuthenticated();
  if (unauthorized) return unauthorized;

  try {
    const vm = await getVmStatus();
    if (vm.status !== "RUNNING") {
      return unavailable();
    }

    return ok(await getPlayers());
  } catch (error) {
    if (isPalworldUnavailableError(error)) {
      console.warn("[GET /api/players] Palworld API is not ready");
      return unavailable();
    }

    console.error("[GET /api/players]", error);
    return fail(500, "접속자 목록을 불러오지 못했습니다.", "PLAYERS_REQUEST_FAILED");
  }
}
