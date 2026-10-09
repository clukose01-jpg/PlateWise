// Small drawings used around the app. Colors come from the theme, so they work in dark mode too.

export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="var(--accent)" />
        <circle cx="16" cy="16" r="11" fill="var(--card)" />
        <path d="M11 21c0-6 3.5-10 10-10 0 6.5-4 10-10 10Z" fill="var(--green)" />
        <path d="M11 21l6.5-6.5" stroke="var(--card)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="wordmark">PlateWise</span>
    </span>
  );
}

export function FridgeDrawing() {
  return (
    <svg className="drawing" viewBox="0 0 120 96" width="120" height="96" aria-hidden="true">
      <rect x="30" y="4" width="60" height="88" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="3" />
      <line x1="30" y1="34" x2="90" y2="34" stroke="var(--accent)" strokeWidth="3" />
      <rect x="78" y="14" width="4" height="12" rx="2" fill="var(--accent)" />
      <rect x="78" y="42" width="4" height="18" rx="2" fill="var(--accent)" />
      <circle cx="46" cy="70" r="7" fill="var(--tomato)" />
      <rect x="57" y="62" width="9" height="16" rx="3" fill="var(--green)" />
      <ellipse cx="45" cy="52" rx="7" ry="5" fill="var(--card)" stroke="var(--muted)" strokeWidth="1.5" />
    </svg>
  );
}

export function PotDrawing() {
  return (
    <svg className="drawing pot" viewBox="0 0 120 100" width="120" height="100" aria-hidden="true">
      <path className="steam s1" d="M44 34c-6-7 6-11 0-18" />
      <path className="steam s2" d="M60 32c-6-7 6-11 0-18" />
      <path className="steam s3" d="M76 34c-6-7 6-11 0-18" />
      <rect x="22" y="44" width="76" height="10" rx="5" fill="var(--green)" />
      <rect x="54" y="38" width="12" height="7" rx="3" fill="var(--green)" />
      <path d="M28 54h64v22a14 14 0 0 1-14 14H42a14 14 0 0 1-14-14Z" fill="var(--tomato)" />
      <rect x="14" y="58" width="14" height="6" rx="3" fill="var(--tomato)" />
      <rect x="92" y="58" width="14" height="6" rx="3" fill="var(--tomato)" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M10 2.5v10M6.5 6 10 2.5 13.5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 15 9h-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      style={down ? { transform: "rotate(180deg)" } : undefined}
    >
      <path
        d="M6 9v8H3.5A1.5 1.5 0 0 1 2 15.5v-5A1.5 1.5 0 0 1 3.5 9H6Zm0 0 3.2-6.2a1.6 1.6 0 0 1 3 .9L11.6 7H16a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 15 17H6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Icons for the bottom tab bar.
export function TabIcon({ name }: { name: "today" | "week" | "groceries" | "new" | "more" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {name === "today" && (
        <>
          <circle cx="12" cy="12" r="4" {...common} />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...common} />
        </>
      )}
      {name === "week" && (
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" {...common} />
          <path d="M3.5 10h17M8 3v4M16 3v4" {...common} />
          <path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17h2M11 17h2" {...common} />
        </>
      )}
      {name === "groceries" && (
        <>
          <path d="M3 4h2.2l2.2 11h10.4l2-8H6.3" {...common} />
          <circle cx="9" cy="19" r="1.4" {...common} />
          <circle cx="16.5" cy="19" r="1.4" {...common} />
        </>
      )}
      {name === "new" && (
        <>
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M12 8v8M8 12h8" {...common} />
        </>
      )}
      {name === "more" && (
        <>
          <circle cx="5.5" cy="12" r="1.3" fill="currentColor" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" />
          <circle cx="18.5" cy="12" r="1.3" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
