type LogoProps = {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { box: 34, text: "text-[15px]", sub: "text-[9px]" },
  md: { box: 42, text: "text-lg", sub: "text-[10px]" },
  lg: { box: 52, text: "text-xl", sub: "text-[11px]" },
};

/** Modern mark: dark tile + three score arcs (SEO / AEO / GEO) */
export function Logo({
  className = "",
  showWordmark = true,
  size = "md",
}: LogoProps) {
  const s = sizes[size];
  const uid = "sga";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={s.box}
        height={s.box}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <linearGradient
            id={`${uid}-tile`}
            x1="6"
            y1="2"
            x2="44"
            y2="46"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#0F172A" />
            <stop offset="1" stopColor="#134E4A" />
          </linearGradient>
          <linearGradient
            id={`${uid}-glow`}
            x1="24"
            y1="10"
            x2="24"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#5EEAD4" stopOpacity="0.35" />
            <stop offset="1" stopColor="#5EEAD4" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* tile */}
        <rect width="48" height="48" rx="14" fill={`url(#${uid}-tile)`} />
        <rect
          x="1"
          y="1"
          width="46"
          height="46"
          rx="13"
          stroke="#2DD4BF"
          strokeOpacity="0.18"
        />
        <ellipse
          cx="24"
          cy="18"
          rx="14"
          ry="10"
          fill={`url(#${uid}-glow)`}
        />

        {/* outer arc SEO */}
        <path
          d="M11.5 29.5c2.8-7.2 9-12 12.5-12s9.7 4.8 12.5 12"
          stroke="#2DD4BF"
          strokeWidth="2.75"
          strokeLinecap="round"
          fill="none"
        />
        {/* mid arc AEO */}
        <path
          d="M15.2 28.2c2-5.1 6.2-8.5 8.8-8.5s6.8 3.4 8.8 8.5"
          stroke="#67E8F9"
          strokeWidth="2.75"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
        {/* inner arc GEO */}
        <path
          d="M18.8 27c1.3-3.2 3.7-5.2 5.2-5.2s3.9 2 5.2 5.2"
          stroke="#A7F3D0"
          strokeWidth="2.75"
          strokeLinecap="round"
          fill="none"
        />

        {/* hub */}
        <circle cx="24" cy="30.5" r="3" fill="#F0FDFA" />
        <circle cx="24" cy="30.5" r="1.35" fill="#0D9488" />

        {/* spark ticks */}
        <circle cx="14" cy="15" r="1.1" fill="#5EEAD4" opacity="0.7" />
        <circle cx="34" cy="14" r="1.1" fill="#67E8F9" opacity="0.7" />
      </svg>

      {showWordmark ? (
        <div className="flex flex-col leading-none">
          <span
            className={`font-semibold tracking-tight text-slate-900 ${s.text}`}
            style={{
              fontFamily: "var(--font-display), var(--font-sans), system-ui",
            }}
          >
            SGA
            <span className="font-medium text-slate-500"> Analytics</span>
          </span>
          <span
            className={`mt-1.5 font-semibold uppercase tracking-[0.2em] text-teal-700/80 ${s.sub}`}
          >
            SEO · AEO · GEO
          </span>
        </div>
      ) : null}
    </div>
  );
}
