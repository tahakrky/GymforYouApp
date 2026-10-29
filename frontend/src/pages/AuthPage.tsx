import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { apiPost } from "@/lib/api";
import { authKey } from "@/lib/auth";

const LOGO_URL = "/dumbell%20logo.png";

type AuthResponse = { user: { id: string; name: string; email: string } };

/** FastAPI 422 hatalarını Türkçeye çevirir */
type PydanticErr = {
  type?: string;
  msg?: string;
  loc?: (string | number)[];
  ctx?: Record<string, unknown>;
};

const FIELD_TR: Record<string, string> = {
  name: "İsim",
  email: "E-posta",
  password: "Şifre",
  phone: "Telefon",
};

function translateFieldError(item: PydanticErr): string {
  const lastLoc = item.loc?.[item.loc.length - 1];
  const field = typeof lastLoc === "string" ? lastLoc : "";
  const label = FIELD_TR[field] ?? (field || "Alan");

  switch (item.type) {
    case "string_too_short": {
      const min = item.ctx?.min_length;
      return min
        ? `${label} en az ${min} karakter olmalı.`
        : `${label} çok kısa.`;
    }
    case "string_too_long": {
      const max = item.ctx?.max_length;
      return max
        ? `${label} en fazla ${max} karakter olabilir.`
        : `${label} çok uzun.`;
    }
    case "missing":
      return `${label} zorunlu.`;
    case "value_error": {
      if (field === "email" || /email/i.test(item.msg ?? "")) {
        return "Geçersiz e-posta adresi.";
      }
      return `${label} geçersiz.`;
    }
    case "int_parsing":
    case "int_type":
    case "float_parsing":
    case "float_type":
      return `${label} sayı olmalı.`;
    case "value_error.email":
      return "Geçersiz e-posta adresi.";
    default:
      return item.msg ?? "Geçersiz değer.";
  }
}

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isRegister = location.pathname === "/register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    // İstemci tarafı ön kontrol — backend'e gitmeden yakala
    if (isRegister) {
      const trimmedName = name.trim();
      if (trimmedName.length < 2) {
        setError("İsim en az 2 karakter olmalı.");
        return;
      }
      if (password.length < 8) {
        setError("Şifre en az 8 karakter olmalı.");
        return;
      }
    } else if (!email.trim() || !password) {
      setError("E-posta ve şifre zorunlu.");
      return;
    }

    setBusy(true);
    try {
      if (isRegister) {
        await apiPost<AuthResponse>("/auth/register", {
          name: name.trim(),
          email: email.trim(),
          password,
        });
      } else {
        await apiPost<AuthResponse>("/auth/login", {
          email: email.trim(),
          password,
        });
      }

      await queryClient.invalidateQueries({ queryKey: authKey });

      const destination = (
        location.state as { from?: { pathname?: string } } | null
      )?.from?.pathname;
      navigate(
        destination && destination !== "/login" && destination !== "/register"
          ? destination
          : "/",
        { replace: true },
      );
    } catch (err: unknown) {
      const e = err as {
        status?: number;
        body?: { detail?: string | PydanticErr[] };
      };
      const detail = e.body?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        const messages = detail.map(translateFieldError).filter(Boolean);
        setError(messages.length ? messages.join(" ") : "Geçersiz bilgi girdin.");
      } else if (e.status === 409) {
        setError("Bu e-posta adresi zaten kayıtlı.");
      } else if (e.status === 401) {
        setError("E-posta veya şifre hatalı.");
      } else {
        setError("İşlem başarısız oldu. Sunucu bağlantısını kontrol et.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#09090B] px-4 py-10 text-white">
      <div className="pointer-events-none absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#84CC16]/[0.08] blur-3xl" />
      <div className="relative w-full max-w-[420px]">
        <Link
          to="/"
          className="group mb-9 flex items-center justify-center gap-2.5"
          aria-label="GymForYou"
        >
          <img
            src={LOGO_URL}
            alt=""
            className="h-11 w-11 object-contain transition-transform duration-300 ease-out group-hover:scale-110"
          />
          <span className="font-heading text-2xl font-extrabold tracking-tight">
            Gym<span className="text-[#84CC16]">ForYou</span>
          </span>
        </Link>

        <section className="rounded-2xl border border-[#27272A] bg-[#111113] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-7">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#84CC16]">
              Kişisel antrenman alanın
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {isRegister ? "Hesabını oluştur" : "Tekrar hoş geldin"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {isRegister
                ? "Antrenmanlarını ve gelişimini tek yerde takip etmeye başla."
                : "Devam etmek için hesabına giriş yap."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {isRegister && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">
                  Adın
                </span>
                <span className="flex h-12 items-center gap-3 rounded-xl border border-[#303034] bg-[#09090B] px-3.5 focus-within:border-[#84CC16]/70">
                  <UserRound className="h-4 w-4 shrink-0 text-zinc-500" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="name"
                    placeholder="Adın"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
                  />
                </span>
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">
                E-posta
              </span>
              <span className="flex h-12 items-center gap-3 rounded-xl border border-[#303034] bg-[#09090B] px-3.5 focus-within:border-[#84CC16]/70">
                <Mail className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="ornek@email.com"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">
                Şifre
              </span>
              <span className="flex h-12 items-center gap-3 rounded-xl border border-[#303034] bg-[#09090B] px-3.5 focus-within:border-[#84CC16]/70">
                <LockKeyhole className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isRegister ? 8 : 1}
                  maxLength={128}
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder={isRegister ? "En az 8 karakter" : "Şifren"}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-md p-1 text-zinc-500 hover:text-white"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </span>
              {isRegister && (
                <span className="mt-1.5 block text-[11px] text-zinc-500">
                  En az 8 karakter olmalı.
                </span>
              )}
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 py-2.5 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#84CC16] px-4 text-sm font-bold text-[#101207] transition-colors hover:bg-[#a3e635] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {busy
                ? "İşleniyor..."
                : isRegister
                  ? "Hesap oluştur"
                  : "Giriş yap"}
            </button>
          </form>

          <div className="mt-6 border-t border-[#27272A] pt-5 text-center text-sm text-zinc-400">
            {isRegister ? "Zaten hesabın var mı? " : "Henüz hesabın yok mu? "}
            <Link
              to={isRegister ? "/login" : "/register"}
              className="font-semibold text-[#A3E635] hover:text-white"
            >
              {isRegister ? "Giriş yap" : "Kayıt ol"}
            </Link>
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-zinc-600">
          Hesabınla giriş yaparak kişisel antrenman alanına erişirsin.
        </p>
      </div>
    </main>
  );
}