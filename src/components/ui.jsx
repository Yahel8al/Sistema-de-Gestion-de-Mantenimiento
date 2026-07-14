import { X } from "lucide-react";

const COLOR_MAP = {
  ok: { bg: "var(--color-ok-soft)", fg: "var(--color-ok)" },
  warn: { bg: "var(--color-warn-soft)", fg: "var(--color-warn)" },
  critical: { bg: "var(--color-critical-soft)", fg: "var(--color-critical)" },
  info: { bg: "var(--color-info-soft)", fg: "var(--color-info)" },
  idle: { bg: "var(--color-idle-soft)", fg: "var(--color-idle)" },
};

export function Badge({ color = "idle", children, dot = false }) {
  const c = COLOR_MAP[color] || COLOR_MAP.idle;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}
    >
      {dot && <span className={`pulse-dot ${color === "critical" || color === "warn" ? "live" : ""}`} style={{ color: c.fg, background: c.fg }} />}
      {children}
    </span>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: { background: "var(--color-teal)", color: "#fff" },
    ghost: { background: "transparent", color: "var(--color-ink)", border: "1px solid var(--color-line)" },
    danger: { background: "var(--color-critical-soft)", color: "var(--color-critical)" },
  };
  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${className}`}
      style={styles[variant]}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "", nameplate = false }) {
  return (
    <div
      className={`${nameplate ? "nameplate" : "rounded-xl border"} p-5 ${className}`}
      style={nameplate ? {} : { background: "var(--color-card)", borderColor: "var(--color-line)" }}
    >
      {children}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,37,50,0.45)" }}>
      <div className={`w-full ${width} rounded-xl shadow-xl max-h-[90vh] flex flex-col`} style={{ background: "var(--color-card)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-line)" }}>
          <h3 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--color-paper)]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {Icon && (
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--color-info-soft)" }}>
          <Icon size={22} style={{ color: "var(--color-info)" }} />
        </div>
      )}
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm max-w-sm" style={{ color: "var(--color-muted)" }}>{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, color = "info", icon: Icon }) {
  const c = COLOR_MAP[color] || COLOR_MAP.info;
  return (
    <Card className="flex items-start justify-between">
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--color-muted)" }}>{label}</div>
        <div className="text-3xl mono-tabular font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{value}</div>
        {sub && <div className="text-xs mt-1.5" style={{ color: "var(--color-muted)" }}>{sub}</div>}
      </div>
      {Icon && (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg }}>
          <Icon size={19} style={{ color: c.fg }} />
        </div>
      )}
    </Card>
  );
}
