import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Activity, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui";

export default function Login() {
  const { user, login, accessError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Si ya hay una sesión activa (por ejemplo, justo después de iniciar sesión),
  // se redirige automáticamente al Dashboard en vez de quedarse en /login.
  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error("Error de inicio de sesión (código Firebase):", err.code, err.message);
      setError("No pudimos iniciar sesión. Revisa tu correo y contraseña.");
    } finally {
      setLoading(false);
    }
  }

  const mensajeError = error || accessError;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-ink)" }}>
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="pulse-dot live w-3 h-3" style={{ color: "var(--color-teal-light)", background: "var(--color-teal-light)" }} />
          <span className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "#fff" }}>Pulso</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold mb-4 leading-snug" style={{ fontFamily: "var(--font-display)", color: "#fff" }}>
            El pulso operativo de tu ingeniería biomédica.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            Inventario, mantenimientos preventivos y correctivos, calibraciones y
            trazabilidad completa de cada equipo, en un solo lugar diseñado para
            cumplir IEC 60601, ISO 13485 e ISO 14971.
          </p>
        </div>
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>© {new Date().getFullYear()} Pulso CMMS Biomédico</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6" style={{ background: "var(--color-paper)" }}>
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Activity size={22} style={{ color: "var(--color-teal)" }} />
            <span className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Pulso</span>
          </div>
          <h1 className="text-xl font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>Inicia sesión</h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>Accede con tu cuenta institucional.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Correo electrónico</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{ borderColor: "var(--color-line)", background: "var(--color-card)" }}
                placeholder="nombre@hospital.org"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Contraseña</label>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{ borderColor: "var(--color-line)", background: "var(--color-card)" }}
                placeholder="••••••••"
              />
            </div>
            {mensajeError && (
              <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: "var(--color-critical-soft)", color: "var(--color-critical)" }}>
                <AlertCircle size={15} /> {mensajeError}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full justify-center">
              {loading ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>

          <p className="text-xs mt-6 text-center" style={{ color: "var(--color-muted)" }}>
            Las cuentas son creadas por el administrador del sistema en el módulo de Usuarios.
          </p>
        </div>
      </div>
    </div>
  );
}
