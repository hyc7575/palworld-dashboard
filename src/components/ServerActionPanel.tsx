import type { MachineProfile, ServerStatusResponse } from "@/types/server";

type ActionName = "profile" | "save" | "shutdown" | "force-stop" | "autostop" | "announce";

export function ServerActionPanel({
  status,
  loadingAction,
  onSelectProfile,
  onSave,
  onShutdown,
  onRefresh,
}: {
  status: ServerStatusResponse | null;
  loadingAction: ActionName | null;
  onSelectProfile: (profile: MachineProfile) => void;
  onSave: () => void;
  onShutdown: () => void;
  onRefresh: () => void;
}) {
  const busy = loadingAction !== null;
  const vmStatus = status?.vmStatus;
  const serverStatus = status?.serverStatus;
  const canSelectProfile = vmStatus === "TERMINATED" || vmStatus === "RUNNING";
  const online = serverStatus === "ONLINE";
  const isRunning = vmStatus === "RUNNING";
  const profiles: Array<{
    profile: MachineProfile;
    label: string;
    machineType: string;
    specs: string;
    description: string;
  }> = [
    {
      profile: "low",
      label: "저사양",
      machineType: status?.machineProfiles.low || "e2-highmem-2",
      specs: "2 vCPU / 16GB",
      description: "1~5명 권장",
    },
    {
      profile: "normal",
      label: "일반",
      machineType: status?.machineProfiles.normal || "e2-highmem-4",
      specs: "4 vCPU / 32GB",
      description: "다인원·무거운 월드 권장",
    },
  ];

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>액션</h2>
      </div>
      <div className="panel-body">
        <div className="profile-actions">
          {profiles.map((profile) => {
            const selected = isRunning && status?.currentProfile === profile.profile;
            const actionLabel = profile.profile === "normal" ? "일반사양" : "저사양";
            const buttonLabel = isRunning ? `${actionLabel} 재시작` : `${actionLabel} 시작`;
            return (
              <article className="profile-card" key={profile.profile}>
                <div>
                  <h3>{profile.label}</h3>
                  <p className="profile-machine-type">{profile.machineType}</p>
                  <p className="muted">{profile.specs}</p>
                  <p className="muted">{profile.description}</p>
                </div>
                <button
                  className="button-primary"
                  disabled={busy || !canSelectProfile || selected}
                  onClick={() => onSelectProfile(profile.profile)}
                  type="button"
                >
                  {loadingAction === "profile" ? "처리 중" : selected ? "현재 실행중" : buttonLabel}
                </button>
              </article>
            );
          })}
        </div>
        <div className="actions">
          <button disabled={busy || !online} onClick={onSave} type="button">
            {loadingAction === "save" ? "저장 중" : "서버 저장"}
          </button>
          <button disabled={busy || !online} onClick={onShutdown} type="button">
            {loadingAction === "shutdown" ? "종료 중" : "서버 종료"}
          </button>
          <button onClick={onRefresh} type="button">
            상태 새로고침
          </button>
        </div>
      </div>
    </section>
  );
}
