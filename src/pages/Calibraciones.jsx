import { useEffect, useMemo, useState } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { addMonths, format, isBefore, addDays, parseISO } from "date-fns";
import { BadgeCheck, Plus, Pencil, Trash2, CalendarPlus, ExternalLink } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { getNextOrderNumber } from "../lib/counters";
import { Badge, Button, Card, Modal, EmptyState } from "../components/ui";

const PERIODICIDADES = [
  { value: 6, label: "Cada 6 meses" },
  { value: 12, label: "Anual" },
  { value: 24, label: "Cada 2 años" },
];

const emptyForm = {
  equipoId: "", laboratorio: "", fechaCalibracion: "", periodicidadMeses: 12,
  fechaVencimiento: "", certificadoUrl: "", resultado: "conforme", observaciones: "",
};

function estadoVencimiento(fechaVencimiento) {
  if (!fechaVencimiento) return { label: "Sin programar", color: "idle" };
  const hoy = new Date();
  const f = parseISO(fechaVencimiento);
  if (isBefore(f, hoy)) return { label: "Vencida", color: "critical" };
  if (isBefore(f, addDays(hoy, 30))) return { label: "Por vencer", color: "warn" };
  return { label: "Vigente", color: "ok" };
}

export default function Calibraciones() {
  const { user } = useAuth();
  const [equipos, setEquipos] = useState([]);
  const [calibraciones, setCalibraciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const q = query(collection(db, "calibraciones"), orderBy("creadoEn", "desc"));
    const u2 = onSnapshot(q, (s) => { setCalibraciones(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    return () => { u1(); u2(); };
  }, []);

  const filtradas = useMemo(() => {
    if (!filtroEstado) return calibraciones;
    return calibraciones.filter((c) => estadoVencimiento(c.fechaVencimiento).label === filtroEstado);
  }, [calibraciones, filtroEstado]);

  function calcularVencimiento(fecha, meses) {
    if (!fecha) return "";
    try { return format(addMonths(parseISO(fecha), Number(meses)), "yyyy-MM-dd"); } catch { return ""; }
  }

  function openCreate() { setForm(emptyForm); setEditing(null); setModalOpen(true); }
  function openEdit(c) { setForm({ ...emptyForm, ...c }); setEditing(c); setModalOpen(true); }

  function handleFechaChange(v) {
    setForm((f) => ({ ...f, fechaCalibracion: v, fechaVencimiento: calcularVencimiento(v, f.periodicidadMeses) }));
  }
  function handlePeriodicidadChange(v) {
    setForm((f) => ({ ...f, periodicidadMeses: v, fechaVencimiento: calcularVencimiento(f.fechaCalibracion, v) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const equipo = equipos.find((eq) => eq.id === form.equipoId);
    const payload = { ...form, equipoNombre: equipo?.nombre || "", area: equipo?.area || "" };
    delete payload.id;
    try {
      if (editing) {
        await updateDoc(doc(db, "calibraciones", editing.id), { ...payload, actualizadoEn: serverTimestamp() });
        await logAudit({ user, accion: "editar", modulo: "calibraciones", entidadId: editing.id, detalle: `Editó calibración de ${equipo?.nombre || ""}` });
      } else {
        const ref = await addDoc(collection(db, "calibraciones"), { ...payload, creadoEn: serverTimestamp() });
        await logAudit({ user, accion: "crear", modulo: "calibraciones", entidadId: ref.id, detalle: `Registró calibración de ${equipo?.nombre || ""}` });
      }
      setModalOpen(false);
    } catch (err) { console.error(err); alert("No se pudo guardar la calibración."); }
  }

  async function handleDelete(c) {
    await deleteDoc(doc(db, "calibraciones", c.id));
    await logAudit({ user, accion: "eliminar", modulo: "calibraciones", entidadId: c.id, detalle: `Eliminó calibración de ${c.equipoNombre || ""}` });
    setConfirmDelete(null);
  }

  async function generarOrden(c) {
    try {
      const numero = await getNextOrderNumber();
      const ref = await addDoc(collection(db, "ordenes_trabajo"), {
        numero,
        tipo: "calibracion",
        equipoId: c.equipoId,
        equipoNombre: c.equipoNombre,
        area: c.area,
        descripcion: `Calibración programada con ${c.laboratorio || "laboratorio a definir"}`,
        prioridad: "media",
        responsable: c.laboratorio || "",
        fechaProgramada: c.fechaVencimiento || "",
        estado: "pendiente",
        origenTipo: "calibracion",
        origenId: c.id,
        creadoEn: serverTimestamp(),
      });
      await logAudit({ user, accion: "crear", modulo: "ordenes", entidadId: ref.id, detalle: `Orden generada desde calibración de ${c.equipoNombre}` });
      alert(`Orden de trabajo generada para programar la calibración de ${c.equipoNombre}.`);
    } catch (err) { console.error(err); alert("No se pudo generar la orden de trabajo."); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
            <BadgeCheck size={19} style={{ color: "var(--color-info)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Gestión de calibraciones</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Periodicidad, próximo vencimiento y certificados por laboratorio</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nueva calibración</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "Vencida", "Por vencer", "Vigente"].map((f) => (
          <button key={f || "todos"} onClick={() => setFiltroEstado(f)} className="px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ background: filtroEstado === f ? "var(--color-teal)" : "var(--color-card)", color: filtroEstado === f ? "#fff" : "var(--color-ink)", borderColor: filtroEstado === f ? "var(--color-teal)" : "var(--color-line)" }}>
            {f || "Todas"}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <EmptyState icon={BadgeCheck} title="Sin calibraciones registradas" description="Registra la calibración de un equipo para llevar el control de vencimientos." action={<Button onClick={openCreate}><Plus size={16} /> Nueva calibración</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {["Equipo", "Laboratorio", "Realizada", "Vence", "Estado", "Resultado", "Certificado", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => {
                  const st = estadoVencimiento(c.fechaVencimiento);
                  return (
                    <tr key={c.id} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                      <td className="px-4 py-3 font-medium">{c.equipoNombre || "—"}</td>
                      <td className="px-4 py-3">{c.laboratorio}</td>
                      <td className="px-4 py-3 mono-tabular text-xs">{c.fechaCalibracion || "—"}</td>
                      <td className="px-4 py-3 mono-tabular text-xs">{c.fechaVencimiento || "—"}</td>
                      <td className="px-4 py-3"><Badge color={st.color} dot={st.color !== "idle"}>{st.label}</Badge></td>
                      <td className="px-4 py-3"><Badge color={c.resultado === "no_conforme" ? "critical" : "ok"}>{c.resultado === "no_conforme" ? "No conforme" : "Conforme"}</Badge></td>
                      <td className="px-4 py-3">
                        {c.certificadoUrl ? <a href={c.certificadoUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-teal)" }}><ExternalLink size={14} /></a> : <span style={{ color: "var(--color-muted)" }}>—</span>}
                      </td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar calibración" : "Nueva calibración"} width="max-w-xl">
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Laboratorio responsable *</label>
              <input required value={form.laboratorio} onChange={(e) => setForm({ ...form, laboratorio: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Fecha de calibración</label>
              <input type="date" value={form.fechaCalibracion} onChange={(e) => handleFechaChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Periodicidad</label>
              <select value={form.periodicidadMeses} onChange={(e) => handlePeriodicidadChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                {PERIODICIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Fecha de vencimiento (calculada automáticamente)</label>
              <input type="date" required value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm mono-tabular" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Enlace al certificado</label>
              <input value={form.certificadoUrl} onChange={(e) => setForm({ ...form, certificadoUrl: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Resultado</label>
              <select value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                <option value="conforme">Conforme</option>
                <option value="no_conforme">No conforme</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Observaciones</label>
              <textarea rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Registrar calibración"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar calibración" width="max-w-sm">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>Se eliminará el registro de calibración de <strong>{confirmDelete?.equipoNombre}</strong>.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
