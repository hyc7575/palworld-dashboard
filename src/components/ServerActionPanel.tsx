import type { ServerStatusResponse } from "@/types/server";

type ActionName = "start" | "save" | "shutdown" | "force-stop" | "autostop";

export function ServerActionPanel({
  status,
  loadingAction,
  onStart,
  onSave,
  onShutdown,
  onRefresh,
}: {
  status: ServerStatusResponse | null;
  loadingAction: ActionName | null;
  onStart: () => void;
  onSave: () => void;
  onShutdown: () => void;
  onRefresh: () => void;
}) {
  const busy = loadingAction !== null;
  const serverStatus = status?.serverStatus;
  const transitioning = serverStatus === "STARTING_VM" || serverStatus === "BOOTING_SERVER" || serverStatus === "STOPPING";
  const online = serverStatus === "ONLINE";

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>액션</h2>
      </div>
      <div className="panel-body">
        <div className="actions">
          <button className="button-primary" disabled={busy || transitioning || online} onClick={onStart} type="button">
            {loadingAction === "start" ? "켜는 중" : "서버 켜기"}
          </button>
          <button disabled={busy || !online} onClick={onSave} type="button">
            {loadingAction === "save" ? "저장 중" : "서버 저장"}
          </button>
          <button disabled={busy || !online} onClick={onShutdown} type="button">
            {loadingAction === "shutdown" ? "종료 중" : "서버 종료"}
          </button>
          <button disabled={busy} onClick={onRefresh} type="button">
            상태 새로고침
          </button>
        </div>
      </div>
    </section>
  );
}
