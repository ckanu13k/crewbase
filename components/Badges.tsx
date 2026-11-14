import { BadgeCheck, Camera, Clock, PenLine, ShieldAlert, Infinity as InfinityIcon, CircleCheck } from "lucide-react";
import { t } from "@/lib/i18n";
import { credentialStatus } from "@/lib/matching";
import type { Credential, Lang } from "@/lib/types";

export function VerificationBadge({ c, lang }: { c: Credential; lang: Lang }) {
  if (c.needsReview)
    return <span className="pill bg-amber-50 text-amber-700 ring-1 ring-amber-200"><Clock size={12} />{t(lang, "inReview")}</span>;
  if (c.verification === "verified")
    return <span className="pill bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"><BadgeCheck size={12} />{t(lang, "verified")}</span>;
  if (c.verification === "document")
    return <span className="pill bg-blue-50 text-blue-700 ring-1 ring-blue-200"><Camera size={12} />{t(lang, "document")}</span>;
  return <span className="pill bg-slate-100 text-slate-600 ring-1 ring-slate-200"><PenLine size={12} />{t(lang, "self")}</span>;
}

export function ExpiryBadge({ c, lang, today }: { c: Credential; lang: Lang; today: string }) {
  const s = credentialStatus(c, today);
  if (s === "no_expiry") return <span className="pill bg-slate-50 text-slate-500 ring-1 ring-slate-200"><InfinityIcon size={12} />{t(lang, "noExpiry")}</span>;
  if (s === "expired") return <span className="pill bg-red-50 text-red-700 ring-1 ring-red-200"><ShieldAlert size={12} />{t(lang, "expired")} · {c.expiresOn}</span>;
  if (s === "expiring") return <span className="pill bg-amber-50 text-amber-700 ring-1 ring-amber-200"><Clock size={12} />{t(lang, "expiringSoon")} · {c.expiresOn}</span>;
  return <span className="pill bg-white text-slate-600 ring-1 ring-slate-200"><CircleCheck size={12} className="text-emerald-600" />{t(lang, "valid")} · {c.expiresOn}</span>;
}

/** Match score as a small ring. */
export function ScorePill({ score, eligible }: { score: number; eligible: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = eligible ? (pct >= 80 ? "#2563eb" : "#60a5fa") : "#94a3b8";
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center" title={`Match score ${score}`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} />
      </svg>
      <span className={`text-[13px] font-bold ${eligible ? "text-ink" : "text-slate-500"}`}>{score}</span>
    </span>
  );
}
