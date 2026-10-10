"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { App } from "@/components/app/App";

export default function ClientApp() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 60_000,
          },
        },
      }),
  );

  // Register the PWA service worker (offline shell + image cache).
  // The path accounts for the base path (GitHub Pages serves the site
  // under /REPO_NAME — see .github/workflows/pages.yml).
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const register = () => {
      navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {
        /* SW is an enhancement — ignore registration failures */
      });
    };
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  );
}
