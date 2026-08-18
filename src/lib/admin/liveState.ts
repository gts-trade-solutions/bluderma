/**
 * Whether a scheduled piece of content is actually showing right now.
 *
 * "Active" and "live" are not the same thing, and conflating them is how a
 * team ends up believing an expired offer is still running. This answers the
 * question the admin list is really asking: is a client seeing this?
 */
export function liveState(row: {
  isActive: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}): { tone: "success" | "warn" | "danger" | "neutral"; label: string } {
  const now = Date.now();

  if (!row.isActive) return { tone: "neutral", label: "Off" };
  if (row.startsAt && row.startsAt.getTime() > now) {
    return { tone: "warn", label: "Scheduled" };
  }
  if (row.endsAt && row.endsAt.getTime() < now) {
    return { tone: "danger", label: "Expired" };
  }
  return { tone: "success", label: "Live" };
}
