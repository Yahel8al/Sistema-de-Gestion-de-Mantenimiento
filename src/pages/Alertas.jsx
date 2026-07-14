import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { addDays, isBefore, isAfter, parseISO } from "date-fns";
import { BellRing, CalendarClock, BadgeCheck, FileText, PackageSearch, AlertTriangle } from "lucide-react";
import { db } from "../lib/firebase";
import { Badge, Card, EmptyState } from "../components/ui";

function safeDate(v) { try { return v ? parseISO(v) : null; } catch { return null; } }

export default function Alertas() {
  const [ordenes, setOrdenes] = useState([]);
  const [calibraciones, setCalibraciones] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [repuestos, setRepuestos] = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "ordenes_trabajo"), (s) => setOrdenes(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "calibraciones"), (s) => setCalibraciones(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "documentos"), (s) => setDocumentos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, "repuestos"), (s) => setRepuestos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const hoy = new Date();
  const en7dias = addDays(hoy, 7);
  const en30dias = addDays(hoy, 30);

  const proximos = ordenes.filter((o) => {
    const f = safeDate(o.fechaProgramada);
    return f && o.estado !== "finalizada" && isAfter(f, hoy) && isBefore(f, en7dias);
  });
  const vencidos = ordenes.filter((o) => {
    const f = safeDate(o.fechaProgramada);
    return f && o.estado !== "finalizada" && isBefore(f, hoy);
  });
  const calibracionesPendientes = calibraciones.filter((c) => {
    const f = safeDate(c.fechaVencimiento);
    return f && isBefore(f, en30dias);
  });
  const garantiasPorVencer = documentos.filter((d) => {
    const f = safeDate(d.vigencia);
    return f && (d.tipo === "garantia" || d.tipo === "contrato") && isBefore(f, en30dias);
  });
  const stockBajo = repuestos.filter((r) => Number(r.stockActual) <= Number(r.stockMinimo || 0));

  const groups = [
    { title: "Mantenimientos vencidos", icon: AlertTriangle, color: "critical", items: vencidos.map((o) => ({ label: o.equipoNombre || o.numero, detail: `Programado: ${o.fechaProgramada}` })) },
    { title: "Mantenimientos próximos (7 días)", icon: CalendarClock, color: "warn", items: proximos.map((o) => ({ label: o.equipoNombre || o.numero, detail: `Programado: ${o.fechaProgramada}` })) },
    { title: "Calibraciones pendientes o vencidas (30 días)", icon: BadgeCheck, color: "warn", items: calibracionesPendientes.map((c) => ({ label: c.laboratorio || "Calibración", detail: `Vence: ${c.fechaVencimiento}` })) },
    { title: "Garantías y contratos por vencer (30 días)", icon: FileText, color: "info", items: garantiasPorVencer.map((d) => ({ label: d.titulo, detail: `Vence: ${d.vigencia}` })) },
    { title: "Bajo inventario de repuestos", icon: PackageSearch, color: "critical", items: stockBajo.map((r) => ({ label: r.nombre, detail: `Stock: ${r.stockActual ?? 0} / mínimo ${r.stockMinimo ?? 0}` })) },
  ];

  const totalAlertas = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-warn-soft)" }}>
          <BellRing size={19} style={{ color: "var(--color-warn)" }} />
        </div>
        <div>
          <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Alertas y notificaciones</h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>{totalAlertas} alertas activas generadas automáticamente</p>
        </div>
      </div>

      {totalAlertas === 0 ? (
        <Card><EmptyState icon={BellRing} title="Todo en orden" description="No hay vencimientos ni alertas activas por ahora. Vuelve cuando registres más equipos, calibraciones o repuestos." /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.filter((g) => g.items.length > 0).map((g) => (
            <Card key={g.title}>
              <div className="flex items-center gap-2 mb-3">
                <g.icon size={16} style={{ color: `var(--color-${g.color})` }} />
                <h3 className="font-semibold text-sm">{g.title}</h3>
                <Badge color={g.color}>{g.items.length}</Badge>
              </div>
              <div className="space-y-2">
                {g.items.slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ background: "var(--color-paper)" }}>
                    <span className="font-medium">{item.label}</span>
                    <span style={{ color: "var(--color-muted)" }} className="text-xs">{item.detail}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
