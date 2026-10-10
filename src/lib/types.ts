// Shared API types used by both server routes and the client SPA.

export interface GamePlatforms {
  windows: boolean;
  mac: boolean;
  linux: boolean;
}

export interface Screenshot {
  thumb: string;
  full: string;
}

/** Steam store category (multi-player, controller support, Remote Play, …).
 *  Descriptions arrive already localized (Russian). */
export interface GameCategory {
  id: number;
  description: string;
}

/** Minimum / recommended system requirements for Windows (sanitized HTML).
 *  Requirements for other OSes are intentionally not fetched — Windows only. */
export interface GameRequirements {
  minimum: string;
  recommended: string | null;
}

/** Ready-to-display price strings from Steam (already formatted, e.g. "$1.99"). */
export interface GamePrice {
  final: string;
  initial: string | null;
  discount: number;
}

/** Unified game format — the only shape the API ever returns to clients. */
export interface Game {
  id: string; // 'steam:730'
  name: string;
  cover: string; // vertical cover (falls back to header server-side)
  header: string; // horizontal capsule image
  released: string;
  developers: string[];
  publishers: string[];
  genres: string[];
  platforms: GamePlatforms;
  metacritic: number | null;
  isFree: boolean;
  shortDescription: string;
  descriptionHtml: string; // sanitized
  screenshots: Screenshot[];
  storeUrl: string;
  // Extended details from appdetails:
  languages: string[]; // localized names, "*" marks full audio support
  categories: GameCategory[];
  recommendations: number | null; // Steam user review count
  achievements: number | null; // Steam achievement count
  price: GamePrice | null;
  requirements: GameRequirements | null; // Windows only
}

export interface SearchItem {
  id: string;
  name: string;
  cover: string;
  header: string;
  metascore: number | null;
}

export interface RatingRow {
  gameId: string;
  gameName: string;
  gameCover: string | null;
  score: number;
  review: string | null;
  updatedAt: string; // ISO date string
  // Filled by the profile endpoint: likes received on the review
  // (undefined on /api/me/ratings where likes are not needed).
  likeCount?: number;
  likedByMe?: boolean;
  // Filled by list endpoints that show a comments toggle.
  commentCount?: number;
}

export interface FeedItem extends RatingRow {
  username: string;
  avatarUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
}

export interface ProfileStats {
  count: number;
  average: number | null;
  distribution: number[]; // 11 numbers, index = score 0..10
}

export interface ProfileUser {
  username: string;
  createdAt: string; // ISO date string
  avatarUrl: string | null; // kappa.lol link
  bannerUrl: string | null; // kappa.lol link
  stats: ProfileStats;
  followers: number;
  following: number;
  wants: number; // «Хочу поиграть» count
  reviews: number; // ratings with non-empty review text
  likesReceived: number; // total likes on this user's reviews
  isFollowing: boolean | null; // null when not authenticated
}

export interface ProfileResponse {
  user: ProfileUser;
  ratings: RatingRow[];
  wants: WantRow[];
}

