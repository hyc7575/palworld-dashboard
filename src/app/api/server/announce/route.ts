import { NextRequest } from "next/server";
import { requireAuthenticated } from "@/lib/auth/session";
import { sendServerAnnouncement } from "@/lib/control/announcement";
import { handleApi } from "@/lib/http/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuthenticated();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as { message?: unknown };
  return handleApi("POST /api/server/announce", () => sendServerAnnouncement(body.message));
}
