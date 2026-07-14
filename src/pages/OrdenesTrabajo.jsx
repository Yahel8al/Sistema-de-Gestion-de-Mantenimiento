import { useEffect, useMemo, useState } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { Plus, ClipboardList, Pencil, Trash2, Wrench, Siren, BadgeCheck, PenLine } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { getNextOrderNumber } from "../lib/counters";
import { Badge, Button, Card, Modal } from "../components/ui";

const ESTADOS = [
  { key: "pendiente", label: "Pendiente", color: "idle" },
  { key: "asignada", label: "Asignada", color: "info" },
  { key: "en_proceso", label: "En proceso", color: "warn" },
  { key: "finalizada", label: "Finalizada", color: "ok" },
];
const TIPOS = [
  { key: "preventivo", label: "Preventivo", icon: Wrench },
  { key: "correctivo", label: "Correctivo", icon: Siren },
  { key: "calibracion", label: "Calibración", icon: BadgeCheck },
];
const PRIORIDADES = [{ value: "alta", label: "Alta" }, { value: "media", label: "Media" }, { value: "baja", label: "Baja" }];

const emptyForm = {
  numero: "", tipo: "preventivo", equipoId: "", equipoNombre: "", descripcion: "",
  prioridad: "media", responsable: "", fechaProgramada: "", fechaCierre: "", estado: "pendiente",
};

