import type { PlayerSummary } from "@/types/server";

function formatPing(ping: number | null): string {
  if (ping === null) return "-";
  return `${Math.round(ping)}ms`;
}

export function PlayerList({ players }: { players: PlayerSummary[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>접속자</h2>
        <span className="badge">{players.length}명</span>
      </div>
      <div className="panel-body">
        {players.length === 0 ? (
          <p className="muted">접속자가 없습니다.</p>
        ) : (
          <div>
            <div className="player-row muted">
              <span>닉네임</span>
              <span>레벨</span>
              <span>Ping</span>
            </div>
            {players.map((player) => (
              <div className="player-row" key={`${player.name}-${player.level}-${player.ping}`}>
                <strong>{player.name}</strong>
                <span>{player.level ?? "-"}</span>
                <span>{formatPing(player.ping)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
