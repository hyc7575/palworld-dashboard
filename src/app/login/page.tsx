import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isAuthenticated } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/");
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <h1>Palworld 제어판</h1>
        <p>공유 비밀번호로 로그인하세요.</p>
        <LoginForm />
      </section>
    </main>
  );
}
