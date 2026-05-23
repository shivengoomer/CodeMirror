"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, createContext, useContext, useEffect } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({
  theme: "dark",
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("cm_theme") as Theme;
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    } else {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(systemDark ? "dark" : "light");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cm_theme", theme);
    const htmlEl = document.documentElement;
    if (theme === "light") {
      htmlEl.classList.remove("theme-dark");
      htmlEl.classList.add("theme-light");
    } else {
      htmlEl.classList.remove("theme-light");
      htmlEl.classList.add("theme-dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          if (error?.message?.includes("401") || error?.message?.toLowerCase().includes("unauthorized")) {
            return false;
          }
          return failureCount < 3;
        },
      },
      mutations: {
        onError: (error: any) => {
          if (error?.message?.includes("401") || error?.message?.toLowerCase().includes("unauthorized")) {
            localStorage.removeItem("cm_dashboard_access_token");
            router.push("/login");
          }
        }
      }
    },
  }));

  // Simple interceptor-like logic for queries
  queryClient.getQueryCache().config.onError = (error: any) => {
    if (error?.message?.includes("401") || error?.message?.toLowerCase().includes("unauthorized")) {
      localStorage.removeItem("cm_dashboard_access_token");
      router.push("/login");
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}
