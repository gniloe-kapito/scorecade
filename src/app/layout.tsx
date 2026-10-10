import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config";

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-manrope",
  display: "swap",
});

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
  themeColor: "#0d1411",
  colorScheme: "dark",
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
    // Тема фиксированная — тёмная (класс dark нужен для утилит dark:).
    <html lang="ru" className="dark">
      <head>
        {/* Адрес бэкенда (public/config.js) должен загрузиться до старта
            приложения — api-client читает window.SCORECADE_CONFIG. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- конфиг обязан выполниться синхронно, до кода приложения */}
        <script src={`${BASE_PATH}/config.js`} />
        {/* PWA-манифест и иконки — с учётом базового пути. */}
        <link rel="manifest" href={`${BASE_PATH}/manifest.webmanifest`} />
        <link rel="icon" href={`${BASE_PATH}/icon.svg`} type="image/svg+xml" />
      </head>
      <body
        className={`${manrope.variable} bg-background font-sans text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
