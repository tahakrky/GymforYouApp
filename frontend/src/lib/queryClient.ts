import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

// Exported so logout can wipe it at session boundaries — cached data outlives logout.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 401/403 → retry YOK. Kimliksiz istek, tekrar denemek anlamsız.
      retry: (failureCount, error) => {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          return false;
        }
        return failureCount < 3;
      },
      // Pencere focus olunca otomatik refetch yapma (logout sırasında gereksiz istek).
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutation'ları retry etme — logout/login gibi işlemler idempotent değil.
      retry: false,
    },
  },
});