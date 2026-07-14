import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Gauge } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "../lib/firebase";
import { StatCard, Card } from "../components/ui";

export default function KPIs() {
  const [equipos, setEquipos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [correctivos, setCorrectivos] = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "ordenes_trabajo"), (s) => setOrdenes(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "mantenimientos_correctivos"), (s) => setCorrectivos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); };
  }, []);

  const preventivas = ordenes.filter((o) => o.tipo === "preventivo");
  const preventivasFinalizadas = preventivas.filter((o) => o.estado === "finalizada");
  const cumplimientoPreventivo = preventivas.length ? Math.round((preventivasFinalizadas.length / preventivas.length) * 100) : 0;

  const activos = equipos.filter((e) => e.estado === "activo").length;
  const disponibilidad = equipos.length ? Math.round((activos / equipos.length) * 100) : 0;

  const downtimes = correctivos.map((c) => Number(c.downtimeHoras || 0)).filter((n) => n > 0);
  const mttr = downtimes.length ? (downtimes.reduce((a, b) => a + b, 0) / downtimes.length).toFixed(1) : "0";

  // MTBF aproximado: horas del período (asumiendo 720h/mes) * equipos / número de fallas registradas
  const totalFallas = correctivos.length;
  const mtbf = totalFallas ? Math.round((720 * (equipos.length || 1)) / totalFallas) : "—";

  const costoTotal = correctivos.reduce((acc, c) => acc + Number(c.costo || 0), 0);

  const fallasPorEquipo = useMemo(() => {
    const counts = {};
    correctivos.forEach((c) => {
      const eq = equipos.find((e) => e.id === c.equipoId);
      const nombre = eq?.nombre || "Sin identificar";
      counts[nombre] = (counts[nombre] || 0) + 1;
    });
    return Object.entries(counts).map(([nombre, fallas]) => ({ nombre, fallas })).sort((a, b) => b.fallas - a.fallas).slice(0, 8);
  }, [correctivos, equipos]);

  const productividadTecnicos = useMemo(() => {
    const counts = {};
    ordenes.filter((o) => o.estado === "finalizada" && o.responsable).forEach((o) => {
      counts[o.responsable] = (counts[o.responsable] || 0) + 1;
    });
    return Object.entries(counts).map(([tecnico, ordenes]) => ({ tecnico, ordenes })).sort((a, b) => b.ordenes - a.ordenes).slice(0, 8);
  }, [ordenes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
          <Gauge size={19} style={{ color: "var(--color-info)" }} />
        </div>
        <div>
          <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Indicadores (KPIs)</h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Calculados en tiempo real a partir de las órdenes y correctivos registrados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Cumplimiento preventivo" value={`${cumplimientoPreventivo}%`} sub="OTs preventivas finalizadas / programadas" color="ok" />
        <StatCard label="Disponibilidad de equipos" value={`${disponibilidad}%`} sub="Equipos activos sobre el total" color="info" />
        <StatCard label="MTBF (aprox.)" value={mtbf === "—" ? "—" : `${mtbf} h`} sub="Tiempo medio entre fallas" color="warn" />
        <StatCard label="MTTR" value={`${mttr} h`} sub="Tiempo medio de reparación" color="critical" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Costo acumulado en correctivos" value={`$${costoTotal.toLocaleString("es-ES")}`} sub="Suma de reparaciones registradas" color="critical" />
        <StatCard label="Fallas totales registradas" value={totalFallas} sub="Mantenimientos correctivos en el sistema" color="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: "var(--font-display)" }}>Equipos con más fallas</h3>
          {fallasPorEquipo.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--color-muted)" }}>Aún no hay correctivos registrados.</p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={fallasPorEquipo} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="fallas" fill="var(--color-critical)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold text-sm mb-3" style={{ fontFamily: "var(--font-display)" }}>Productividad de técnicos</h3>
          {productividadTecnicos.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--color-muted)" }}>Aún no hay órdenes finalizadas con técnico asignado.</p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={productividadTecnicos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="tecnico" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="ordenes" fill="var(--color-teal)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