export default function OrdenesTrabajo() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [firmaOrden, setFirmaOrden] = useState(null);
  const [firmaForm, setFirmaForm] = useState({ tecnico: "", usuarioClinico: "" });

  useEffect(() => {
    const q = query(collection(db, "ordenes_trabajo"), orderBy("creadoEn", "desc"));
    const u1 = onSnapshot(q, (s) => setOrdenes(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const grouped = useMemo(() => {
    const g = {};
    ESTADOS.forEach((e) => (g[e.key] = []));
    ordenes.forEach((o) => { if (g[o.estado]) g[o.estado].push(o); });
    return g;
  }, [ordenes]);

  async function openCreate() {
    const numero = await getNextOrderNumber();
    setForm({ ...emptyForm, numero });
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(o) { setForm(o); setEditing(o); setModalOpen(true); }

  async function handleSubmit(e) {
    e.preventDefault();
    const equipo = equipos.find((eq) => eq.id === form.equipoId);
    const payload = { ...form, equipoNombre: equipo?.nombre || form.equipoNombre, area: equipo?.area || "" };
    delete payload.id;
    try {
      if (editing) {
        await updateDoc(doc(db, "ordenes_trabajo", editing.id), { ...payload, actualizadoEn: serverTimestamp() });
        await logAudit({ user, accion: "editar", modulo: "ordenes", entidadId: editing.id, detalle: `Editó orden ${payload.numero}` });
      } else {
        const ref = await addDoc(collection(db, "ordenes_trabajo"), { ...payload, creadoEn: serverTimestamp() });
        await logAudit({ user, accion: "crear", modulo: "ordenes", entidadId: ref.id, detalle: `Creó orden ${payload.numero}` });
      }
      setModalOpen(false);
    } catch (err) { console.error(err); alert("No se pudo guardar la orden."); }
  }

  async function moveCard(orden, nuevoEstado) {
    if (nuevoEstado === "finalizada" && !orden.firmaTecnico) {
      setFirmaForm({ tecnico: orden.responsable || "", usuarioClinico: "" });
      setFirmaOrden(orden);
      return;
    }
    await updateDoc(doc(db, "ordenes_trabajo", orden.id), { estado: nuevoEstado });
    await logAudit({ user, accion: "cambio_estado", modulo: "ordenes", entidadId: orden.id, detalle: `Orden ${orden.numero} → ${nuevoEstado}` });
  }

  async function confirmarFirma(e) {
    e.preventDefault();
    if (!firmaOrden) return;
    try {
      await updateDoc(doc(db, "ordenes_trabajo", firmaOrden.id), {
        estado: "finalizada",
        fechaCierre: new Date().toISOString().slice(0, 10),
        firmaTecnico: firmaForm.tecnico,
        firmaUsuarioClinico: firmaForm.usuarioClinico,
        firmadoEn: serverTimestamp(),
      });
      await logAudit({ user, accion: "cambio_estado", modulo: "ordenes", entidadId: firmaOrden.id, detalle: `Orden ${firmaOrden.numero} finalizada y firmada por ${firmaForm.tecnico}` });
      setFirmaOrden(null);
    } catch (err) { console.error(err); alert("No se pudo registrar la firma."); }
  }

  async function handleDelete(o) {
    await deleteDoc(doc(db, "ordenes_trabajo", o.id));
    await logAudit({ user, accion: "eliminar", modulo: "ordenes", entidadId: o.id, detalle: `Eliminó orden ${o.numero}` });
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
            <ClipboardList size={19} style={{ color: "var(--color-info)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Órdenes de trabajo</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Flujo: pendiente → asignada → en proceso → finalizada</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nueva orden</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ESTADOS.map((col) => (
          <div key={col.key} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: `var(--color-${col.color})` }} />
                <span className="text-sm font-semibold">{col.label}</span>
              </div>
              <span className="text-xs mono-tabular" style={{ color: "var(--color-muted)" }}>{grouped[col.key]?.length || 0}</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {(grouped[col.key] || []).map((o) => {
                const tipoInfo = TIPOS.find((t) => t.key === o.tipo) || TIPOS[0];
                return (
                  <Card key={o.id} className="p-3">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-xs mono-tabular" style={{ color: "var(--color-muted)" }}>{o.numero}</span>
                      <Badge color={o.prioridad === "alta" ? "critical" : o.prioridad === "media" ? "warn" : "ok"}>{o.prioridad}</Badge>
                    </div>
                    <div className="text-sm font-medium mb-0.5">{o.equipoNombre || "Sin equipo asignado"}</div>
                    <p className="text-xs mb-2 line-clamp-2" style={{ color: "var(--color-muted)" }}>{o.descripcion}</p>
                    <div className="flex items-center gap-1.5 mb-1">
                      <tipoInfo.icon size={13} style={{ color: "var(--color-muted)" }} />
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>{tipoInfo.label}{o.responsable ? ` · ${o.responsable}` : ""}</span>
                    </div>
                    {o.origenTipo && (
                      <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Generada desde: {o.origenTipo}</div>
                    )}
                    {o.firmaTecnico && (
                      <div className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: "var(--color-ok)" }}>
                        <PenLine size={12} /> Firmada por {o.firmaTecnico}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={o.estado}
                        onChange={(e) => moveCard(o, e.target.value)}
                        className="text-xs px-2 py-1 rounded-md border flex-1"
                        style={{ borderColor: "var(--color-line)" }}
                      >
                        {ESTADOS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
                      </select>
                      <button onClick={() => openEdit(o)} className="p-1 rounded-md hover:bg-[var(--color-paper)]"><Pencil size={13} style={{ color: "var(--color-muted)" }} /></button>
                      <button onClick={() => setConfirmDelete(o)} className="p-1 rounded-md hover:bg-[var(--color-paper)]"><Trash2 size={13} style={{ color: "var(--color-critical)" }} /></button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar orden de trabajo" : "Nueva orden de trabajo"} width="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Número de orden</label>
              <input value={form.numero} readOnly className="w-full px-3 py-2 rounded-lg border text-sm mono-tabular" style={{ borderColor: "var(--color-line)", background: "var(--color-paper)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                {TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Equipo</label>
              <select required value={form.equipoId} onChange={(e) => setForm({ ...form, equipoId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                <option value="">Seleccionar equipo…</option>
                {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.codigo} — {eq.nombre}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Descripción / motivo</label>
              <textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Prioridad</label>
              <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Técnico responsable</label>
              <input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Fecha programada</label>
              <input type="date" value={form.fechaProgramada} onChange={(e) => setForm({ ...form, fechaProgramada: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
                {ESTADOS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Crear orden"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!firmaOrden} onClose={() => setFirmaOrden(null)} title="Firma electrónica de cierre" width="max-w-md">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
          Para finalizar la orden <strong>{firmaOrden?.numero}</strong> se requiere la conformidad
          del técnico y del usuario clínico que recibe el equipo.
        </p>
        <form onSubmit={confirmarFirma} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Nombre y firma del técnico *</label>
            <input required value={firmaForm.tecnico} onChange={(e) => setFirmaForm({ ...firmaForm, tecnico: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} placeholder="Escribe tu nombre completo como firma" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Nombre y firma del usuario clínico *</label>
            <input required value={firmaForm.usuarioClinico} onChange={(e) => setFirmaForm({ ...firmaForm, usuarioClinico: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} placeholder="Nombre de quien recibe el equipo" />
          </div>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>Se registrará también la fecha y hora exacta de esta conformidad.</p>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setFirmaOrden(null)}>Cancelar</Button>
            <Button type="submit"><PenLine size={15} /> Firmar y finalizar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar orden" width="max-w-sm">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>Se eliminará la orden <strong>{confirmDelete?.numero}</strong> de forma permanente.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