export interface AuthUser {
  id: number;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

export interface FriendRating {
  username: string;
  avatarUrl: string | null;
  score: number;
  review: string | null;
  updatedAt: string; // ISO date string
  likeCount: number; // likes on the review (0 when no review)
  likedByMe: boolean;
  commentCount: number; // comments on the review (0 when no review)
}

export interface CommunityStats {
  count: number;
  average: number | null;
  distribution: number[]; // 11 numbers, index = score 0..10
  wants: number; // how many users marked this game as «Хочу поиграть»
}

export interface CommunityRating {
  username: string;
  avatarUrl: string | null;
  score: number;
  review: string | null;
  updatedAt: string; // ISO date string
  isFriend: boolean; // viewer follows this user (false when anonymous)
  likeCount: number; // likes on the review (0 when no review)
  likedByMe: boolean; // false when anonymous
  commentCount: number; // comments on the review (0 when no review)
}

export interface UserSearchItem {
  username: string;
  avatarUrl: string | null;
  ratings: number;
  followers: number;
  isFollowing: boolean | null; // null when not authenticated
  isMe: boolean;
}

/** Game status: 'played' (Играл) or 'want' (Хочу поиграть).
 *  Absence of a row means "Не играл" — the default state. */
export type GameStatusValue = "played" | "want";

export interface StatusRow {
  gameId: string;
  status: GameStatusValue;
  updatedAt: string; // ISO date string
}

/** A game the user marked as «Хочу поиграть». */
export interface WantRow {
  gameId: string;
  gameName: string;
  gameCover: string | null;
  updatedAt: string; // ISO date string
}

export interface CommunityResponse {
  stats: CommunityStats;
  items: CommunityRating[];
  nextCursor: string | null;
}

export interface CommunityTopItem {
  gameId: string;
  gameName: string;
  gameCover: string | null;
  count: number;
  average: number;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/** Unified notification center feed (bell + #/notifications page).
 *  Discriminated by `type`:
 *  - like          — someone liked my review of a game
 *  - friend_rating — someone I follow rated a game (after I followed them)
 *  - follower      — someone started following me
 *  - comment       — someone commented on my review
 *  - reply         — someone replied to my comment (in someone else's thread)
 *  `reviewOwner` — whose review thread the event belongs to (deep link
 *  `#/game/<id>?review=<owner>` opens that thread expanded). */
export type NotificationItem =
  | {
      type: "like";
      id: string;
      actor: string;
      actorAvatar: string | null;
      gameId: string;
      gameName: string;
      gameCover: string | null;
      reviewOwner: string;
      createdAt: string; // ISO date string
      isNew: boolean;
    }
  | {
      type: "friend_rating";
      id: string;
      actor: string;
      actorAvatar: string | null;
      gameId: string;
      gameName: string;
      gameCover: string | null;
      score: number;
      hasReview: boolean;
      reviewOwner: string;
      createdAt: string; // ISO date string
      isNew: boolean;
    }
  | {
      type: "follower";
      id: string;
      actor: string;
      actorAvatar: string | null;
      createdAt: string; // ISO date string
      isNew: boolean;
    }
  | {
      type: "comment";
      id: string;
      actor: string;
      actorAvatar: string | null;
      gameId: string;
      gameName: string;
      gameCover: string | null;
      text: string; // short preview of the comment
      reviewOwner: string;
      createdAt: string; // ISO date string
      isNew: boolean;
    }
  | {
      type: "reply";
      id: string;
      actor: string;
      actorAvatar: string | null;
      gameId: string;
      gameName: string;
      gameCover: string | null;
      text: string; // short preview of the reply
      replyToText: string; // short preview of MY comment that was replied to
      reviewOwner: string;
      createdAt: string; // ISO date string
      isNew: boolean;
    };

export interface NotificationsResponse {
  items: NotificationItem[];
  newCount: number; // unread events of ALL types (badge on the bell)
  /** True when older events exist beyond this page (offset pagination). */
  hasMore?: boolean;
  /** Offset for the next page (present when this page was full → more
   *  events may exist). Absent/null = no more pages. */
  nextOffset?: number | null;
}

/** Mini profile for hover-cards: light payload fetched on demand when a
 *  username card opens (feed, comments, game-page lists, user lists). */
export interface UserMini {
  username: string;
  avatarUrl: string | null;
  createdAt: string; // ISO date string
  stats: {
    ratings: number;
    average: number | null; // rounded to 0.1
    reviews: number;
    followers: number;
    following: number;
    wants: number;
  };
  isFollowing: boolean | null; // null when not authenticated / own profile
  isMe: boolean;
}

/** One comment under a review (game page / feed / profile threads).
 *  `replyToId` — 1-level nesting: replies render grouped under the parent. */
export interface ReviewCommentRow {
  id: number;
  username: string; // comment author
  avatarUrl: string | null;
  text: string;
  createdAt: string; // ISO date string
  isMine: boolean; // written by the viewer (delete allowed); false when anonymous
  replyToId: number | null; // parent comment id (top-level when null)
  replyToAuthor: string | null; // parent author username ("в ответ <name>")
}

export interface CommentsResponse {
  items: ReviewCommentRow[];
}
