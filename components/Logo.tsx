type LogoProps = {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { box: 32, text: "text-base" },
  md: { box: 40, text: "text-lg" },
  lg: { box: 48, text: "text-xl" },
};

export function Logo({
  className = "",
  showWordmark = true,
  size = "md",
}: LogoProps) {
  const s = sizes[size];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={s.box}
        height={s.box}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="shrink-0 drop-shadow-sm"
      >
        <defs>
          <linearGradient id="sga-bg" x1="8" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4F46E5" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id="sga-ring" x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C7D2FE" />
            <stop offset="1" stopColor="#FFFFFF" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#sga-bg)" />
        {/* triple score arcs */}
        <path
          d="M14 30a12 12 0 0 1 20 0"
          stroke="url(#sga-ring)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path
          d="M17 28a8.5 8.5 0 0 1 14 0"
          stroke="url(#sga-ring)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M20 26a5 5 0 0 1 8 0"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* center node */}
        <circle cx="24" cy="31" r="2.25" fill="#FFFFFF" />
        {/* small data ticks */}
        <path d="M12 16h5M31 14h5" stroke="#A5B4FC" strokeWidth="1.75" strokeLinecap="round" />
      </svg>

      {showWordmark ? (
        <div className="flex flex-col leading-none">
          <span
            className={`font-semibold tracking-tight text-zinc-900 ${s.text}`}
            style={{ fontFamily: "var(--font-display), var(--font-sans), system-ui" }}
          >
            SGA Analytics
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-indigo-600/80">
            SEO · AEO · GEO
          </span>
        </div>
      ) : null}
    </div>
  );
}
