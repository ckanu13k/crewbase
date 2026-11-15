import { redirect } from "next/navigation";
import { isDemo } from "@/lib/db";
import { getLang } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { LoginForm } from "@/components/LoginForm";

export default async function Login({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  if (isDemo()) redirect("/");
  const sp = await searchParams;
  const lang = await getLang();
  return (
    <Shell lang={lang} back="/login">
      <LoginForm lang={lang} mode={sp.as === "employer" || sp.as === "provider" ? "email" : sp.as === "worker-email" ? "workerEmail" : "phone"} supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!} anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!} />
    </Shell>
  );
}
