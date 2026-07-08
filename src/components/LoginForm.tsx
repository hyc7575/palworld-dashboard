"use client";

import { FormEvent, useState } from "react";
import type { ApiResponse } from "@/types/server";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = (await response.json()) as ApiResponse<{ ok: true }>;

    if (!payload.ok) {
      setError(payload.error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <label>
        <span className="metric-label">비밀번호</span>
        <input
          autoComplete="current-password"
          autoFocus
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </label>
      {error ? <div className="error">{error}</div> : null}
      <button className="button-primary" disabled={loading || !password} type="submit">
        {loading ? "확인 중" : "로그인"}
      </button>
    </form>
  );
}
