import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { getConfig } from "@/lib/config/env";
import { fail } from "@/lib/http/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { password?: string };

    if (!body.password || body.password !== getConfig().controlPanelPassword) {
      return fail(401, "비밀번호가 올바르지 않습니다.", "INVALID_PASSWORD");
    }

    const response = NextResponse.json({ ok: true, data: { ok: true } });
    setSessionCookie(response);
    return response;
  } catch (error) {
    console.error("[POST /api/login]", error);
    const message = error instanceof Error ? error.message : "로그인 처리 중 오류가 발생했습니다.";
    return fail(500, message, "LOGIN_FAILED");
  }
}
