import { Link } from "@tanstack/react-router";
import { Radio, Smartphone, Clock, SlidersHorizontal } from "lucide-react";
import { useRoomStore } from "@/lib/roomStore";

const tabs = [
  { to: "/detection", icon: Radio, label: "Radar" },
  { to: "/multi", icon: Smartphone, label: "Multi" },
  { to: "/history", icon: Clock, label: "Historique" },
  { to: "/settings", icon: SlidersHorizontal, label: "Réglages" },
] as const;

export function BottomNav() {
  const pendingCount = useRoomStore(
    (s) => s.detections.filter((d) => !d.validatedBy || d.validatedBy === "pending").length,
  );
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 glass-panel mx-3 mb-3 rounded-2xl px-2 py-2">
      <ul className="flex justify-around items-center">
        {tabs.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <Link
              to={to}
              className="relative flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground transition-colors"
              activeProps={{ className: "relative text-teal after:content-[''] after:absolute after:-bottom-0.5 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-teal after:shadow-[0_0_6px_var(--teal-glow)]" }}
            >
              <span className="relative">
                <Icon size={20} />
                {to === "/history" && pendingCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full animate-pulse"
                    style={{ background: "var(--amber)", boxShadow: "0 0 6px var(--amber)" }}
                    aria-label={`${pendingCount} détection(s) à valider`}
                  />
                )}
              </span>
              <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}