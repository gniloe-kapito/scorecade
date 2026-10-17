// Правило сайта: оценка 0–4 требует текстовый отзыв.
// Общая логика для страницы игры (GameView) и окна игры (GameModal),
// чтобы поведение было единым. Константы — в lib/config.ts
// (LOW_SCORE_MAX, MIN_LOW_SCORE_REVIEW_LENGTH); серверная проверка —
// в PUT /api/ratings/[gameId].

import { LOW_SCORE_MAX, MIN_LOW_SCORE_REVIEW_LENGTH } from "@/lib/config";

/** Требует ли эта оценка обязательный отзыв (0–4)? */
export function lowScoreNeedsReview(score: number | null): boolean {
  return score !== null && score >= 0 && score <= LOW_SCORE_MAX;
}

/** Можно ли сохранять: для 0–4 отзыв должен быть не короче минимума. */
export function lowScoreReviewOk(score: number | null, review: string): boolean {
  if (!lowScoreNeedsReview(score)) return true;
  return review.trim().length >= MIN_LOW_SCORE_REVIEW_LENGTH;
}

/** Подсказка для поля отзыва при низкой оценке. */
export function lowScoreHint(): string {
  return `Оценка ${LOW_SCORE_MAX} и ниже: расскажите, чем не понравилась игра (минимум ${MIN_LOW_SCORE_REVIEW_LENGTH} символов)`;
}

/** Сколько символов отзыва ещё нужно до минимума. */
export function lowScoreRemaining(review: string): number {
  return Math.max(0, MIN_LOW_SCORE_REVIEW_LENGTH - review.trim().length);
}
