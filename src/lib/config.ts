// Single place for tunable site-wide constants.
export const SITE_NAME = "Scorecade";

export const SITE_TAGLINE = "Оценивай игры из Steam — от 0 до 10";

export const SITE_DESCRIPTION =
  "Оценивайте игры из Steam на «колесе» от 0 до 10, следите за оценками друзей и делитесь своими.";

// localStorage keys
export const TOKEN_STORAGE_KEY = "scorecade_token";
export const REDIRECT_STORAGE_KEY = "scorecade_redirect";

export const MAX_REVIEW_LENGTH = 1000;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/* ---------- Правило «низкая оценка требует отзыв» ----------
 * Оценка 0–4 может быть сохранена только вместе с текстовым отзывом:
 * пользователь обязан объяснить, чем не понравилась игра. */
export const LOW_SCORE_MAX = 4;
export const MIN_LOW_SCORE_REVIEW_LENGTH = 10; // символов очищенного отзыва

/* ---------- Админ-режим ----------
 * Сколько раз нужно подтвердить опасное админ-действие, чтобы исключить
 * промах кликом (смена пароля, удаление оценки/комментария). */
export const ADMIN_CONFIRM_STEPS = 10;
