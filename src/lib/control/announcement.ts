import { getVmStatus } from "@/lib/gcp/compute";
import { announce, PalworldRequestTimeoutError } from "@/lib/palworld/client";
import { ControlOperationError } from "@/lib/control/errors";
import { ANNOUNCEMENT_MAX_LENGTH } from "@/lib/announcement";

export { ANNOUNCEMENT_MAX_LENGTH } from "@/lib/announcement";

export function normalizeAnnouncement(message: unknown): string {
  if (typeof message !== "string") {
    throw new ControlOperationError("공지 내용을 입력해주세요.", "ANNOUNCEMENT_EMPTY", 400);
  }

  const normalized = message.trim();
  if (!normalized) {
    throw new ControlOperationError("공지 내용을 입력해주세요.", "ANNOUNCEMENT_EMPTY", 400);
  }
  if (normalized.length > ANNOUNCEMENT_MAX_LENGTH) {
    throw new ControlOperationError(
      `공지 내용은 ${ANNOUNCEMENT_MAX_LENGTH}자 이하로 입력해주세요.`,
      "ANNOUNCEMENT_TOO_LONG",
      400,
    );
  }
  return normalized;
}

export async function sendServerAnnouncement(message: unknown): Promise<{ message: string }> {
  const normalized = normalizeAnnouncement(message);
  const vm = await getVmStatus();
  if (vm.status !== "RUNNING") {
    throw new ControlOperationError("서버가 실행 중일 때만 공지를 전송할 수 있습니다.", "SERVER_OFFLINE", 409);
  }

  try {
    await announce(normalized);
  } catch (error) {
    if (error instanceof PalworldRequestTimeoutError) {
      throw new ControlOperationError("공지 전송 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.", "ANNOUNCEMENT_TIMEOUT", 504);
    }
    throw new ControlOperationError("Palworld 서버에 공지를 전송하지 못했습니다. 서버가 준비된 후 다시 시도해주세요.", "ANNOUNCEMENT_FAILED", 502);
  }

  return { message: normalized };
}
