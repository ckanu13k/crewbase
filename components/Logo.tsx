export function Logo({ size = 32, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="cp-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#cp-g)" />
        <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-[17px] font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Crew<span className={light ? "text-blue-200" : "text-brand"}>Pass</span>
      </span>
    </span>
  );
}
