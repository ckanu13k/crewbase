import { redirect } from "next/navigation";
import { getLang, getSession } from "@/lib/session";
import { isDemo } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { ChatOnboarding } from "@/components/ChatOnboarding";

export default async function OnboardPage() {
  const lang = await getLang();
  // Live mode: workers confirm their phone with a one-time code first, so the profile is tied to it.
  if (!isDemo()) {
    const s = await getSession();
    if (!s?.workerId) redirect("/login");
  }
  return (
    <Shell lang={lang} back="/onboard">
      <ChatOnboarding lang={lang} smsNumber={process.env.NEXT_PUBLIC_SMS_NUMBER ?? null} voiceNumber={process.env.NEXT_PUBLIC_VOICE_NUMBER ?? null} />
    </Shell>
  );
}
