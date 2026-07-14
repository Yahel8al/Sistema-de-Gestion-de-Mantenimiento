import { NavLink, useLocation } from "react-router-dom";
import { Activity, LogOut, Search, ChevronDown } from "lucide-react";
import { useState } from "react";
import { NAV_GROUPS, ROLES } from "../lib/modules";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { profile, user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const rol = profile?.rol || "clinico";
  const currentTitle = NAV_GROUPS.flatMap((g) => g.items).find(
    (i) => i.path === location.pathname
  )?.label || "Panel de control";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-paper" style={{ background: "var(--color-paper)" }}>
      {/* Sidebar */}
      <aside
        className="hidden md:flex md:w-64 lg:w-72 flex-col shrink-0"
        style={{ background: "var(--color-ink)" }}
      >
        <div className="flex items-center gap-2 px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div
            className="pulse-dot live w-3 h-3"
            style={{ color: "var(--color-teal-light)", background: "var(--color-teal-light)" }}
          />
          <span
            className="text-xl tracking-tight font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "#fff" }}
          >
            Pulso
          </span>
          <span className="text-[10px] uppercase tracking-widest ml-1" style={{ color: "var(--color-teal-light)" }}>
            CMMS Biomédico
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (item) => !item.roles || item.roles.includes(rol)
            );
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <div
                  className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      end={item.path === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive ? "font-medium" : ""
                        }`
                      }
                      style={({ isActive }) => ({
                        background: isActive ? "var(--color-ink-3)" : "transparent",
                        color: isActive ? "#fff" : "rgba(255,255,255,0.65)",
                      })}
                    >
                      <item.icon size={17} strokeWidth={2} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t text-xs" style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
          <div className="flex items-center gap-1.5">
            <Activity size={13} />
            <span>Cumplimiento IEC 60601 · ISO 13485 · ISO 14971</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-16 shrink-0 flex items-center justify-between px-4 md:px-8 border-b"
          style={{ borderColor: "var(--color-line)", background: "var(--color-card)" }}
        >
          <div>
            <h1 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {currentTitle}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "var(--color-paper)", color: "var(--color-muted)" }}
            >
              <Search size={15} />
              <input
                placeholder="Buscar equipo, código, orden..."
                className="bg-transparent outline-none w-48 lg:w-64 placeholder:text-[13px]"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[var(--color-paper)]"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                  style={{ background: "var(--color-teal)" }}
                >
                  {(profile?.nombre || user?.email || "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left leading-tight">
                  <div className="text-sm font-medium">{profile?.nombre || user?.email}</div>
                  <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                    {ROLES[rol]?.label || rol}
                  </div>
                </div>
                <ChevronDown size={15} style={{ color: "var(--color-muted)" }} />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-lg border shadow-lg py-1 z-20"
                  style={{ background: "var(--color-card)", borderColor: "var(--color-line)" }}
                >
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-paper)]"
                    style={{ color: "var(--color-critical)" }}
                  >
                    <LogOut size={15} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
