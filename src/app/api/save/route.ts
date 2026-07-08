import { requireAuthenticated } from "@/lib/auth/session";
import { saveServer } from "@/lib/control/actions";
import { fail, ok } from "@/lib/http/api";
import { PalworldRequestTimeoutError } from "@/lib/palworld/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const unauthorized = await requireAuthenticated();
  if (unauthorized) return unauthorized;

  try {
    return ok(await saveServer());
  } catch (error) {
    console.error("[POST /api/save]", error);
    if (error instanceof PalworldRequestTimeoutError) {
      return fail(504, "저장 요청 시간이 초과되었습니다. 서버 로그를 확인해주세요.", "SAVE_TIMEOUT");
    }
    return fail(500, "서버 저장 요청에 실패했습니다. 서버 로그를 확인해주세요.", "SAVE_FAILED");
  }
}
