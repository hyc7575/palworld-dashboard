import type { ServerStatusResponse } from "@/types/server";

function formatRemaining(seconds: number | null): string {
  if (seconds === null) return "대기 중";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}분 ${rest}초`;
}

export function AutoStopStatus({
  status,
  loading,
  onToggle,
}: {
  status: ServerStatusResponse | null;
  loading: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const autoStop = status?.autoStop;
  const enabled = autoStop?.enabled ?? false;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>자동 종료</h2>
        <span className={enabled ? "badge badge-online" : "badge"}>{enabled ? "켜짐" : "꺼짐"}</span>
      </div>
      <div className="panel-body">
        <p className="muted">
          {autoStop?.emptySince
            ? `0명 상태가 지속 중입니다. 남은 시간: ${formatRemaining(autoStop.remainingSeconds)}`
            : "접속자가 없을 때 종료 타이머를 시작합니다."}
        </p>
        <p className="muted">
          보호 시간 {autoStop?.graceMinutes ?? 20}분, 0명 기준 {autoStop?.shutdownAfterMinutes ?? 30}분
        </p>
        <button disabled={loading || !status} onClick={() => onToggle(!enabled)} type="button">
          {loading ? "변경 중" : enabled ? "자동 종료 끄기" : "자동 종료 켜기"}
        </button>
      </div>
    </section>
  );
}
