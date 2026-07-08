import type { ServerStatusResponse } from "@/types/server";

export function DangerZone({
  loading,
  onForceStop,
  status,
}: {
  loading: boolean;
  onForceStop: () => void;
  status: ServerStatusResponse | null;
}) {
  const canForceStop =
    status?.vmStatus === "RUNNING" && (status.serverStatus === "BOOTING_SERVER" || status.serverStatus === "UNKNOWN");

  function confirmAndStop() {
    const confirmed = window.confirm(
      "Palworld 서버 저장 없이 VM을 중지합니다. 정식 서버가 아직 부팅되지 않았거나 API가 응답하지 않을 때만 사용하세요. 계속할까요?",
    );
    if (confirmed) onForceStop();
  }

  if (!canForceStop) return null;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>위험 작업</h2>
      </div>
      <div className="panel-body">
        <p className="danger-copy">
          Palworld 서버 저장 없이 VM을 중지합니다. 정식 서버가 아직 부팅되지 않았거나 API가 응답하지 않을 때만
          사용하세요.
        </p>
        <button className="button-danger" disabled={loading} onClick={confirmAndStop} type="button">
          {loading ? "중지 중" : "강제 VM 중지"}
        </button>
      </div>
    </section>
  );
}
