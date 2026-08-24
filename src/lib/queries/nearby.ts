/**
 * Putting the nearest clinic at the top of the list.
 *
 * ── Straight-line distance, and it says so ───────────────────────────────
 * The haversine formula gives the distance as the crow flies. That is not how
 * far somebody will drive, and in a city it can be badly out. It is used
 * anyway because it needs no routing service, no key and no request while a
 * visitor waits, and because ORDERING by it is almost always right even when
 * the number is not: the Anna Nagar clinic really is the closest one to Padi
 * whatever the traffic does.
 *
 * So the ordering is trusted and the figure is presented as approximate. A
 * precise-looking "4.2 km" that turns out to be an eleven-kilometre drive
 * costs more trust than "about 4 km away" ever will.
 *
 * ── No coordinates means no position, never position zero ────────────────
 * A clinic that has never been geocoded sorts to the END, not to the top. The
 * naive `distance ?? 0` puts unplaced clinics first, which is the worst
 * possible answer: the ones we know least about would lead every list.
 */

const EARTH_KM = 6371;

export interface Point {
  lat: number;
  lng: number;
}

export interface Placeable {
  lat: number | null;
  lng: number | null;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Kilometres between two points, as the crow flies. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A real point, or null when the row was never geocoded. */
export function pointOf(row: Placeable): Point | null {
  if (
    typeof row.lat !== "number" ||
    typeof row.lng !== "number" ||
    !Number.isFinite(row.lat) ||
    !Number.isFinite(row.lng)
  ) {
    return null;
  }
  // 0,0 is in the Gulf of Guinea. Anything landing there is a default that
  // escaped, not a location, and treating it as one would sort it to the top
  // of every list in the world.
  if (row.lat === 0 && row.lng === 0) return null;
  return { lat: row.lat, lng: row.lng };
}

export interface WithDistance<T> {
  item: T;
  /** Kilometres, or null when either end has no coordinates. */
  km: number | null;
  /** "about 4 km" / "under a kilometre", or null. */
  label: string | null;
}

/**
 * Round to something honest.
 *
 * Under a kilometre is not worth a decimal: "0.4 km" implies a precision
 * straight-line distance does not have. Above ten, whole kilometres. In
 * between, one decimal, because the difference between 3 and 4 km genuinely
 * changes which clinic somebody picks.
 */
export function distanceLabel(km: number): string {
  if (km < 1) return "under a kilometre";
  if (km < 10) return `about ${km.toFixed(1)} km`;
  return `about ${Math.round(km)} km`;
}

/**
 * Order by proximity, keeping the un-geocoded at the end.
 *
 * `from` may be null, which is the common case: most visitors have not shared
 * a location. Then the original order is preserved exactly, because a list
 * shuffled for no reason is worse than one that simply is not sorted.
 */
export function byDistance<T extends Placeable>(
  items: T[],
  from: Point | null
): WithDistance<T>[] {
  const measured = items.map((item) => {
    const to = pointOf(item);
    const km = from && to ? distanceKm(from, to) : null;
    return { item, km, label: km === null ? null : distanceLabel(km) };
  });

  if (!from) return measured;

  return measured.sort((a, b) => {
    // Unplaced last. Never `?? 0`, which would lead every list with the rows
    // we know least about.
    if (a.km === null && b.km === null) return 0;
    if (a.km === null) return 1;
    if (b.km === null) return -1;
    return a.km - b.km;
  });
}
