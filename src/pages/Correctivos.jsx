import { useEffect, useState } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { differenceInHours, parseISO } from "date-fns";
import { Siren, Plus, Pencil, Trash2, CalendarPlus } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { getNextOrderNumber } from "../lib/counters";
import { Badge, Button, Card, Modal, EmptyState } from "../components/ui";

const PRIORIDADES = [{ value: "alta", label: "Alta" }, { value: "media", label: "Media" }, { value: "baja", label: "Baja" }];
const ESTADOS = [
  { value: "abierta", label: "Abierta", color: "critical" },
  { value: "en_reparacion", label: "En reparación", color: "warn" },
  { value: "cerrada", label: "Cerrada", color: "ok" },
];

const emptyForm = {
  equipoId: "", reportadoPor: "", prioridad: "media", tecnicoAsignado: "",
  fechaFalla: "", fechaReparacion: "", fallaReportada: "", diagnostico: "",
  reparacionRealizada: "", repuestosUtilizados: "", costo: "", causaRaiz: "", estado: "abierta",
};

function calcularDowntime(fechaFalla, fechaReparacion) {
  if (!fechaFalla) return null;
  try {
    const inicio = parseISO(fechaFalla);
    const fin = fechaReparacion ? parseISO(fechaReparacion) : new Date();
    const horas = differenceInHours(fin, inicio);
    return horas >= 0 ? horas : null;
  } catch {
    return null;
  }
}

