import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Antrenman", icon: Dumbbell, testid: "bottom-nav-workout" },
  { to: "/planner", label: "Plan", icon: CalendarCheck, testid: "bottom-nav-planner" },
  { to: "/progress", label: "Gelişim", icon: Activity, testid: "bottom-nav-progress" },
  { to: "/history", label: "Geçmiş", icon: CalendarDays, testid: "bottom-nav-history" },
  { to: "/exercises", label: "Kütüphane", icon: BookOpen, testid: "bottom-nav-exercises" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#27272A] bg-[#0E0E11]/95 backdrop-blur-xl md:hidden"
      data-testid="bottom-nav"
      aria-label="Ana gezinme"
    >
      {ITEMS.map((item) => {
        const active = isActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            data-testid={item.testid}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors duration-150",
              active ? "text-[#84CC16]" : "text-zinc-500",
            )}
          >
            <item.icon className="h-5 w-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}