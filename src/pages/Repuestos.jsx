import { useEffect, useMemo, useState } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy,
  runTransaction,
} from "firebase/firestore";
import { PackageSearch, Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, History as HistoryIcon } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { Badge, Button, Card, Modal, EmptyState } from "../components/ui";

const emptyForm = {
  nombre: "", codigo: "", compatibleCon: "", stockActual: 0, stockMinimo: 0,
  proveedor: "", costoUnitario: "",
};
const emptyMovimiento = { tipo: "entrada", cantidad: "", motivo: "" };

export default function Repuestos() {
  const { user } = useAuth();
  const [repuestos, setRepuestos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [movRepuesto, setMovRepuesto] = useState(null);
  const [movForm, setMovForm] = useState(emptyMovimiento);
  const [historialRepuesto, setHistorialRepuesto] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "repuestos"), orderBy("creadoEn", "desc"));
    const u1 = onSnapshot(q, (s) => { setRepuestos(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    const q2 = query(collection(db, "repuestos_movimientos"), orderBy("fecha", "desc"));
    const u2 = onSnapshot(q2, (s) => setMovimientos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, []);

  const movimientosDe = useMemo(() => (repuestoId) => movimientos.filter((m) => m.repuestoId === repuestoId), [movimientos]);

  function openCreate() { setForm(emptyForm); setEditing(null); setModalOpen(true); }
  function openEdit(r) { setForm({ ...emptyForm, ...r }); setEditing(r); setModalOpen(true); }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    delete payload.id;
    try {
      if (editing) {
        await updateDoc(doc(db, "repuestos", editing.id), { ...payload, actualizadoEn: serverTimestamp() });
        await logAudit({ user, accion: "editar", modulo: "repuestos", entidadId: editing.id, detalle: `Editó repuesto ${payload.nombre}` });
      } else {
        const ref = await addDoc(collection(db, "repuestos"), { ...payload, creadoEn: serverTimestamp() });
        await logAudit({ user, accion: "crear", modulo: "repuestos", entidadId: ref.id, detalle: `Agregó repuesto ${payload.nombre} al catálogo` });
      }
      setModalOpen(false);
    } catch (err) { console.error(err); alert("No se pudo guardar el repuesto."); }
  }

  async function handleDelete(r) {
    await deleteDoc(doc(db, "repuestos", r.id));
    await logAudit({ user, accion: "eliminar", modulo: "repuestos", entidadId: r.id, detalle: `Eliminó repuesto ${r.nombre}` });
    setConfirmDelete(null);
  }

  function openMovimiento(r) {
    setMovForm(emptyMovimiento);
    setMovRepuesto(r);
  }

  async function handleMovimiento(e) {
    e.preventDefault();
    const cantidad = Number(movForm.cantidad);
    if (!cantidad || cantidad <= 0) return alert("Ingresa una cantidad válida.");
    try {
      const repuestoRef = doc(db, "repuestos", movRepuesto.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(repuestoRef);
        const actual = Number(snap.data()?.stockActual || 0);
        const nuevoStock = movForm.tipo === "entrada" ? actual + cantidad : actual - cantidad;
        if (nuevoStock < 0) throw new Error("No hay stock suficiente para esta salida.");
        tx.update(repuestoRef, { stockActual: nuevoStock });
      });
      await addDoc(collection(db, "repuestos_movimientos"), {
        repuestoId: movRepuesto.id,
        repuestoNombre: movRepuesto.nombre,
        tipo: movForm.tipo,
        cantidad,
        motivo: movForm.motivo,
        usuario: user?.displayName || user?.email || "—",
        fecha: serverTimestamp(),
      });
      await logAudit({ user, accion: "editar", modulo: "repuestos", entidadId: movRepuesto.id, detalle: `Movimiento de ${movForm.tipo}: ${cantidad} uds. de ${movRepuesto.nombre}` });
      setMovRepuesto(null);
    } catch (err) {
      console.error(err);
      alert(err.message || "No se pudo registrar el movimiento.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
            <PackageSearch size={19} style={{ color: "var(--color-info)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Repuestos e inventario</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Catálogo, stock y libro de movimientos (entradas/salidas)</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo repuesto</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</div>
        ) : repuestos.length === 0 ? (
          <EmptyState icon={PackageSearch} title="Sin repuestos en el catálogo" description="Agrega un repuesto para comenzar a controlar el stock y sus movimientos." action={<Button onClick={openCreate}><Plus size={16} /> Nuevo repuesto</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {["Repuesto", "Código", "Stock", "Proveedor", "Costo unitario", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {repuestos.map((r) => {
                  const bajo = Number(r.stockActual) <= Number(r.stockMinimo || 0);
                  return (
                    <tr key={r.id} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                      <td className="px-4 py-3 font-medium">{r.nombre}</td>
                      <td className="px-4 py-3 mono-tabular text-xs">{r.codigo || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge color={bajo ? "critical" : "ok"} dot={bajo}>{r.stockActual ?? 0} / mín. {r.stockMinimo ?? 0}</Badge>
                      </td>
                      <td className="px-4 py-3">{r.proveedor || "—"}</td>
                      <td className="px-4 py-3 mono-tabular">{r.costoUnitario ? `$${Number(r.costoUnitario).toLocaleString("es-ES")}` : "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openMovimiento(r)} title="Registrar movimiento" className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><ArrowDownCircle size={15} style={{ color: "var(--color-teal)" }} /></button>
                        <button onClick={() => setHistorialRepuesto(r)} title="Ver movimientos" className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><HistoryIcon size={14} style={{ color: "var(--color-muted)" }} /></button>
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Pencil size={14} style={{ color: "var(--color-muted)" }} /></button>
                        <button onClick={() => setConfirmDelete(r)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Trash2 size={14} style={{ color: "var(--color-critical)" }} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar repuesto" : "Nuevo repuesto"} width="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Nombre del repuesto *</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Código / referencia</label>
              <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Proveedor</label>
              <input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Compatible con (equipos/modelos)</label>
              <textarea rows={2} value={form.compatibleCon} onChange={(e) => setForm({ ...form, compatibleCon: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Stock inicial</label>
              <input type="number" disabled={!!editing} value={form.stockActual} onChange={(e) => setForm({ ...form, stockActual: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm disabled:opacity-60" style={{ borderColor: "var(--color-line)" }} />
              {editing && <p className="text-[11px] mt-1" style={{ color: "var(--color-muted)" }}>Para ajustar el stock usa "Registrar movimiento" en la tabla.</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Stock mínimo</label>
              <input type="number" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Costo unitario (USD)</label>
              <input type="number" value={form.costoUnitario} onChange={(e) => setForm({ ...form, costoUnitario: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Crear repuesto"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!movRepuesto} onClose={() => setMovRepuesto(null)} title={`Registrar movimiento — ${movRepuesto?.nombre || ""}`} width="max-w-sm">
        <form onSubmit={handleMovimiento} className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setMovForm({ ...movForm, tipo: "entrada" })} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border" style={{ background: movForm.tipo === "entrada" ? "var(--color-ok-soft)" : "var(--color-card)", color: movForm.tipo === "entrada" ? "var(--color-ok)" : "var(--color-ink)", borderColor: movForm.tipo === "entrada" ? "var(--color-ok)" : "var(--color-line)" }}>
              <ArrowDownCircle size={15} /> Entrada
            </button>
            <button type="button" onClick={() => setMovForm({ ...movForm, tipo: "salida" })} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border" style={{ background: movForm.tipo === "salida" ? "var(--color-critical-soft)" : "var(--color-card)", color: movForm.tipo === "salida" ? "var(--color-critical)" : "var(--color-ink)", borderColor: movForm.tipo === "salida" ? "var(--color-critical)" : "var(--color-line)" }}>
              <ArrowUpCircle size={15} /> Salida
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Cantidad *</label>
            <input type="number" min="1" required value={movForm.cantidad} onChange={(e) => setMovForm({ ...movForm, cantidad: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Motivo (orden de trabajo, compra, etc.)</label>
            <input value={movForm.motivo} onChange={(e) => setMovForm({ ...movForm, motivo: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--color-paper)", color: "var(--color-muted)" }}>
            Stock actual: <strong>{movRepuesto?.stockActual ?? 0}</strong> uds.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setMovRepuesto(null)}>Cancelar</Button>
            <Button type="submit">Registrar movimiento</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!historialRepuesto} onClose={() => setHistorialRepuesto(null)} title={`Movimientos — ${historialRepuesto?.nombre || ""}`}>
        {historialRepuesto && movimientosDe(historialRepuesto.id).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Sin movimientos registrados todavía.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {historialRepuesto && movimientosDe(historialRepuesto.id).map((m) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ background: "var(--color-paper)" }}>
                <div className="flex items-center gap-2">
                  {m.tipo === "entrada" ? <ArrowDownCircle size={14} style={{ color: "var(--color-ok)" }} /> : <ArrowUpCircle size={14} style={{ color: "var(--color-critical)" }} />}
                  <span className="font-medium">{m.cantidad} uds.</span>
                  <span style={{ color: "var(--color-muted)" }}>{m.motivo}</span>
                </div>
                <span className="text-xs mono-tabular" style={{ color: "var(--color-muted)" }}>{m.fecha?.toDate ? m.fecha.toDate().toLocaleDateString("es-ES") : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar repuesto" width="max-w-sm">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>Se eliminará <strong>{confirmDelete?.nombre}</strong> del catálogo.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
