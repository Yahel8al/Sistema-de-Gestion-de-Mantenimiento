import { useEffect, useMemo, useState } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, orderBy, query,
} from "firebase/firestore";
import { Plus, Pencil, Trash2, Search as SearchIcon, Inbox } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { Badge, Button, Card, Modal, EmptyState } from "./ui";

/**
 * Motor genérico de CRUD sobre una colección de Firestore.
 * Se usa como base para varios módulos del sistema (esqueleto funcional
 * que puede profundizarse módulo por módulo: validaciones, adjuntos,
 * flujos de aprobación, etc.)
 */
export default function CollectionManager({
  collectionName,
  moduleKey,
  title,
  description,
  icon: Icon,
  fields,
  columns,
  searchKeys = [],
  orderField = "creadoEn",
  emptyTitle = "Todavía no hay registros",
  emptyDescription = "Crea el primero para empezar a construir el historial.",
}) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    let q;
    try {
      q = query(collection(db, collectionName), orderBy(orderField, "desc"));
    } catch {
      q = collection(db, collectionName);
    }
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [collectionName]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter((item) =>
      (searchKeys.length ? searchKeys : Object.keys(item)).some((k) =>
        String(item[k] ?? "").toLowerCase().includes(s)
      )
    );
  }, [items, search, searchKeys]);

  function openCreate() {
    const initial = {};
    fields.forEach((f) => (initial[f.key] = f.type === "checkbox" ? false : ""));
    setForm(initial);
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    setForm(item);
    setEditing(item);
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    delete payload.id;
    try {
      if (editing) {
        await updateDoc(doc(db, collectionName, editing.id), {
          ...payload,
          actualizadoEn: serverTimestamp(),
        });
        await logAudit({ user, accion: "editar", modulo: moduleKey, entidadId: editing.id, detalle: `Editó registro en ${title}` });
      } else {
        const ref = await addDoc(collection(db, collectionName), {
          ...payload,
          creadoEn: serverTimestamp(),
        });
        await logAudit({ user, accion: "crear", modulo: moduleKey, entidadId: ref.id, detalle: `Creó registro en ${title}` });
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Ocurrió un error al guardar. Revisa la consola para más detalle.");
    }
  }

  async function handleDelete(item) {
    try {
      await deleteDoc(doc(db, collectionName, item.id));
      await logAudit({ user, accion: "eliminar", modulo: moduleKey, entidadId: item.id, detalle: `Eliminó registro de ${title}` });
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el registro.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
              <Icon size={19} style={{ color: "var(--color-info)" }} />
            </div>
          )}
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
            {description && <p className="text-sm" style={{ color: "var(--color-muted)" }}>{description}</p>}
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Nuevo registro
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--color-line)" }}>
          <SearchIcon size={15} style={{ color: "var(--color-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en este módulo..."
            className="flex-1 outline-none text-sm bg-transparent"
          />
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>{filtered.length} registros</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {columns.map((col) => (
                    <th key={col.key} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 align-top">
                        {col.render ? col.render(item) : item[col.key]}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]" title="Editar">
                        <Pencil size={15} style={{ color: "var(--color-muted)" }} />
                      </button>
                      <button onClick={() => setConfirmDelete(item)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]" title="Eliminar">
                        <Trash2 size={15} style={{ color: "var(--color-critical)" }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar registro" : "Nuevo registro"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className={f.span === 2 ? "sm:col-span-2" : ""}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>
                  {f.label}{f.required && <span style={{ color: "var(--color-critical)" }}> *</span>}
                </label>
                {f.type === "select" ? (
                  <select
                    required={f.required}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ borderColor: "var(--color-line)" }}
                  >
                    <option value="">Seleccionar…</option>
                    {f.options.map((opt) => (
                      <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    required={f.required}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ borderColor: "var(--color-line)" }}
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={!!form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                    className="w-4 h-4 mt-1"
                  />
                ) : (
                  <input
                    type={f.type || "text"}
                    required={f.required}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ borderColor: "var(--color-line)" }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Crear registro"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Confirmar eliminación" width="max-w-sm">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
          Esta acción no se puede deshacer. ¿Deseas eliminar este registro de forma permanente?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</Button>
        </div>
      </Modal>

      <div className="flex items-center gap-1"><Badge color="idle">Registros en tiempo real vía Firestore</Badge></div>
    </div>
  );
}
