import type { InfiniteData } from "@tanstack/react-query";
import type { NotificationsResponse } from "./types";

/** Query cache entries for the notification feed:
 *  - ["notifications"]      — bell popover, regular query (first page)
 *  - ["notifications","page"] — #/notifications, infinite query */
export const NOTIFS_KEY = ["notifications"] as const;
export const NOTIFS_PAGE_KEY = ["notifications", "page"] as const;

export const NOTIFS_PAGE_SIZE = 50;

type Regular = NotificationsResponse;
type Infinite = InfiniteData<NotificationsResponse, number>;

/** mark-all-seen optimistic patch for a REGULAR (non-paged) cache entry. */
export function patchSeenRegular(
  old: Regular | undefined,
): Regular | undefined {
  return old
    ? {
        ...old,
        newCount: 0,
        items: old.items.map((i) => ({ ...i, isNew: false })),
      }
    : old;
}

/** mark-all-seen optimistic patch for an INFINITE query cache entry. */
export function patchSeenInfinite(
  old: Infinite | undefined,
): Infinite | undefined {
  return old
    ? {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          newCount: 0,
          items: p.items.map((i) => ({ ...i, isNew: false })),
        })),
      }
    : old;
}
