import { redirect } from "next/navigation";
import { isDemo } from "@/lib/db";
import { AuthCallback } from "@/components/AuthCallback";

export default function Callback() {
  if (isDemo()) redirect("/");
  return <AuthCallback supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!} anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!} />;
}
