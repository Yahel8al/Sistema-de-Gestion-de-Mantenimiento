import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileBarChart, Download } from "lucide-react";
import { db } from "../lib/firebase";
import { EQUIPMENT_STATUS, AREAS } from "../lib/modules";
import { Badge, Button, Card } from "../components/ui";

const REPORTES = [
  { key: "por_servicio", label: "Equipos por servicio" },
  { key: "por_estado", label: "Equipos por estado" },
  { key: "fuera_servicio", label: "Equipos fuera de servicio" },
  { key: "pendientes", label: "Mantenimientos pendientes" },
  { key: "costos_equipo", label: "Costos por equipo" },
  { key: "costos_periodo", label: "Costos de correctivos por período" },
  { key: "calibraciones_vencidas", label: "Calibraciones vencidas o por vencer" },
  { key: "indicadores", label: "Indicadores gerenciales" },
];

export default function Reportes() {
  const [equipos, setEquipos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [correctivos, setCorrectivos] = useState([]);
  const [calibraciones, setCalibraciones] = useState([]);
  const [activo, setActivo] = useState("por_servicio");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "ordenes_trabajo"), (s) => setOrdenes(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, "mantenimientos_correctivos"), (s) => setCorrectivos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, "calibraciones"), (s) => setCalibraciones(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const correctivosFiltrados = useMemo(() => {
    if (!desde && !hasta) return correctivos;
    return correctivos.filter((c) => {
      const f = c.fechaFalla?.slice(0, 10);
      if (!f) return true;
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }, [correctivos, desde, hasta]);

  const data = useMemo(() => {
    switch (activo) {
      case "por_servicio":
        return AREAS.map((a) => ({ Área: a, Equipos: equipos.filter((e) => e.area === a).length })).filter((r) => r.Equipos > 0);
      case "por_estado":
        return Object.entries(EQUIPMENT_STATUS).map(([k, v]) => ({ Estado: v.label, Equipos: equipos.filter((e) => e.estado === k).length }));
      case "fuera_servicio":
        return equipos.filter((e) => e.estado === "fuera_servicio").map((e) => ({ Código: e.codigo, Equipo: e.nombre, Área: e.area, Criticidad: e.criticidad }));
      case "pendientes":
        return ordenes.filter((o) => o.estado !== "finalizada").map((o) => ({ Orden: o.numero, Equipo: o.equipoNombre, Estado: o.estado, "Fecha programada": o.fechaProgramada }));
      case "costos_equipo": {
        const porEquipo = {};
        correctivosFiltrados.forEach((c) => {
          const nombre = equipos.find((e) => e.id === c.equipoId)?.nombre || "Sin identificar";
          porEquipo[nombre] = (porEquipo[nombre] || 0) + Number(c.costo || 0);
        });
        return Object.entries(porEquipo).map(([Equipo, Costo]) => ({ Equipo, "Costo acumulado": `$${Costo.toLocaleString("es-ES")}` }));
      }
      case "costos_periodo":
        return correctivosFiltrados.map((c) => ({ Equipo: equipos.find((e) => e.id === c.equipoId)?.nombre || "—", Fecha: c.fechaFalla?.slice(0, 10) || "—", Costo: `$${Number(c.costo || 0).toLocaleString("es-ES")}`, "Causa raíz": c.causaRaiz || "—" }));
      case "calibraciones_vencidas":
        return calibraciones.filter((c) => c.fechaVencimiento).map((c) => ({ Equipo: equipos.find((e) => e.id === c.equipoId)?.nombre || "—", Laboratorio: c.laboratorio, Vence: c.fechaVencimiento }));
      case "indicadores": {
        const activos = equipos.filter((e) => e.estado === "activo").length;
        const preventivas = ordenes.filter((o) => o.tipo === "preventivo");
        const finalizadas = preventivas.filter((o) => o.estado === "finalizada");
        return [
          { Indicador: "Disponibilidad de equipos", Valor: equipos.length ? `${Math.round((activos / equipos.length) * 100)}%` : "0%" },
          { Indicador: "Cumplimiento preventivo", Valor: preventivas.length ? `${Math.round((finalizadas.length / preventivas.length) * 100)}%` : "0%" },
          { Indicador: "Total de correctivos", Valor: correctivos.length },
          { Indicador: "Costo total en correctivos", Valor: `$${correctivos.reduce((a, c) => a + Number(c.costo || 0), 0).toLocaleString("es-ES")}` },
        ];
      }
      default:
        return [];
    }
  }, [activo, equipos, ordenes, correctivosFiltrados, correctivos, calibraciones]);

  const columnas = data.length ? Object.keys(data[0]) : [];

  function exportarPDF() {
    const reporte = REPORTES.find((r) => r.key === activo);
    const pdfDoc = new jsPDF();
    pdfDoc.setFontSize(14);
    pdfDoc.text(`Pulso CMMS — ${reporte.label}`, 14, 16);
    pdfDoc.setFontSize(9);
    pdfDoc.setTextColor(100);
    pdfDoc.text(`Generado el ${new Date().toLocaleString("es-ES")}`, 14, 22);
    if (data.length === 0) {
      pdfDoc.text("No hay datos disponibles para este reporte.", 14, 32);
    } else {
      autoTable(pdfDoc, {
        startY: 28,
        head: [columnas],
        body: data.map((row) => columnas.map((c) => String(row[c] ?? "—"))),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [14, 124, 134] },
      });
    }
    pdfDoc.save(`reporte-${activo}.pdf`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
          <FileBarChart size={19} style={{ color: "var(--color-info)" }} />
        </div>
        <div>
          <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Reportes e indicadores</h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Genera y exporta reportes gerenciales en PDF</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORTES.map((r) => (
          <button key={r.key} onClick={() => setActivo(r.key)} className="px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ background: activo === r.key ? "var(--color-teal)" : "var(--color-card)", color: activo === r.key ? "#fff" : "var(--color-ink)", borderColor: activo === r.key ? "var(--color-teal)" : "var(--color-line)" }}>
            {r.label}
          </button>
        ))}
      </div>

      {(activo === "costos_equipo" || activo === "costos_periodo") && (
        <Card className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>
          {(desde || hasta) && <Button variant="ghost" onClick={() => { setDesde(""); setHasta(""); }}>Limpiar filtro</Button>}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-line)" }}>
          <h3 className="font-semibold text-sm">{REPORTES.find((r) => r.key === activo)?.label}</h3>
          <Button variant="ghost" onClick={exportarPDF}><Download size={15} /> Exportar a PDF</Button>
        </div>
        {data.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>No hay datos suficientes para este reporte todavía.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {columnas.map((c) => <th key={c} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                    {columnas.map((c) => <td key={c} className="px-4 py-2.5">{String(row[c] ?? "—")}</td>)}
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
