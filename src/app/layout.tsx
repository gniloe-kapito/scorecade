import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config";

// Шрифт — стек из референса v3 (см. globals.css --font-sans): локальный
// Inter с системными фолбэками. Веб-шрифт намеренно не подключаем —
// рендер совпадает с примером один в один на любой машине.

// Базовый путь подставляется при сборке (GitHub Pages: /ИМЯ-РЕПОЗИТОРИЯ,
// см. .github/workflows/pages.yml). Пустой — в dev и для репозиториев
// вида ИМЯ.github.io.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: `${SITE_NAME} — оценки игр из Steam`,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
};

export const viewport: Viewport = {
  themeColor: "#191b1b",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Бутстрап-скрипт ставит data-theme и класс dark/light до первой
    // отрисовки (по умолчанию — графитовая тёмная). suppressHydrationWarning:
    // атрибуты <html> отличаются от SSR-разметки ожидаемым образом.
    <html lang="ru" className="dark" data-theme="graphite" suppressHydrationWarning>
      <head>
        {/* Тема из localStorage — до первой отрисовки, чтобы не мигала
            базовая тема. Светлые темы (бумага, сакура) снимают класс dark,
            чтобы утилиты dark: не мешали. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('scorecade_theme');var ok=['graphite','soft','plum','moss','aurora','ember','sakura','ocean','neon','cosmos'];if(!t||ok.indexOf(t)<0)t='graphite';var d=document.documentElement;d.setAttribute('data-theme',t);if(t==='soft'||t==='sakura')d.classList.remove('dark')}catch(e){}})();`,
          }}
        />
        {/* Адрес бэкенда (public/config.js) должен загрузиться до старта
            приложения — api-client читает window.SCORECADE_CONFIG. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- конфиг обязан выполниться синхронно, до кода приложения */}
        <script src={`${BASE_PATH}/config.js`} />
        {/* PWA-манифест и иконки — с учётом базового пути. */}
        <link rel="manifest" href={`${BASE_PATH}/manifest.webmanifest`} />
        <link rel="icon" href={`${BASE_PATH}/icon.svg`} type="image/svg+xml" />
      </head>
      <body className="bg-transparent font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
