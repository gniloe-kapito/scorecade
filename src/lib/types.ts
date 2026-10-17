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

/* ---------- Каталог с настоящей пагинацией (поиск страницы магазина Steam) ----------
 *  Источник — тот же endpoint, которым пользуется сама страница поиска
 *  store.steampowered.com/search (параметры start/count/category1=998…).
 *  Он отдаёт полную выдачу с пагинацией: ~120 000+ игр, тысячи позиций
 *  в «лидерах продаж» и «скидках». Фильтр category1=998 («Игры»)
 *  отсекает DLC, демо, саундтреки, программы и железо на стороне Steam.
 *  Это storefront-механизм без официального контракта — парсер написан
 *  защитно: при изменении вёрстки маршрут вернёт 503, а не мусор. */

export type BrowseSection =
  | "all" // вся выдача (порядок Steam по умолчанию ≈ популярность)
  | "topsellers" // filter=topsellers — по продажам
  | "new" // sort_by=Released_DESC — новинки
  | "coming" // filter=comingsoon — скоро выйдут
  | "specials"; // specials=1 — скидки

export type BrowseSort =
  | "relevance" // порядок Steam по умолчанию
  | "released" // по дате выхода (сначала новые)
  | "reviews" // по оценкам обзоров Steam
  | "priceasc" // цена: по возрастанию
  | "pricedesc" // цена: по убыванию
  | "name"; // по названию

export type BrowseOs = "win" | "mac" | "linux";

/** Карточка каталога. Поля присутствуют только тогда, когда источник
 *  их реально отдал (у «скоро выйдут» цен обычно нет — price = null). */
export interface BrowseItem {
  id: string; // "steam:730" — совместимо со всеми маршрутами
  appId: number;
  name: string;
  cover: string; // вертикальная обложка (CDN-шаблон; фолбэк — на клиенте)
  header: string; // капсула из ответа поиска
  released: string; // локализованная дата выхода («16 окт. 2026 г.»)
  rank: number | null; // позиция (только «Лидеры продаж», сквозная)
  price: string | null; // "$35.99" | "Бесплатно" | null (не объявлена)
  priceInitial: string | null; // "$39.99" — цена до скидки
  discountPercent: number | null;
  isFree: boolean;
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  /** Отзыв Steam: «Очень положительные» и доля положительных обзоров. */
  reviewSummary: string | null;
  reviewPercent: number | null;
  storeUrl: string;
  /** Оценки пользователей Scorecade (null — ещё никто не оценил). */
  scorecade?: { average: number; count: number } | null;
}

export interface BrowseResponse {
  section: BrowseSection | "search"; // "search" — режим поиска по названию
  q: string | null; // поисковый запрос (режим поиска)
  sort: BrowseSort; // применённая сортировка
  os: BrowseOs | null; // применённый фильтр платформы
  hideFree: boolean;
  page: number;
  pageSize: number;
  total: number; // всего совпадений по данным Steam
  items: BrowseItem[];
  hasMore: boolean; // есть ли следующая страница
  updatedAt: string; // ISO — время получения данных от Steam
  source: "steam_storefront";
}

/* ---------- Онлайн игроков (официальный Steam) ----------
 *  Чарт «Сейчас играют» — store.steampowered.com/charts/mostplayed;
 *  точечный онлайн одной игры — Web API Valve
 *  ISteamUserStats/GetNumberOfCurrentPlayers (без ключа). */

export interface MostPlayedItem {
  id: string; // "steam:730"
  appId: number;
  name: string;
  cover: string; // горизонтальная капсула (header.jpg)
  players: number; // играют прямо сейчас
  peak: number; // дневной пик
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
  /** Права администратора (таблица admins) — приходит из /api/me,
   *  входа/регистрации и загрузки картинок. Отсутствует в старых
   *  ответах — трактуется как false. */
  isAdmin?: boolean;
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

/** Отметка игрока на игре (ручная, без фиктивных часов/процентов):
 *  playing — «Играю», beaten — «Пройдена», dropped — «Брошена»,
 *  played — «Играл(а)» (унаследованный статус; оценка тоже ставит его),
 *  want — «Хочу сыграть». Отсутствие строки = игра не отмечена. */
export type GameStatusValue = "playing" | "beaten" | "dropped" | "played" | "want";

export interface StatusRow {
  gameId: string;
  status: GameStatusValue;
  updatedAt: string; // ISO date string
}

/** Человекочитаемые подписи статусов (единый источник для модалки,
 *  страницы игры, библиотеки и профиля). */
export const STATUS_LABELS: Record<GameStatusValue, string> = {
  playing: "Играю",
  beaten: "Пройдена",
  dropped: "Брошена",
  played: "Играл(а)",
  want: "Хочу сыграть",
};

/** Порядок статусов в выборе (модалка игры / страница игры). */
export const STATUS_ORDER: readonly GameStatusValue[] = [
  "playing",
  "beaten",
  "dropped",
  "played",
  "want",
];

/** Строка библиотеки: игра со всеми моими отметками (оценка, отзыв,
 *  статус). Собирается на сервере из Rating ∪ GameStatus. */
export interface LibraryItem {
  gameId: string;
  gameName: string;
  gameCover: string | null;
  score: number | null; // null — не оценена
  review: string | null;
  status: GameStatusValue | null; // null — только оценка (legacy) или без отметки
  updatedAt: string; // ISO: последнее изменение оценки или статуса
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
