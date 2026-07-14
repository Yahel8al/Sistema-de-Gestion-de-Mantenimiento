import { useEffect, useMemo, useState } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { addMonths, format, isBefore, addDays, parseISO } from "date-fns";
import { Wrench, Plus, Pencil, Trash2, CalendarPlus, CheckSquare, Square, X } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { getNextOrderNumber } from "../lib/counters";
import { Badge, Button, Card, Modal, EmptyState } from "../components/ui";

const FRECUENCIAS = [
  { value: "mensual", label: "Mensual", meses: 1 },
  { value: "trimestral", label: "Trimestral", meses: 3 },
  { value: "semestral", label: "Semestral", meses: 6 },
  { value: "anual", label: "Anual", meses: 12 },
];

const emptyForm = {
  equipoId: "", planFabricante: "", frecuencia: "mensual", ultimaFecha: "",
  proximaFecha: "", tecnicoResponsable: "", tiempoEmpleadoHoras: "",
  actividadesRealizadas: "", evidenciaUrl: "", checklist: [],
};

function calcularProxima(ultimaFecha, frecuencia) {
  if (!ultimaFecha) return "";
  const meses = FRECUENCIAS.find((f) => f.value === frecuencia)?.meses || 1;
  try {
    return format(addMonths(parseISO(ultimaFecha), meses), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

function estadoDePlan(proximaFecha) {
  if (!proximaFecha) return { label: "Sin programar", color: "idle" };
  const hoy = new Date();
  const fecha = parseISO(proximaFecha);
  if (isBefore(fecha, hoy)) return { label: "Vencido", color: "critical" };
  if (isBefore(fecha, addDays(hoy, 15))) return { label: "Próximo", color: "warn" };
  return { label: "Vigente", color: "ok" };
}

export default function Preventivos() {
  const { user } = useAuth();
  const [equipos, setEquipos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [nuevoItemChecklist, setNuevoItemChecklist] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const q = query(collection(db, "mantenimientos_preventivos"), orderBy("creadoEn", "desc"));
    const u2 = onSnapshot(q, (s) => { setPlanes(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    return () => { u1(); u2(); };
  }, []);

  const filtrados = useMemo(() => {
    if (!filtroEstado) return planes;
    return planes.filter((p) => estadoDePlan(p.proximaFecha).label === filtroEstado);
  }, [planes, filtroEstado]);

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p) {
    setForm({ ...emptyForm, ...p, checklist: p.checklist || [] });
    setEditing(p);
    setModalOpen(true);
  }

  function handleUltimaFechaChange(v) {
    setForm((f) => ({ ...f, ultimaFecha: v, proximaFecha: calcularProxima(v, f.frecuencia) }));
  }
  function handleFrecuenciaChange(v) {
    setForm((f) => ({ ...f, frecuencia: v, proximaFecha: calcularProxima(f.ultimaFecha, v) }));
  }

  function addChecklistItem() {
    if (!nuevoItemChecklist.trim()) return;
    setForm((f) => ({ ...f, checklist: [...f.checklist, { texto: nuevoItemChecklist.trim(), hecho: false }] }));
    setNuevoItemChecklist("");
  }
  function toggleChecklistItem(idx) {
    setForm((f) => ({ ...f, checklist: f.checklist.map((it, i) => (i === idx ? { ...it, hecho: !it.hecho } : it)) }));
  }
  function removeChecklistItem(idx) {
    setForm((f) => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const equipo = equipos.find((eq) => eq.id === form.equipoId);
    const payload = { ...form, equipoNombre: equipo?.nombre || "", area: equipo?.area || "" };
    delete payload.id;
    try {
      if (editing) {
        await updateDoc(doc(db, "mantenimientos_preventivos", editing.id), { ...payload, actualizadoEn: serverTimestamp() });
        await logAudit({ user, accion: "editar", modulo: "preventivos", entidadId: editing.id, detalle: `Editó plan preventivo de ${equipo?.nombre || ""}` });
      } else {
        const ref = await addDoc(collection(db, "mantenimientos_preventivos"), { ...payload, creadoEn: serverTimestamp() });
        await logAudit({ user, accion: "crear", modulo: "preventivos", entidadId: ref.id, detalle: `Creó plan preventivo de ${equipo?.nombre || ""}` });
      }
      setModalOpen(false);
    } catch (err) { console.error(err); alert("No se pudo guardar el plan preventivo."); }
  }

  async function handleDelete(p) {
    await deleteDoc(doc(db, "mantenimientos_preventivos", p.id));
    await logAudit({ user, accion: "eliminar", modulo: "preventivos", entidadId: p.id, detalle: `Eliminó plan preventivo de ${p.equipoNombre || ""}` });
    setConfirmDelete(null);
  }

  async function generarOrden(p) {
    try {
      const numero = await getNextOrderNumber();
      const ref = await addDoc(collection(db, "ordenes_trabajo"), {
        numero,
        tipo: "preventivo",
        equipoId: p.equipoId,
        equipoNombre: p.equipoNombre,
        area: p.area,
        descripcion: `Mantenimiento preventivo (${p.frecuencia}): ${p.planFabricante || "Plan según fabricante"}`,
        prioridad: "media",
        responsable: p.tecnicoResponsable || "",
        fechaProgramada: p.proximaFecha || "",
        estado: "pendiente",
        origenTipo: "preventivo",
        origenId: p.id,
        creadoEn: serverTimestamp(),
      });
      await logAudit({ user, accion: "crear", modulo: "ordenes", entidadId: ref.id, detalle: `Orden generada automáticamente desde plan preventivo de ${p.equipoNombre}` });
      alert(`Orden de trabajo generada para ${p.equipoNombre}. Consúltala en Órdenes de trabajo.`);
    } catch (err) { console.error(err); alert("No se pudo generar la orden de trabajo."); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
            <Wrench size={19} style={{ color: "var(--color-info)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Mantenimientos preventivos</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Planes según fabricante, checklist y calendario automático por frecuencia</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo plan</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "Vencido", "Próximo", "Vigente", "Sin programar"].map((f) => (
          <button
            key={f || "todos"}
            onClick={() => setFiltroEstado(f)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border"
            style={{
              background: filtroEstado === f ? "var(--color-teal)" : "var(--color-card)",
              color: filtroEstado === f ? "#fff" : "var(--color-ink)",
              borderColor: filtroEstado === f ? "var(--color-teal)" : "var(--color-line)",
            }}
          >
            {f || "Todos"}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</div>
        ) : filtrados.length === 0 ? (
          <EmptyState icon={Wrench} title="Sin planes preventivos" description="Crea un plan de mantenimiento preventivo para un equipo, con su frecuencia y checklist." action={<Button onClick={openCreate}><Plus size={16} /> Nuevo plan</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {["Equipo", "Frecuencia", "Técnico", "Última", "Próxima", "Estado", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const st = estadoDePlan(p.proximaFecha);
                  const checklistDone = (p.checklist || []).filter((c) => c.hecho).length;
                  return (
                    <tr key={p.id} className="border-t align-top" style={{ borderColor: "var(--color-line)" }}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.equipoNombre || "—"}</div>
                        {p.checklist?.length > 0 && <div className="text-xs" style={{ color: "var(--color-muted)" }}>Checklist: {checklistDone}/{p.checklist.length}</div>}
                      </td>
                      <td className="px-4 py-3">{FRECUENCIAS.find((f) => f.value === p.frecuencia)?.label}</td>
                      <td className="px-4 py-3">{p.tecnicoResponsable || "—"}</td>
                      <td className="px-4 py-3 mono-tabular text-xs">{p.ultimaFecha || "—"}</td>
                      <td className="px-4 py-3 mono-tabular text-xs">{p.proximaFecha || "—"}</td>
                      <td className="px-4 py-3"><Badge color={st.color} dot={st.color !== "idle"}>{st.label}</Badge></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => generarOrden(p)} title="Generar orden de trabajo" className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><CalendarPlus size={15} style={{ color: "var(--color-teal)" }} /></button>
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Pencil size={14} style={{ color: "var(--color-muted)" }} /></button>
                        <button onClick={() => setConfirmDelete(p)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Trash2 size={14} style={{ color: "var(--color-critical)" }} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar plan preventivo" : "Nuevo plan preventivo"} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Equipo *</label>
              <select required value={form.equipoId} onChange={(e) => setForm({ ...form, equipoId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                <option value="">Seleccionar equipo…</option>
                {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.codigo} — {eq.nombre}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Plan según fabricante</label>
              <input value={form.planFabricante} onChange={(e) => setForm({ ...form, planFabricante: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Frecuencia</label>
              <select value={form.frecuencia} onChange={(e) => handleFrecuenciaChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                {FRECUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Técnico responsable</label>
              <input value={form.tecnicoResponsable} onChange={(e) => setForm({ ...form, tecnicoResponsable: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Última fecha realizada</label>
              <input type="date" value={form.ultimaFecha} onChange={(e) => handleUltimaFechaChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Próxima fecha (calculada automáticamente)</label>
              <input type="date" value={form.proximaFecha} onChange={(e) => setForm({ ...form, proximaFecha: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm mono-tabular" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Tiempo empleado (horas)</label>
              <input type="number" value={form.tiempoEmpleadoHoras} onChange={(e) => setForm({ ...form, tiempoEmpleadoHoras: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Lista de verificación (checklist)</label>
            <div className="space-y-1.5 mb-2">
              {form.checklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "var(--color-paper)" }}>
                  <button type="button" onClick={() => toggleChecklistItem(idx)}>
                    {item.hecho ? <CheckSquare size={16} style={{ color: "var(--color-ok)" }} /> : <Square size={16} style={{ color: "var(--color-muted)" }} />}
                  </button>
                  <span className={`flex-1 text-sm ${item.hecho ? "line-through" : ""}`} style={{ color: item.hecho ? "var(--color-muted)" : "var(--color-ink)" }}>{item.texto}</span>
                  <button type="button" onClick={() => removeChecklistItem(idx)}><X size={14} style={{ color: "var(--color-critical)" }} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={nuevoItemChecklist}
                onChange={(e) => setNuevoItemChecklist(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                placeholder="Ej: Verificar continuidad eléctrica…"
                className="flex-1 px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "var(--color-line)" }}
              />
              <Button type="button" variant="ghost" onClick={addChecklistItem}>Agregar ítem</Button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Actividades realizadas</label>
            <textarea rows={2} value={form.actividadesRealizadas} onChange={(e) => setForm({ ...form, actividadesRealizadas: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Evidencia (enlace a foto o documento)</label>
            <input value={form.evidenciaUrl} onChange={(e) => setForm({ ...form, evidenciaUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Crear plan"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar plan preventivo" width="max-w-sm">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>Se eliminará el plan de <strong>{confirmDelete?.equipoNombre}</strong> de forma permanente.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
