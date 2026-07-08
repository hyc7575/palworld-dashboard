import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/server";

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, message: string, code?: string): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        message,
        code,
      },
    },
    { status },
  );
}

export async function handleApi<T>(operation: string, fn: () => Promise<T>): Promise<NextResponse<ApiResponse<T>>> {
  try {
    return ok(await fn());
  } catch (error) {
    console.error(`[${operation}]`, error);
    return fail(500, "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.", operation);
  }
}
