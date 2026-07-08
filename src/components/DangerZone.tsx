export function DangerZone({ loading, onForceStop }: { loading: boolean; onForceStop: () => void }) {
  function confirmAndStop() {
    const confirmed = window.confirm("강제 종료는 저장 없이 VM을 중지할 수 있습니다. 계속할까요?");
    if (confirmed) onForceStop();
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>위험 작업</h2>
      </div>
      <div className="panel-body">
        <p className="danger-copy">강제 종료는 저장 단계가 생략될 수 있습니다.</p>
        <button className="button-danger" disabled={loading} onClick={confirmAndStop} type="button">
          {loading ? "중지 중" : "강제 VM 중지"}
        </button>
      </div>
    </section>
  );
}