export default function Correctivos() {
  const { user } = useAuth();
  const [equipos, setEquipos] = useState([]);
  const [correctivos, setCorrectivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const q = query(collection(db, "mantenimientos_correctivos"), orderBy("creadoEn", "desc"));
    const u2 = onSnapshot(q, (s) => { setCorrectivos(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    return () => { u1(); u2(); };
  }, []);

  function openCreate() { setForm(emptyForm); setEditing(null); setModalOpen(true); }
  function openEdit(c) { setForm({ ...emptyForm, ...c }); setEditing(c); setModalOpen(true); }

  async function handleSubmit(e) {
    e.preventDefault();
    const equipo = equipos.find((eq) => eq.id === form.equipoId);
    const downtimeHoras = calcularDowntime(form.fechaFalla, form.fechaReparacion);
    const payload = { ...form, equipoNombre: equipo?.nombre || "", area: equipo?.area || "", downtimeHoras };
    delete payload.id;
    try {
      if (editing) {
        await updateDoc(doc(db, "mantenimientos_correctivos", editing.id), { ...payload, actualizadoEn: serverTimestamp() });
        await logAudit({ user, accion: "editar", modulo: "correctivos", entidadId: editing.id, detalle: `Editó correctivo de ${equipo?.nombre || ""}` });
      } else {
        const ref = await addDoc(collection(db, "mantenimientos_correctivos"), { ...payload, creadoEn: serverTimestamp() });
        await logAudit({ user, accion: "crear", modulo: "correctivos", entidadId: ref.id, detalle: `Registró falla de ${equipo?.nombre || ""}` });
      }
      setModalOpen(false);
    } catch (err) { console.error(err); alert("No se pudo guardar el correctivo."); }
  }

  async function handleDelete(c) {
    await deleteDoc(doc(db, "mantenimientos_correctivos", c.id));
    await logAudit({ user, accion: "eliminar", modulo: "correctivos", entidadId: c.id, detalle: `Eliminó correctivo de ${c.equipoNombre || ""}` });
    setConfirmDelete(null);
  }

  async function generarOrden(c) {
    try {
      const numero = await getNextOrderNumber();
      const ref = await addDoc(collection(db, "ordenes_trabajo"), {
        numero,
        tipo: "correctivo",
        equipoId: c.equipoId,
        equipoNombre: c.equipoNombre,
        area: c.area,
        descripcion: `Correctivo: ${c.fallaReportada || "Falla reportada"}`,
        prioridad: c.prioridad || "media",
        responsable: c.tecnicoAsignado || "",
        fechaProgramada: new Date().toISOString().slice(0, 10),
        estado: "pendiente",
        origenTipo: "correctivo",
        origenId: c.id,
        creadoEn: serverTimestamp(),
      });
      await logAudit({ user, accion: "crear", modulo: "ordenes", entidadId: ref.id, detalle: `Orden generada automáticamente desde correctivo de ${c.equipoNombre}` });
      alert(`Orden de trabajo generada para ${c.equipoNombre}.`);
    } catch (err) { console.error(err); alert("No se pudo generar la orden de trabajo."); }
  }

  const downtimePreview = calcularDowntime(form.fechaFalla, form.fechaReparacion);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-critical-soft)" }}>
            <Siren size={19} style={{ color: "var(--color-critical)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Mantenimientos correctivos</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Fallas, diagnóstico, reparación, costos y causa raíz — downtime calculado automáticamente</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Reportar falla</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</div>
        ) : correctivos.length === 0 ? (
          <EmptyState icon={Siren} title="Sin correctivos registrados" description="Registra la primera falla reportada para iniciar el seguimiento del equipo." action={<Button onClick={openCreate}><Plus size={16} /> Reportar falla</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {["Equipo", "Falla", "Prioridad", "Técnico", "Downtime", "Estado", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correctivos.map((c) => {
                  const est = ESTADOS.find((e) => e.value === c.estado) || ESTADOS[0];
                  return (
                    <tr key={c.id} className="border-t align-top" style={{ borderColor: "var(--color-line)" }}>
                      <td className="px-4 py-3 font-medium">{c.equipoNombre || "—"}</td>
                      <td className="px-4 py-3 max-w-xs"><span className="line-clamp-2" style={{ color: "var(--color-muted)" }}>{c.fallaReportada}</span></td>
                      <td className="px-4 py-3"><Badge color={c.prioridad === "alta" ? "critical" : c.prioridad === "media" ? "warn" : "ok"}>{c.prioridad}</Badge></td>
                      <td className="px-4 py-3">{c.tecnicoAsignado || "—"}</td>
                      <td className="px-4 py-3 mono-tabular">{c.downtimeHoras != null ? `${c.downtimeHoras} h` : "—"}</td>
                      <td className="px-4 py-3"><Badge color={est.color} dot={est.value !== "cerrada"}>{est.label}</Badge></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => generarOrden(c)} title="Generar orden de trabajo" className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><CalendarPlus size={15} style={{ color: "var(--color-teal)" }} /></button>
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Pencil size={14} style={{ color: "var(--color-muted)" }} /></button>
                        <button onClick={() => setConfirmDelete(c)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Trash2 size={14} style={{ color: "var(--color-critical)" }} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar correctivo" : "Reportar falla"} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Equipo *</label>
              <select required value={form.equipoId} onChange={(e) => setForm({ ...form, equipoId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                <option value="">Seleccionar equipo…</option>
                {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.codigo} — {eq.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Reportado por (usuario)</label>
              <input value={form.reportadoPor} onChange={(e) => setForm({ ...form, reportadoPor: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Prioridad</label>
              <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Falla reportada *</label>
              <textarea required rows={2} value={form.fallaReportada} onChange={(e) => setForm({ ...form, fallaReportada: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Fecha y hora de la falla</label>
              <input type="datetime-local" value={form.fechaFalla} onChange={(e) => setForm({ ...form, fechaFalla: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Fecha y hora de reparación</label>
              <input type="datetime-local" value={form.fechaReparacion} onChange={(e) => setForm({ ...form, fechaReparacion: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--color-paper)" }}>
              <span className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>Tiempo fuera de servicio (downtime), calculado automáticamente:</span>
              <span className="text-sm font-semibold mono-tabular">{downtimePreview != null ? `${downtimePreview} horas` : "— (ingresa la fecha de la falla)"}</span>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Técnico asignado</label>
              <input value={form.tecnicoAsignado} onChange={(e) => setForm({ ...form, tecnicoAsignado: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Diagnóstico</label>
              <textarea rows={2} value={form.diagnostico} onChange={(e) => setForm({ ...form, diagnostico: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Reparación realizada</label>
              <textarea rows={2} value={form.reparacionRealizada} onChange={(e) => setForm({ ...form, reparacionRealizada: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Repuestos utilizados</label>
              <textarea rows={2} value={form.repuestosUtilizados} onChange={(e) => setForm({ ...form, repuestosUtilizados: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Costo total (USD)</label>
              <input type="number" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Causa raíz de la falla</label>
              <textarea rows={2} value={form.causaRaiz} onChange={(e) => setForm({ ...form, causaRaiz: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Registrar falla"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar correctivo" width="max-w-sm">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>Se eliminará el registro de falla de <strong>{confirmDelete?.equipoNombre}</strong> de forma permanente.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
