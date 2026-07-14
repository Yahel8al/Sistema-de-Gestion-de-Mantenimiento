import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { Link } from "react-router-dom";
import { addDays, isAfter, isBefore, parseISO } from "date-fns";
import { Boxes, Wrench, AlertTriangle, CalendarClock, ShieldCheck, Activity, ArrowRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { db } from "../lib/firebase";
import { EQUIPMENT_STATUS, AREAS } from "../lib/modules";
import { Card, StatCard, Badge } from "../components/ui";

const STATUS_COLORS = { activo: "#2F9E63", mantenimiento: "#D9A02A", fuera_servicio: "#D14B4B", baja: "#8A8F98" };
const ACCION_COLOR = { crear: "ok", editar: "info", eliminar: "critical", cambio_estado: "warn", login: "idle" };

function safeDate(v) { try { return v ? parseISO(v) : null; } catch { return null; } }

export default function Dashboard() {
  const [equipos, setEquipos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [actividad, setActividad] = useState([]);
  const [filtroArea, setFiltroArea] = useState("");

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "ordenes_trabajo"), (s) => setOrdenes(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const q3 = query(collection(db, "auditoria"), orderBy("fecha", "desc"), limit(8));
    const u3 = onSnapshot(q3, (s) => setActividad(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return () => { u1(); u2(); u3(); };
  }, []);

  const equiposFiltrados = useMemo(() => filtroArea ? equipos.filter((e) => e.area === filtroArea) : equipos, [equipos, filtroArea]);
  const ordenesFiltradas = useMemo(() => filtroArea ? ordenes.filter((o) => o.area === filtroArea) : ordenes, [ordenes, filtroArea]);

  const total = equiposFiltrados.length;
  const activos = equiposFiltrados.filter((e) => e.estado === "activo").length;
  const enMantenimiento = equiposFiltrados.filter((e) => e.estado === "mantenimiento").length;
  const criticosFuera = equiposFiltrados.filter((e) => e.estado === "fuera_servicio" && e.criticidad === "alta");
  const otsAbiertas = ordenesFiltradas.filter((o) => o.estado !== "finalizada").length;

  const hoy = new Date();
  const en7dias = addDays(hoy, 7);
  const proximosMantenimientos = ordenesFiltradas
    .filter((o) => {
      const f = safeDate(o.fechaProgramada);
      return f && o.estado !== "finalizada" && isAfter(f, hoy) && isBefore(f, en7dias);
    })
    .sort((a, b) => String(a.fechaProgramada).localeCompare(String(b.fechaProgramada)));

  const pieData = Object.entries(EQUIPMENT_STATUS).map(([key, v]) => ({
    name: v.label, value: equiposFiltrados.filter((e) => e.estado === key).length, key,
  }));

  const porArea = AREAS.map((area) => ({
    area: area.split(" (")[0],
    equipos: equipos.filter((e) => e.area === area).length,
  })).filter((a) => a.equipos > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {filtroArea ? `Mostrando datos de: ${filtroArea}` : "Mostrando el parque completo de equipos"}
        </p>
        <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} className="text-sm px-3 py-2 rounded-lg border w-full sm:w-64" style={{ borderColor: "var(--color-line)" }}>
          <option value="">Todas las áreas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Equipos operativos" value={total ? `${activos}/${total}` : "0/0"} sub="Activos sobre el total del parque" color="ok" icon={Boxes} />
        <StatCard label="En mantenimiento" value={enMantenimiento} sub="Equipos actualmente intervenidos" color="warn" icon={Wrench} />
        <StatCard label="Críticos fuera de servicio" value={criticosFuera.length} sub="Riesgo alto sin disponibilidad" color="critical" icon={AlertTriangle} />
        <StatCard label="Órdenes de trabajo abiertas" value={otsAbiertas} sub="Pendientes, asignadas o en proceso" color="info" icon={CalendarClock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <h3 className="font-semibold mb-4 text-sm" style={{ fontFamily: "var(--font-display)" }}>Estado del parque de equipos</h3>
          {total === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--color-muted)" }}>Registra equipos en el módulo de Inventario para ver este gráfico.</p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {pieData.map((entry) => <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {pieData.map((d) => <Badge key={d.key} color={EQUIPMENT_STATUS[d.key].color}>{d.name}: {d.value}</Badge>)}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="font-semibold mb-4 text-sm" style={{ fontFamily: "var(--font-display)" }}>Equipos por área / servicio</h3>
          {porArea.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--color-muted)" }}>Aún no hay equipos asignados a un área.</p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={porArea}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="area" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="equipos" fill="var(--color-teal)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} style={{ color: "var(--color-critical)" }} />
            <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>Equipos críticos fuera de servicio</h3>
          </div>
          {criticosFuera.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>No hay equipos críticos fuera de servicio en este momento.</p>
          ) : (
            <div className="space-y-2">
              {criticosFuera.map((eq) => (
                <div key={eq.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--color-critical-soft)" }}>
                  <div>
                    <div className="text-sm font-medium">{eq.nombre}</div>
                    <div className="text-xs mono-tabular" style={{ color: "var(--color-muted)" }}>{eq.codigo} · {eq.area}</div>
                  </div>
                  <Badge color="critical" dot>Fuera de servicio</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} style={{ color: "var(--color-teal)" }} />
              <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>Mantenimientos programados esta semana</h3>
            </div>
            <Link to="/calendario" className="text-xs font-medium inline-flex items-center gap-1" style={{ color: "var(--color-teal)" }}>
              Ver calendario <ArrowRight size={12} />
            </Link>
          </div>
          {proximosMantenimientos.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>No hay mantenimientos programados en los próximos 7 días.</p>
          ) : (
            <div className="space-y-2">
              {proximosMantenimientos.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--color-paper)" }}>
                  <div>
                    <div className="text-sm font-medium">{o.equipoNombre || o.numero}</div>
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>{o.area}</div>
                  </div>
                  <span className="text-xs mono-tabular" style={{ color: "var(--color-muted)" }}>{o.fechaProgramada}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} style={{ color: "var(--color-teal)" }} />
            <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>Cumplimiento del plan anual de mantenimiento</h3>
          </div>
          <p className="text-sm mb-3" style={{ color: "var(--color-muted)" }}>
            Se calcula sobre la disponibilidad de equipos activos frente al total del parque.
          </p>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "var(--color-paper)" }}>
            <div className="h-full rounded-full" style={{ width: total ? `${Math.round((activos / total) * 100)}%` : "0%", background: "var(--color-teal)" }} />
          </div>
          <div className="text-right text-xs mt-1 mono-tabular" style={{ color: "var(--color-muted)" }}>
            {total ? Math.round((activos / total) * 100) : 0}% de disponibilidad operativa
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} style={{ color: "var(--color-teal)" }} />
            <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>Actividad reciente</h3>
          </div>
          {actividad.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Todavía no hay actividad registrada en el sistema.</p>
          ) : (
            <div className="space-y-2">
              {actividad.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge color={ACCION_COLOR[a.accion] || "idle"}>{a.accion}</Badge>
                    <span className="truncate" style={{ color: "var(--color-muted)" }}>{a.detalle || a.modulo}</span>
                  </div>
                  <span className="text-xs mono-tabular shrink-0 ml-2" style={{ color: "var(--color-muted)" }}>
                    {a.fecha?.toDate ? a.fecha.toDate().toLocaleDateString("es-ES") : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
