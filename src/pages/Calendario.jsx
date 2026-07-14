import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import {
  addMonths, subMonths, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarClock, GripVertical } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { AREAS } from "../lib/modules";
import { Badge, Card } from "../components/ui";

const TIPO_COLOR = { preventivo: "info", correctivo: "critical", calibracion: "warn" };
const TIPO_LABEL = { preventivo: "Preventivo", correctivo: "Correctivo", calibracion: "Calibración" };

export default function Calendario() {
  const { user } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [mes, setMes] = useState(new Date());
  const [areaFiltro, setAreaFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [detalleEvento, setDetalleEvento] = useState(null);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "ordenes_trabajo"), (s) => setEventos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const eventosConArea = useMemo(() => {
    return eventos
      .filter((e) => e.fechaProgramada)
      .map((e) => {
        const eq = equipos.find((eq) => eq.id === e.equipoId);
        return { ...e, area: eq?.area || e.area || "Sin área asignada", equipoNombre: eq?.nombre || e.equipoNombre };
      })
      .filter((e) => !areaFiltro || e.area === areaFiltro)
      .filter((e) => !tipoFiltro || e.tipo === tipoFiltro);
  }, [eventos, equipos, areaFiltro, tipoFiltro]);

  const start = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  function eventsForDay(day) {
    return eventosConArea.filter((e) => {
      try { return isSameDay(parseISO(e.fechaProgramada), day); } catch { return false; }
    });
  }

  function handleDragStart(e, evento) {
    e.dataTransfer.setData("text/plain", evento.id);
    e.dataTransfer.effectAllowed = "move";
  }

  async function handleDrop(e, day) {
    e.preventDefault();
    setDragOverDay(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const nuevaFecha = format(day, "yyyy-MM-dd");
    try {
      await updateDoc(doc(db, "ordenes_trabajo", id), { fechaProgramada: nuevaFecha });
      await logAudit({ user, accion: "editar", modulo: "calendario", entidadId: id, detalle: `Reprogramó orden a ${nuevaFecha} (arrastrar y soltar)` });
    } catch (err) {
      console.error(err);
      alert("No se pudo reprogramar el mantenimiento.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
            <CalendarClock size={19} style={{ color: "var(--color-info)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Calendario de mantenimientos por área</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Arrastra un mantenimiento a otro día para reprogramarlo</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "var(--color-line)" }}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)} className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "var(--color-line)" }}>
            <option value="">Todas las áreas</option>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {Object.entries(TIPO_LABEL).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-muted)" }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: `var(--color-${TIPO_COLOR[k]})` }} />
            {label}
          </div>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-line)" }}>
          <button onClick={() => setMes(subMonths(mes, 1))} className="p-1.5 rounded-lg hover:bg-[var(--color-paper)]"><ChevronLeft size={18} /></button>
          <h3 className="font-semibold capitalize" style={{ fontFamily: "var(--font-display)" }}>{format(mes, "MMMM yyyy", { locale: es })}</h3>
          <button onClick={() => setMes(addMonths(mes, 1))} className="p-1.5 rounded-lg hover:bg-[var(--color-paper)]"><ChevronRight size={18} /></button>
        </div>

        <div className="grid grid-cols-7 text-xs font-medium uppercase tracking-wide px-2 pt-3" style={{ color: "var(--color-muted)" }}>
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="text-center py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 p-2">
          {days.map((day) => {
            const dayEvents = eventsForDay(day);
            const inMonth = isSameMonth(day, mes);
            const isDragTarget = dragOverDay && isSameDay(day, dragOverDay);
            return (
              <div
                key={day.toISOString()}
                onDragOver={(e) => { e.preventDefault(); setDragOverDay(day); }}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={(e) => handleDrop(e, day)}
                onClick={() => setSelectedDay(day)}
                className="min-h-[86px] text-left rounded-lg border p-1.5 transition-colors cursor-pointer"
                style={{
                  borderColor: isDragTarget ? "var(--color-teal)" : isSameDay(day, selectedDay) ? "var(--color-teal)" : "var(--color-line)",
                  background: isDragTarget ? "var(--color-info-soft)" : inMonth ? "var(--color-card)" : "var(--color-paper)",
                  opacity: inMonth ? 1 : 0.5,
                  boxShadow: isToday(day) ? "inset 0 0 0 1.5px var(--color-teal-light)" : "none",
                }}
              >
                <div className="text-xs mono-tabular mb-1" style={{ color: isToday(day) ? "var(--color-teal)" : "var(--color-muted)", fontWeight: isToday(day) ? 700 : 400 }}>{format(day, "d")}</div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      draggable
                      onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, ev); }}
                      onClick={(e) => { e.stopPropagation(); setDetalleEvento(ev); }}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing"
                      style={{ background: "var(--color-" + (TIPO_COLOR[ev.tipo] || "info") + "-soft)", color: "var(--color-" + (TIPO_COLOR[ev.tipo] || "info") + ")" }}
                    >
                      <GripVertical size={9} className="shrink-0 opacity-60" />
                      <span className="truncate">{ev.equipoNombre || TIPO_LABEL[ev.tipo]}</span>
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div className="text-[10px]" style={{ color: "var(--color-muted)" }}>+{dayEvents.length - 2} más</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card>
          <h4 className="font-semibold text-sm mb-3">
            Mantenimientos del {format(selectedDay, "d 'de' MMMM", { locale: es })}
          </h4>
          {eventsForDay(selectedDay).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>No hay mantenimientos programados este día.</p>
          ) : (
            <div className="space-y-2">
              {eventsForDay(selectedDay).map((ev) => (
                <button key={ev.id} onClick={() => setDetalleEvento(ev)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left" style={{ background: "var(--color-paper)" }}>
                  <div>
                    <div className="text-sm font-medium">{ev.equipoNombre || "Equipo sin asignar"}</div>
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>{ev.area}</div>
                  </div>
                  <Badge color={TIPO_COLOR[ev.tipo] || "info"}>{TIPO_LABEL[ev.tipo] || "Programado"}</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {detalleEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,37,50,0.45)" }} onClick={() => setDetalleEvento(null)}>
          <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "var(--color-card)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <Badge color={TIPO_COLOR[detalleEvento.tipo] || "info"}>{TIPO_LABEL[detalleEvento.tipo]}</Badge>
              <span className="text-xs mono-tabular" style={{ color: "var(--color-muted)" }}>{detalleEvento.numero}</span>
            </div>
            <h4 className="font-semibold mb-1">{detalleEvento.equipoNombre || "Equipo sin asignar"}</h4>
            <p className="text-sm mb-3" style={{ color: "var(--color-muted)" }}>{detalleEvento.descripcion}</p>
            <div className="text-xs space-y-1" style={{ color: "var(--color-muted)" }}>
              <div>Área: {detalleEvento.area}</div>
              <div>Programado: {detalleEvento.fechaProgramada}</div>
              <div>Responsable: {detalleEvento.responsable || "Sin asignar"}</div>
              <div>Estado: {detalleEvento.estado}</div>
            </div>
            <p className="text-xs mt-4" style={{ color: "var(--color-muted)" }}>Ve al módulo de Órdenes de trabajo para editar el detalle completo.</p>
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
        Los eventos se generan automáticamente desde las Órdenes de trabajo con fecha programada. Este calendario se actualiza en tiempo real.
      </p>
    </div>
  );
}
