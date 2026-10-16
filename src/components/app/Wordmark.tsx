import { SITE_NAME } from "@/lib/config";

/** Логотип как в референсе v3: повёрнутый квадратный знак с буквой «S»
 *  (акцентный контур, серифная георгина) и монолитная надпись SCORECADE
 *  с разрядкой. При наведении знак игриво покачивается. */
export function Wordmark() {
  return (
    <>
      <span
        aria-hidden
        className="brand-mark"
      >
        S
      </span>
      <span className="text-[15px] font-extrabold tracking-[0.11em] sm:text-[17px]">
        {SITE_NAME.toUpperCase()}
      </span>
      <span className="sr-only">{SITE_NAME}</span>
    </>
  );
}
