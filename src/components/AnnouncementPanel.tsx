"use client";

import { useState } from "react";
import { ANNOUNCEMENT_MAX_LENGTH } from "@/lib/announcement";

export function AnnouncementPanel({
  online,
  loading,
  onSend,
}: {
  online: boolean;
  loading: boolean;
  onSend: (message: string) => Promise<boolean>;
}) {
  const [message, setMessage] = useState("");
  const normalized = message.trim();
  const disabled = !online || loading || !normalized || normalized.length > ANNOUNCEMENT_MAX_LENGTH;

  async function submit() {
    if (disabled) return;
    if (await onSend(normalized)) setMessage("");
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>서버 공지</h2>
      </div>
      <div className="panel-body form-stack announcement-form">
        <label htmlFor="announcement-message">공지 내용</label>
        <textarea
          disabled={!online || loading}
          id="announcement-message"
          maxLength={ANNOUNCEMENT_MAX_LENGTH}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={online ? "게임 내 접속자에게 전할 공지를 입력하세요." : "서버가 실행 중일 때 공지를 전송할 수 있습니다."}
          value={message}
        />
        <div className="announcement-footer">
          <span className="muted">
            {message.length} / {ANNOUNCEMENT_MAX_LENGTH}
          </span>
          <button className="button-primary" disabled={disabled} onClick={() => void submit()} type="button">
            {loading ? "공지 전송 중" : "공지 전송"}
          </button>
        </div>
      </div>
    </section>
  );
}
