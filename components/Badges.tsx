import { t } from "@/lib/i18n";
import { credentialStatus } from "@/lib/matching";
import type { Credential, Lang } from "@/lib/types";

export function VerificationBadge({ c, lang }: { c: Credential; lang: Lang }) {
  if (c.needsReview) return <span className="pill bg-amber-100 text-amber-800">{t(lang, "inReview")}</span>;
  const style = { verified: "bg-emerald-100 text-emerald-800", document: "bg-sky-100 text-sky-800", self: "bg-stone-200 text-stone-700" }[c.verification];
  const icon = { verified: "✔", document: "📷", self: "✎" }[c.verification];
  return (
    <span className={`pill ${style}`}>
      <span aria-hidden>{icon}</span>
      {t(lang, c.verification)}
    </span>
  );
}

export function ExpiryBadge({ c, lang, today }: { c: Credential; lang: Lang; today: string }) {
  const s = credentialStatus(c, today);
  if (s === "no_expiry") return <span className="pill bg-stone-100 text-stone-600">{t(lang, "noExpiry")}</span>;
  const style = { expired: "bg-red-100 text-red-800", expiring: "bg-amber-100 text-amber-800", valid: "bg-emerald-50 text-emerald-700" }[s];
  const label = { expired: t(lang, "expired"), expiring: t(lang, "expiringSoon"), valid: t(lang, "valid") }[s];
  return (
    <span className={`pill ${style}`}>
      {label} · {c.expiresOn}
    </span>
  );
}

export function ScorePill({ score, eligible }: { score: number; eligible: boolean }) {
  const style = eligible ? (score >= 80 ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800") : "bg-stone-200 text-stone-700";
  return <span className={`pill ${style}`}>{score}</span>;
}
