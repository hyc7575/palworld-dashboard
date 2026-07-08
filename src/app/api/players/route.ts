import { requireAuthenticated } from "@/lib/auth/session";
import { getVmStatus } from "@/lib/gcp/compute";
import { fail, handleApi } from "@/lib/http/api";
import { getPlayers } from "@/lib/palworld/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAuthenticated();
  if (unauthorized) return unauthorized;

  return handleApi("GET /api/players", async () => {
    const vm = await getVmStatus();
    if (vm.status !== "RUNNING") {
      throw new Error("VM이 실행 중일 때만 접속자 목록을 볼 수 있습니다.");
    }
    return getPlayers();
  }).catch(() => fail(409, "VM이 실행 중일 때만 접속자 목록을 볼 수 있습니다.", "VM_NOT_RUNNING"));
}
