import { requireAuthenticated } from "@/lib/auth/session";
import { saveServer } from "@/lib/control/actions";
import { handleApi } from "@/lib/http/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const unauthorized = await requireAuthenticated();
  if (unauthorized) return unauthorized;
  return handleApi("POST /api/save", saveServer);
}
