import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const LOGO_URL = "/dumbell%20logo.png";

const LINKS = [
  { to: "/", label: "Antrenman" },
  { to: "/planner", label: "Planlayıcı" },
  { to: "/progress", label: "Gelişim" },
  { to: "/history", label: "Geçmiş" },
  { to: "/exercises", label: "Kütüphane" },
];

export default function AppHeader() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  const onProfile = pathname.startsWith("/profile");
  const onAdmin = pathname.startsWith("/admin");

  const isAdmin = !!user?.is_admin;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Avatar görseli — iki durumda da aynı
  const avatar = (interactive: boolean) => (
    <span
      className={cn(
        "absolute inset-0 rounded-full border bg-[#141416] transition-all duration-200",
        interactive && "group-hover:border-[#84CC16]/60",
        (onProfile || onAdmin) && "border-[#84CC16]/60",
        !onProfile && !onAdmin && "border-[#27272A]",
      )}
      aria-hidden
    />
  );

  return (
    <header className="sticky top-0 z-40 transform-gpu bg-[#09090B]/85 backdrop-blur-xl will-change-transform">
      <div
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#27272A] to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        {/* Logo */}
        <Link
          to="/"
          aria-label="Ana sayfa"
          data-testid="logo-link"
          className="group relative flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#84CC16]/50"
        >
          <span className="relative inline-flex">
            <img
              src={LOGO_URL}
              alt=""
              className="h-8 w-8 object-contain transition-transform duration-300 ease-out group-hover:scale-110"
            />
            <span
              className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ boxShadow: "0 0 24px 2px rgba(132, 204, 22, 0.25)" }}
              aria-hidden
            />
          </span>
          <span className="font-heading text-lg font-extrabold leading-none tracking-tight text-white sm:text-xl">
            Gym<span className="text-[#84CC16]">ForYou</span>
          </span>
        </Link>

        {/* Nav */}
        <nav
          className="hidden h-full flex-1 items-center justify-center gap-1 md:flex"
          data-testid="top-nav"
        >
          {LINKS.map((l) => {
            const active = isActive(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                data-testid={`nav-${l.to === "/" ? "workout" : l.to.slice(1)}`}
                className={cn(
                  "group relative flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold outline-none",
                  "transition-all duration-200 ease-out",
                  "focus-visible:ring-2 focus-visible:ring-[#84CC16]/50",
                  active
                    ? "bg-[#84CC16]/[0.08] text-white"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "h-1 w-1 rounded-full bg-[#84CC16] transition-all duration-300 ease-out",
                    active
                      ? "scale-100 opacity-100 shadow-[0_0_8px_rgba(132,204,22,0.8)]"
                      : "scale-0 opacity-0",
                  )}
                  aria-hidden
                />
                {l.label}
                {!active && (
                  <span
                    className="pointer-events-none absolute inset-x-3 -bottom-px h-px origin-center scale-x-0 bg-gradient-to-r from-transparent via-[#84CC16]/60 to-transparent transition-transform duration-300 ease-out group-hover:scale-x-100"
                    aria-hidden
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sağ taraf — admin ise dropdown, değilse direkt profil linki */}
        <div className="relative ml-auto" ref={menuRef}>
          {isAdmin ? (
            <>
              {/* Admin kullanıcı: tıklayınca dropdown */}
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Hesap menüsü"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                data-testid="account-menu-trigger"
                className={cn(
                  "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-[#84CC16]/50",
                  "text-zinc-400 hover:text-white",
                )}
              >
                {avatar(true)}
                <User className="relative h-4 w-4" aria-hidden />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  data-testid="account-menu"
                  className={cn(
                    "absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-[#27272A] bg-[#111113] shadow-2xl shadow-black/60",
                    "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150",
                  )}
                >
                  <div className="border-b border-[#1F1F23] px-4 py-3">
                    <p className="truncate font-heading text-sm font-bold text-white">
                      {user?.name || "Kullanıcı"}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {user?.email}
                    </p>
                  </div>

                  <div className="p-1.5">
                    <Link
                      to="/profile"
                      role="menuitem"
                      data-testid="account-menu-profile"
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                        onProfile
                          ? "bg-[#1E2B0E] text-[#84CC16]"
                          : "text-zinc-300 hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      <User className="h-4 w-4 shrink-0" aria-hidden />
                      Profil
                    </Link>

                    <Link
                      to="/admin"
                      role="menuitem"
                      data-testid="account-menu-admin"
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                        onAdmin
                          ? "bg-[#1E2B0E] text-[#84CC16]"
                          : "text-zinc-300 hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      <Shield className="h-4 w-4 shrink-0" aria-hidden />
                      Admin
                    </Link>
                  </div>
                </div>
              )}
            </>
          ) : onProfile ? (
            /* Normal kullanıcı + profil sayfasında → pasif avatar */
            <span
              aria-label="Profil"
              aria-current="page"
              data-testid="profile-avatar"
              className="relative flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-full text-zinc-500 select-none"
            >
              <span
                className="absolute inset-0 rounded-full border border-[#27272A] bg-[#141416]"
                aria-hidden
              />
              <User className="relative h-4 w-4" aria-hidden />
            </span>
          ) : (
            /* Normal kullanıcı → direkt profile */
            <Link
              to="/profile"
              aria-label="Profil"
              data-testid="profile-avatar"
              className={cn(
                "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none transition-all duration-200",
                "text-zinc-400 hover:text-white",
                "focus-visible:ring-2 focus-visible:ring-[#84CC16]/50",
              )}
            >
              {avatar(true)}
              <User className="relative h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}