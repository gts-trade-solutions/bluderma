import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Local inline-SVG icon set (lucide-compatible API: size & colour via
 * className, using currentColor). Keeps the project dependency-free.
 */
function Svg({
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function Sparkles(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
      <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
    </Svg>
  );
}

export function Camera(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2Z" />
      <circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

export function ShieldCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function ScanFace(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
    </Svg>
  );
}

export function BarChart3(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 3v18h18" />
      <path d="M8 17v-5M13 17V8M18 17v-8" />
    </Svg>
  );
}

export function Stethoscope(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 3v6a4 4 0 0 0 8 0V3" />
      <path d="M6 3H4m10 0h2M10 17a4 4 0 0 0 8 0v-2" />
      <circle cx="19" cy="13" r="2" />
    </Svg>
  );
}

export function Wand2(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 19 9-9M14 6l1 1M18 4l.5 1.5L20 6l-1.5.5L18 8l-.5-1.5L16 6l1.5-.5L18 4Z" />
      <path d="m14 8 2 2-9 9-2-2 9-9Z" />
    </Svg>
  );
}

export function LineChart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 3v18h18" />
      <path d="m6 15 4-5 3 3 5-7" />
    </Svg>
  );
}

export function Lock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function Clock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function Smartphone(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M11 18h2" />
    </Svg>
  );
}

export function ChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 8 7 7 7-7" />
    </Svg>
  );
}

export function Star(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.4l-5.8 3-1.1-6.47L.4 9.35l6.5-.95L12 2.5Z" />
    </Svg>
  );
}

export function Video(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="m22 8-6 4 6 4V8Z" />
    </Svg>
  );
}

/** Home visits — the clinician travels to the patient. */
export function House(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M10 21v-6h4v6" />
    </Svg>
  );
}

export function Building2(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 21V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v17M14 9h4a1 1 0 0 1 1 1v11M3 21h18" />
      <path d="M9 7h1M9 11h1M9 15h1" />
    </Svg>
  );
}

export function Globe(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </Svg>
  );
}

export function CheckCircle2(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function MapPin(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function CalendarClock(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6M7 2v4M17 2v4M3 10h18" />
      <circle cx="17.5" cy="16.5" r="4" />
      <path d="M17.5 15v1.6l1 .9" />
    </Svg>
  );
}

export function CalendarDays(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M7 2v4M17 2v4" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </Svg>
  );
}

export function X(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}
