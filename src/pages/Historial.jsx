import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { History, Wrench, Siren, BadgeCheck, FileWarning, ClipboardList, FileText, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../lib/firebase";
import { EQUIPMENT_STATUS } from "../lib/modules";
import { Badge, Button, Card, EmptyState } from "../components/ui";

export default function Historial() {
  const [equipos, setEquipos] = useState([]);
  const [preventivos, setPreventivos] = useState([]);
  const [correctivos, setCorrectivos] = useState([]);
  const [calibraciones, setCalibraciones] = useState([]);
  const [incidencias, setIncidencias] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [seleccionado, setSeleccionado] = useState("");

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "mantenimientos_preventivos"), (s) => setPreventivos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "mantenimientos_correctivos"), (s) => setCorrectivos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, "calibraciones"), (s) => setCalibraciones(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u5 = onSnapshot(collection(db, "incidencias"), (s) => setIncidencias(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u6 = onSnapshot(collection(db, "ordenes_trabajo"), (s) => setOrdenes(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  const equipo = equipos.find((e) => e.id === seleccionado);
  const correctivosEquipo = correctivos.filter((c) => c.equipoId === seleccionado);
  const preventivosEquipo = preventivos.filter((p) => p.equipoId === seleccionado);
  const costoCorrectivos = correctivosEquipo.reduce((acc, c) => acc + Number(c.costo || 0), 0);
  const horasPreventivos = preventivosEquipo.reduce((acc, p) => acc + Number(p.tiempoEmpleadoHoras || 0), 0);
  const downtimeTotal = correctivosEquipo.reduce((acc, c) => acc + Number(c.downtimeHoras || 0), 0);

  const linea = equipo ? [
    ...preventivosEquipo.map((p) => ({ tipo: "Preventivo", icon: Wrench, color: "info", fecha: p.proximaFecha, detalle: p.actividadesRealizadas || p.planFabricante || "Mantenimiento preventivo" })),
    ...correctivosEquipo.map((c) => ({ tipo: "Correctivo", icon: Siren, color: "critical", fecha: c.creadoEn?.toDate ? c.creadoEn.toDate().toISOString().slice(0, 10) : "", detalle: c.fallaReportada })),
    ...calibraciones.filter((c) => c.equipoId === seleccionado).map((c) => ({ tipo: "Calibración", icon: BadgeCheck, color: "warn", fecha: c.fechaCalibracion, detalle: `${c.laboratorio || "Laboratorio"} · vence ${c.fechaVencimiento || "—"}` })),
    ...incidencias.filter((i) => i.equipoId === seleccionado).map((i) => ({ tipo: "Incidencia", icon: FileWarning, color: "critical", fecha: i.fechaEvento, detalle: i.descripcionEvento })),
    ...ordenes.filter((o) => o.equipoId === seleccionado).map((o) => ({ tipo: "Orden de trabajo", icon: ClipboardList, color: "idle", fecha: o.fechaProgramada, detalle: `${o.numero} · ${o.estado}${o.firmaTecnico ? ` · firmada por ${o.firmaTecnico}` : ""}` })),
  ].sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || ""))) : [];

  function exportarPDF() {
    if (!equipo) return;
    const pdfDoc = new jsPDF();
    pdfDoc.setFontSize(14);
    pdfDoc.text(`Historial del equipo — ${equipo.nombre}`, 14, 16);
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(100);
    pdfDoc.text(`${equipo.codigo} · ${equipo.marca || ""} ${equipo.modelo || ""} · ${equipo.area || ""}`, 14, 22);
    pdfDoc.text(`Estado: ${EQUIPMENT_STATUS[equipo.estado]?.label || equipo.estado} · Costo acumulado en correctivos: $${costoCorrectivos.toLocaleString("es-ES")}`, 14, 27);

    autoTable(pdfDoc, {
      startY: 33,
      head: [["Tipo", "Fecha", "Detalle"]],
      body: linea.map((ev) => [ev.tipo, ev.fecha || "—", ev.detalle || "—"]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [14, 124, 134] },
    });

    pdfDoc.save(`historial-${equipo.codigo || equipo.id}.pdf`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
          <History size={19} style={{ color: "var(--color-info)" }} />
        </div>
        <div>
          <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Historial del equipo</h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Mantenimientos, reparaciones, calibraciones, órdenes e incidencias por equipo</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Selecciona un equipo</label>
            <select value={seleccionado} onChange={(e) => setSeleccionado(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
              <option value="">Seleccionar equipo…</option>
              {equipos.map((e) => <option key={e.id} value={e.id}>{e.codigo} — {e.nombre}</option>)}
            </select>
          </div>
          {equipo && <Button variant="ghost" onClick={exportarPDF}><Download size={15} /> Exportar historial a PDF</Button>}
        </div>
      </Card>

      {!equipo ? (
        <Card><EmptyState icon={History} title="Selecciona un equipo" description="Elige un equipo del inventario para ver su historial completo de mantenimientos, calibraciones e incidencias." /></Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{equipo.nombre}</h3>
                <p className="text-xs mono-tabular" style={{ color: "var(--color-muted)" }}>{equipo.codigo} · {equipo.marca} {equipo.modelo} · {equipo.area}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={EQUIPMENT_STATUS[equipo.estado]?.color || "idle"} dot>{EQUIPMENT_STATUS[equipo.estado]?.label}</Badge>
                {equipo.hojaVidaUrl ? (
                  <a href={equipo.hojaVidaUrl} target="_blank" rel="noreferrer">
                    <Badge color="info"><FileText size={12} /> Ver hoja de vida</Badge>
                  </a>
                ) : (
                  <Badge color="idle">Sin hoja de vida cargada</Badge>
                )}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Costos acumulados (correctivos)</div>
              <div className="text-2xl mono-tabular font-semibold">${costoCorrectivos.toLocaleString("es-ES")}</div>
            </Card>
            <Card>
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Horas invertidas en preventivos</div>
              <div className="text-2xl mono-tabular font-semibold">{horasPreventivos} h</div>
            </Card>
            <Card>
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Tiempo total fuera de servicio</div>
              <div className="text-2xl mono-tabular font-semibold">{downtimeTotal} h</div>
            </Card>
          </div>

          <Card>
            <h4 className="font-semibold text-sm mb-4">Línea de tiempo</h4>
            {linea.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>Este equipo aún no tiene eventos registrados.</p>
            ) : (
              <div className="space-y-3">
                {linea.map((ev, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `var(--color-${ev.color}-soft)` }}>
                      <ev.icon size={14} style={{ color: `var(--color-${ev.color})` }} />
                    </div>
                    <div className="flex-1 pb-3 border-b" style={{ borderColor: "var(--color-line)" }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{ev.tipo}</span>
                        <span className="text-xs mono-tabular" style={{ color: "var(--color-muted)" }}>{ev.fecha || "Sin fecha"}</span>
                      </div>
                      <p className="text-sm" style={{ color: "var(--color-muted)" }}>{ev.detalle}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
