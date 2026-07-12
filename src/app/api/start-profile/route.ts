import { NextRequest } from "next/server";
import { requireAuthenticated } from "@/lib/auth/session";
import { startServerWithProfile } from "@/lib/control/actions";
import { isMachineProfile } from "@/lib/control/profiles";
import { fail, handleApi } from "@/lib/http/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuthenticated();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as { profile?: unknown };
  const profile = body.profile;
  if (!isMachineProfile(profile)) {
    return fail(400, "프로필은 low 또는 normal만 선택할 수 있습니다.", "INVALID_MACHINE_PROFILE");
  }

  return handleApi("POST /api/start-profile", () => startServerWithProfile(profile));
}
