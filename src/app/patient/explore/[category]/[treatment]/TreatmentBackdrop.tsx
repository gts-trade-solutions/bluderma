/**
 * The neon-corridor ground behind the two candidate treatment pages, after
 * the client's reference: a dark hall with blue light down one wall and
 * red down the other.
 *
 * Built, not photographed. Each wall is a run of actual tubes — a thin
 * bright core with its glow carried by a box-shadow — receding the way the
 * corridor does: tallest and brightest at the page edge, shorter, dimmer
 * and closer together toward the middle. Under them, wide blurred washes
 * give each wall its colour, and a violet floor-glow closes the bottom.
 *
 * The layer is fixed to the viewport, so the corridor is present on every
 * screenful of a long page rather than only at the top.
 *
 * Readability stays the constraint. The tubes live in the outer ~14% of the
 * viewport where only padding lives, they fade before the bottom of the
 * screen, the reading column keeps the plain navy base — and on phones,
 * where there is no spare edge, the tubes drop out entirely and only the
 * washes remain. Decoration only: hidden from the accessibility tree, no
 * pointer events, z-index below the content.
 */

interface Tube {
  /** Offset within the wall band, as a percentage of the band's width. */
  x: string;
  top: string;
  height: string;
  opacity: number;
  /** Core colour; also the glow, via box-shadow. */
  color: string;
}

const LEFT_WALL: Tube[] = [
  { x: "4%", top: "3rem", height: "34rem", opacity: 0.6, color: "#59b0ff" },
  { x: "22%", top: "5rem", height: "30rem", opacity: 0.5, color: "#7c9eff" },
  { x: "40%", top: "7rem", height: "26rem", opacity: 0.4, color: "#8b5cf6" },
  { x: "56%", top: "8rem", height: "22rem", opacity: 0.32, color: "#a78bfa" },
  { x: "70%", top: "9rem", height: "18rem", opacity: 0.24, color: "#c084fc" },
  { x: "82%", top: "10rem", height: "14rem", opacity: 0.16, color: "#c084fc" },
];

const RIGHT_WALL: Tube[] = [
  { x: "4%", top: "10rem", height: "14rem", opacity: 0.16, color: "#f0abfc" },
  { x: "16%", top: "9rem", height: "18rem", opacity: 0.24, color: "#f472b6" },
  { x: "30%", top: "8rem", height: "22rem", opacity: 0.34, color: "#fb7185" },
  { x: "46%", top: "7rem", height: "26rem", opacity: 0.44, color: "#f43f5e" },
  { x: "64%", top: "5rem", height: "30rem", opacity: 0.54, color: "#fb7185" },
  { x: "84%", top: "3rem", height: "34rem", opacity: 0.62, color: "#f43f5e" },
];

function Wall({ tubes, side }: { tubes: Tube[]; side: "left" | "right" }) {
  return (
    <div
      className={`absolute inset-y-0 hidden w-[14%] max-w-[13rem] md:block ${
        side === "left" ? "left-0" : "right-0"
      } [mask-image:linear-gradient(to_bottom,black_55%,transparent_92%)]`}
    >
      {tubes.map((t) => (
        <span
          key={`${t.x}-${t.color}`}
          className="absolute w-[3px] rounded-full"
          style={{
            [side]: t.x,
            top: t.top,
            height: t.height,
            opacity: t.opacity,
            background: `linear-gradient(to bottom, transparent, ${t.color} 10%, ${t.color} 88%, transparent)`,
            boxShadow: `0 0 22px 5px ${t.color}59, 0 0 70px 18px ${t.color}26`,
          }}
        />
      ))}
    </div>
  );
}

export default function TreatmentBackdrop() {
  return (
    // Fixed, not absolute: the scene is pinned to the viewport, so every
    // screenful of the page sits in the same lit corridor instead of the
    // effect living only at the top and scrolling away. Opaque chrome —
    // navbar, footer, the pinned bar — still covers it.
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* The washes each wall throws into the room. */}
      <div className="absolute -left-40 top-[-8rem] h-[50rem] w-[50rem] rounded-full bg-brand-500/[0.3] blur-[140px]" />
      <div className="absolute -right-40 top-[4rem] h-[52rem] w-[52rem] rounded-full bg-rose-500/[0.26] blur-[150px]" />
      <div className="absolute bottom-[-16rem] left-1/2 h-[42rem] w-[72rem] -translate-x-1/2 rounded-full bg-violet-600/[0.16] blur-[170px]" />

      {/* The tubes. */}
      <Wall tubes={LEFT_WALL} side="left" />
      <Wall tubes={RIGHT_WALL} side="right" />

      {/* The lit floor closing the scene. */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-violet-500/[0.08] to-transparent" />
    </div>
  );
}
