import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { isAuthenticated } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return <Dashboard />;
}
