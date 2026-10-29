import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppHeader from "@/components/layout/AppHeader";
import BottomNav from "@/components/layout/BottomNav";
import SplashScreen from "@/components/layout/SplashScreen";
import { SpotifyPlayerProvider } from "@/components/music/SpotifyPlayerProvider";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import AuthPage from "@/pages/AuthPage";
import { useAuth } from "@/lib/auth";

import Home from "@/pages/Home";

const Workout = lazy(() => import("@/pages/Workout"));
const Library = lazy(() => import("@/pages/Library"));
const ExerciseDetail = lazy(() => import("@/pages/ExerciseDetail"));
const Progress = lazy(() => import("@/pages/Progress"));
const History = lazy(() => import("@/pages/History"));
const HistoryDetail = lazy(() => import("@/pages/HistoryDetail"));
const Music = lazy(() => import("@/pages/Music"));
const Profile = lazy(() => import("@/pages/Profile"));
const Planner = lazy(() => import("@/pages/Planner"));
const Admin = lazy(() => import("@/pages/Admin"));

const SPLASH_KEY = "splash-shown";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function RouteFallback() {
  return (
    <div className="space-y-4" data-testid="route-loading">
      <div className="h-8 w-2/3 animate-pulse rounded-md bg-[#141416]" />
      <div className="h-40 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
      <div className="h-24 animate-pulse rounded-lg border border-[#27272A] bg-[#141416]" />
    </div>
  );
}

function AuthGate() {
  const location = useLocation();
  const { isLoggedIn, isLoading } = useAuth();

  const isAuthRoute =
    location.pathname === "/login" || location.pathname === "/register";

  if (isLoading) {
    if (isAuthRoute) return <AuthPage />;
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#09090B]">
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-[#27272A] border-t-[#84CC16]"
          aria-label="Yükleniyor"
        />
      </div>
    );
  }

  if (isAuthRoute) {
    return isLoggedIn ? <Navigate to="/" replace /> : <AuthPage />;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <ScrollToTop />
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-14">
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/workout/:muscle" element={<Workout />} />
              <Route path="/exercises" element={<Library />} />
              <Route path="/exercises/:id" element={<ExerciseDetail />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:id" element={<HistoryDetail />} />
              <Route path="/music" element={<Music />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <BottomNav />
      <Toaster />
    </div>
  );
}

export default function App() {
  // 🆕 Splash sadece oturum başına bir kez gösterilir (sessionStorage)
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem(SPLASH_KEY);
    } catch {
      return true;
    }
  });

  const handleSplashDone = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      /* private mode */
    }
    setShowSplash(false);
  }, []);

  return (
    <SpotifyPlayerProvider>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <AuthGate />
    </SpotifyPlayerProvider>
  );
}