// Страница 404 — ключевой элемент работы «красивых» ссылок вида
// /u/ник и /game/steam:730, которые отдаёт кнопка «Поделиться».
//
// Само приложение — hash-routed SPA (#/u/ник). На статическом хостинге
// (GitHub Pages) прямой путь /scorecade/u/ник не существует как файл,
// поэтому хостинг отвечает 404 и отдаёт этот файл (out/404.html при
// статической сборке). Встроенный скрипт мгновенно превращает путь
// обратно в хеш-роут и перезагружает страницу на приложение.
// Локальный dev-сервер Next.js делает то же самое для путей без хеша.
//
// Редирект работает и на GitHub Pages (сервер отдаёт 404.html проекта
// для 404-путей под его базой), и локально — один и тот же файл.

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Встроенный скрипт: выполняется сразу при загрузке страницы, не дожидаясь
// реакта/чанков. base вшивается на этапе сборки (NEXT_PUBLIC_BASE_PATH).
const REDIRECT_SCRIPT = `(function () {
  var base = ${JSON.stringify(BASE_PATH)};
  var path = window.location.pathname;
  var root = base + "/";
  // Корень сайта, пути вне базового префикса, файлы, внутренности Next
  // и API не перенаправляем — для них остаётся обычная страница 404.
  if (path === root || path === base) return;
  if (path.indexOf(root) !== 0) return;
  if (/\\.[a-zA-Z0-9]+$/.test(path)) return;
  if (path.indexOf(base + "/_next/") === 0) return;
  if (path.indexOf(base + "/api/") === 0) return;
  var tail = path.slice(base.length) || "/";
  window.location.replace(base + "/#" + tail + (window.location.search || ""));
})();`;

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {/* Мгновенный редирект красивого пути в хеш-роут приложения */}
      <script dangerouslySetInnerHTML={{ __html: REDIRECT_SCRIPT }} />
      <p className="text-5xl font-extrabold text-primary">404</p>
      <h1 className="text-xl font-bold">Страница не найдена</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Если ссылка ведёт на игру или профиль — приложение откроет её
        автоматически. Этого не произошло? Вернитесь на главную.
      </p>
      <a
        href={`${BASE_PATH}/#/`}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-85"
      >
        На главную
      </a>
    </div>
  );
}
