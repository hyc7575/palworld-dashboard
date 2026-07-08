import { requireAuthenticated } from "@/lib/auth/session";
import { getCurrentStatus } from "@/lib/control/status";
import { handleApi } from "@/lib/http/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAuthenticated();
  if (unauthorized) return unauthorized;
  return handleApi("GET /api/status", getCurrentStatus);
}
