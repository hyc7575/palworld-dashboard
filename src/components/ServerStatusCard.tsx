import type { ServerStatusResponse } from "@/types/server";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

function statusClass(status: string): string {
  if (status === "ONLINE" || status === "RUNNING") return "badge badge-online";
  if (status === "OFFLINE" || status === "TERMINATED") return "badge";
  if (status === "STOPPING" || status === "UNKNOWN") return "badge badge-danger";
  return "badge badge-warn";
}

export function ServerStatusCard({
  status,
  onRefresh,
}: {
  status: ServerStatusResponse | null;
  onRefresh: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>서버 상태</h2>
        <button onClick={onRefresh} type="button">
          새로고침
        </button>
      </div>
      <div className="panel-body">
        <div className="metrics">
          <div className="metric">
            <span className="metric-label">VM 상태</span>
            <span className={statusClass(status?.vmStatus || "UNKNOWN")}>{status?.vmStatus || "확인 중"}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Palworld 상태</span>
            <span className={statusClass(status?.serverStatus || "UNKNOWN")}>
              {status?.serverStatus || "확인 중"}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">서버 사양</span>
            <span className="metric-value">
              {status?.currentProfile === "low" ? "저사양" : status?.currentProfile === "normal" ? "일반" : "-"}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">접속 인원</span>
            <span className="metric-value">
              {status?.currentPlayers !== null && status?.currentPlayers !== undefined
                ? `${status.currentPlayers} / ${status.maxPlayers ?? "-"}`
                : "-"}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">서버 FPS</span>
            <span className="metric-value">{status?.serverFps ?? "-"}</span>
          </div>
          <div className="metric">
            <span className="metric-label">접속 주소</span>
            <span className="metric-value">{status?.connectAddress || "-"}</span>
          </div>
          <div className="metric">
            <span className="metric-label">업타임</span>
            <span className="metric-value">{formatDuration(status?.uptime ?? null)}</span>
          </div>
        </div>
        <p className="muted">{status?.message || "상태를 불러오는 중입니다."}</p>
      </div>
    </section>
  );
}
