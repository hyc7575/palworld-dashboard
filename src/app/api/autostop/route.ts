import { NextRequest } from "next/server";
import { requireAuthenticated } from "@/lib/auth/session";
import { runAutostopCheck, verifyAutostopRequest } from "@/lib/control/autostop";
import { setAutoStopEnabled } from "@/lib/control/actions";
import { fail, handleApi } from "@/lib/http/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await verifyAutostopRequest(request))) {
    return fail(401, "자동 종료 호출 인증에 실패했습니다.", "AUTOSTOP_UNAUTHORIZED");
  }

  return handleApi("POST /api/autostop", runAutostopCheck);
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAuthenticated();
  if (unauthorized) return unauthorized;

  return handleApi("PATCH /api/autostop", async () => {
    const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
    if (typeof body.enabled !== "boolean") {
      throw new Error("enabled 값이 필요합니다.");
    }
    return setAutoStopEnabled(body.enabled);
  });
}
