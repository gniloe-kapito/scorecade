// Russian locale formatting helpers.

/** Russian plural forms: pluralRu(2, "оценка", "оценки", "оценок") → "оценки". */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const category = new Intl.PluralRules("ru-RU").select(n);
  if (category === "one") return one;
  if (category === "few") return few;
  return many;
}

/** Числа с тонкими пробелами: formatCount(1113361) → "1 113 361".
 *  Для онлайна игроков и других крупных счётчиков. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

/** Компактный вид онлайна: 1 113 361 → "1,1 млн", 298 050 → "298 тыс.",
 *  16 196 → "16,2 тыс.". Для метрик в строках чарта. */
export function formatCountCompact(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10)
      .toString()
      .replace(".", ",")} млн`;
  }
  if (n >= 10_000) return `${Math.round(n / 1000)} тыс.`;
  if (n >= 1000) {
    const v = Math.round((n / 1000) * 10) / 10;
    return `${v.toString().replace(".", ",")} тыс.`;
  }
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function timeAgo(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, "second");
  const min = Math.round(diffSec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, "minute");
  const hours = Math.round(min / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 31) return rtf.format(-days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.round(months / 12), "year");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Full date+time for tooltips on relative timestamps ("2 дня назад" →
 *  exact "5 октября 2026 г., 14:32:05"). */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "Март 2025" — membership since line on hover-cards. */
export function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatAverage(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

/** Tailwind classes for the Metacritic badge color tier.
 *  Читаемо и в светлой, и в тёмной теме (dark: вариант для глубоких тонов). */
export function metacriticTone(score: number): string {
  if (score >= 75)
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (score >= 50)
    return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
}
