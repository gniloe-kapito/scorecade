import type { NextConfig } from "next";

// Базовый путь подставляется при сборке (см. .github/workflows/pages.yml):
// для репозитория вида ИМЯ.github.io он пустой, иначе — "/ИМЯ-РЕПОЗИТОРИЯ".
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Статический сайт для GitHub Pages: сборка кладётся в out/.
  output: "export",
  basePath,
  assetPrefix: basePath,
  images: {
    // GitHub Pages не умеет оптимизировать картинки на сервере.
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
