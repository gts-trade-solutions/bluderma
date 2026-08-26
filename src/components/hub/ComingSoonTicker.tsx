import { Clock, Sparkles } from "lucide-react";

/**
 * The running banner (C-3). Marked COMING SOON because the promise isn't
 * live yet — the strip announces it without letting anyone try to book it.
 *
 * The message is duplicated so the track can loop seamlessly at -50%, and
 * the animation is dropped for anyone who asks for reduced motion.
 */
const MESSAGE =
  "Consult 2000-mile skincare specialists within 20 minutes";

export default function ComingSoonTicker() {
  const items = Array.from({ length: 4 });

  return (
    <div className="relative overflow-hidden border-y border-brand-800/40 bg-surface py-2.5">
      <div className="flex w-max animate-marquee items-center gap-10 motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center gap-10" aria-hidden={copy === 1}>
            {items.map((_, i) => (
              <span
                key={i}
                className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[13px] font-medium text-white/85"
              >
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">
                  <Clock className="h-3 w-3" /> Coming soon
                </span>
                {MESSAGE}
                <Sparkles className="h-3.5 w-3.5 text-teal-300/70" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
