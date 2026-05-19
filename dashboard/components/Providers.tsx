"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
