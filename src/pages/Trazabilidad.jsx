import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { ScrollText, Search } from "lucide-react";
import { db } from "../lib/firebase";
import { Badge, Card, EmptyState } from "../components/ui";

const ACCION_COLOR = { crear: "ok", editar: "info", eliminar: "critical", cambio_estado: "warn", login: "idle" };

export default function Trazabilidad() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "auditoria"), orderBy("fecha", "desc"), limit(300));
    const unsub = onSnapshot(q, (s) => { setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const s = search.toLowerCase();
    return logs.filter((l) => [l.usuarioNombre, l.modulo, l.detalle, l.accion].some((v) => String(v || "").toLowerCase().includes(s)));
  }, [logs, search]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
          <ScrollText size={19} style={{ color: "var(--color-info)" }} />
        </div>
        <div>
          <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Trazabilidad y auditoría</h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Registro de solo lectura: usuario, fecha/hora y acción realizada en cada módulo</p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--color-line)" }}>
          <Search size={15} style={{ color: "var(--color-muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por usuario, módulo o acción..." className="flex-1 outline-none text-sm bg-transparent" />
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>{filtered.length} eventos</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ScrollText} title="Sin actividad registrada" description="Cada creación, edición o eliminación en el sistema quedará registrada automáticamente aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {["Fecha", "Usuario", "Acción", "Módulo", "Detalle"].map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                    <td className="px-4 py-2.5 mono-tabular text-xs whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                      {l.fecha?.toDate ? l.fecha.toDate().toLocaleString("es-ES") : "—"}
                    </td>
                    <td className="px-4 py-2.5">{l.usuarioNombre}</td>
                    <td className="px-4 py-2.5"><Badge color={ACCION_COLOR[l.accion] || "idle"}>{l.accion}</Badge></td>
                    <td className="px-4 py-2.5 capitalize">{l.modulo}</td>
                    <td className="px-4 py-2.5" style={{ color: "var(--color-muted)" }}>{l.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
