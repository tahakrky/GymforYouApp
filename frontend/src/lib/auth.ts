import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  is_admin?: boolean;
};

export const authKey = ["auth", "me"] as const;

export function useAuth() {
  const { data, isLoading, isFetched } = useQuery<{ user: AuthUser } | null>({
    queryKey: authKey,
    queryFn: async () => {
      try {
        return await apiGet<{ user: AuthUser }>("/auth/me");
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const logout = useMutation({
    mutationFn: () => apiPost<void>("/auth/logout", {}),
    onSettled: () => {
      // Başarılı da olsa hata da olsa login'e at. replace() geri tuşunda
      // kullanıcının logout olmuş sayfaya dönmesini engeller.
      window.location.replace("/login");
    },
  });

  return {
    user: data?.user ?? null,
    isLoggedIn: !!data?.user,
    isLoading: isLoading && !isFetched,
    logout: () => logout.mutate(),
    isLoggingOut: logout.isPending,
  };
}