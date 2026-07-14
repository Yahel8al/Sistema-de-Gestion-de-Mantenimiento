import { useEffect, useMemo, useState } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { Plus, Search, LayoutGrid, List as ListIcon, Boxes, Pencil, Trash2, FileText } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { EQUIPMENT_STATUS, CRITICALITY, AREAS } from "../lib/modules";
import { Badge, Button, Card, Modal, EmptyState } from "../components/ui";

const TIPOS = ["Monitor de signos vitales", "Ventilador mecánico", "Bomba de infusión", "Desfibrilador", "Electrobisturí", "Rayos X", "Ecógrafo", "Incubadora", "Autoclave", "Otro"];

const emptyForm = {
  codigo: "", nombre: "", tipo: "", marca: "", modelo: "", serie: "", fabricante: "",
  fechaCompra: "", fechaInstalacion: "", area: "", sala: "", estado: "activo",
  criticidad: "media", valorAdquisicion: "", vidaUtilAnios: "", hojaVidaUrl: "",
};

export default function Inventario() {
  const { user } = useAuth();
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "equipos"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setEquipos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return equipos.filter((e) => {
      const matchesSearch = !search.trim() || [e.codigo, e.nombre, e.marca, e.modelo, e.serie]
        .some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()));
      const matchesEstado = !filtroEstado || e.estado === filtroEstado;
      return matchesSearch && matchesEstado;
    });
  }, [equipos, search, filtroEstado]);

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(item) {
    setForm({ ...emptyForm, ...item });
    setEditing(item);
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    delete payload.id;
    try {
      if (editing) {
        await updateDoc(doc(db, "equipos", editing.id), { ...payload, actualizadoEn: serverTimestamp() });
        await logAudit({ user, accion: "editar", modulo: "inventario", entidadId: editing.id, detalle: `Editó equipo ${payload.codigo}` });
      } else {
        const ref = await addDoc(collection(db, "equipos"), { ...payload, creadoEn: serverTimestamp() });
        await logAudit({ user, accion: "crear", modulo: "inventario", entidadId: ref.id, detalle: `Registró equipo ${payload.codigo}` });
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Ocurrió un error al guardar el equipo.");
    }
  }

  async function handleDelete(item) {
    await deleteDoc(doc(db, "equipos", item.id));
    await logAudit({ user, accion: "eliminar", modulo: "inventario", entidadId: item.id, detalle: `Eliminó equipo ${item.codigo}` });
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
            <Boxes size={19} style={{ color: "var(--color-info)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Inventario de equipos</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>{equipos.length} equipos registrados en el parque tecnológico</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Registrar equipo</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={15} style={{ color: "var(--color-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, nombre, marca, serie..." className="flex-1 outline-none text-sm bg-transparent" />
          </div>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="text-sm px-2 py-1.5 rounded-lg border" style={{ borderColor: "var(--color-line)" }}>
            <option value="">Todos los estados</option>
            {Object.entries(EQUIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--color-line)" }}>
            <button onClick={() => setView("grid")} className="p-2" style={{ background: view === "grid" ? "var(--color-paper)" : "transparent" }}><LayoutGrid size={15} /></button>
            <button onClick={() => setView("list")} className="p-2" style={{ background: view === "list" ? "var(--color-paper)" : "transparent" }}><ListIcon size={15} /></button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Boxes} title="Todavía no hay equipos registrados" description="Registra el primer equipo biomédico para comenzar a construir el inventario y su historial." action={<Button onClick={openCreate}><Plus size={16} /> Registrar equipo</Button>} />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filtered.map((eq) => {
              const st = EQUIPMENT_STATUS[eq.estado] || EQUIPMENT_STATUS.activo;
              const crit = CRITICALITY[eq.criticidad] || CRITICALITY.media;
              return (
                <div key={eq.id} className="nameplate p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs mono-tabular px-2 py-0.5 rounded" style={{ background: "var(--color-paper)", color: "var(--color-muted)" }}>{eq.codigo || "S/N"}</span>
                    <Badge color={st.color} dot>{st.label}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm mb-0.5">{eq.nombre}</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--color-muted)" }}>{eq.marca} {eq.modelo} · {eq.tipo}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge color={crit.color}>Riesgo {crit.label}</Badge>
                    {eq.area && <Badge color="idle">{eq.area}</Badge>}
                  </div>
                  <div className="flex items-center justify-between gap-1 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
                    {eq.hojaVidaUrl ? (
                      <a href={eq.hojaVidaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-teal)" }}>
                        <FileText size={13} /> Hoja de vida
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-muted)" }}>Sin hoja de vida</span>
                    )}
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(eq)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Pencil size={14} style={{ color: "var(--color-muted)" }} /></button>
                      <button onClick={() => setConfirmDelete(eq)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Trash2 size={14} style={{ color: "var(--color-critical)" }} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {["Código", "Nombre", "Marca/Modelo", "Área", "Estado", "Riesgo", "Hoja de vida", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((eq) => {
                  const st = EQUIPMENT_STATUS[eq.estado] || EQUIPMENT_STATUS.activo;
                  const crit = CRITICALITY[eq.criticidad] || CRITICALITY.media;
                  return (
                    <tr key={eq.id} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                      <td className="px-4 py-3 mono-tabular text-xs">{eq.codigo}</td>
                      <td className="px-4 py-3 font-medium">{eq.nombre}</td>
                      <td className="px-4 py-3" style={{ color: "var(--color-muted)" }}>{eq.marca} {eq.modelo}</td>
                      <td className="px-4 py-3">{eq.area}</td>
                      <td className="px-4 py-3"><Badge color={st.color} dot>{st.label}</Badge></td>
                      <td className="px-4 py-3"><Badge color={crit.color}>{crit.label}</Badge></td>
                      <td className="px-4 py-3">
                        {eq.hojaVidaUrl ? (
                          <a href={eq.hojaVidaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-teal)" }}>
                            <FileText size={13} /> Ver
                          </a>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(eq)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Pencil size={14} style={{ color: "var(--color-muted)" }} /></button>
                        <button onClick={() => setConfirmDelete(eq)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Trash2 size={14} style={{ color: "var(--color-critical)" }} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar equipo" : "Registrar equipo"} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Código de activo" required value={form.codigo} onChange={(v) => setForm({ ...form, codigo: v })} />
            <Field label="Nombre del equipo" required className="sm:col-span-2" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
            <SelectField label="Tipo de equipo" options={TIPOS} value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} />
            <Field label="Marca" value={form.marca} onChange={(v) => setForm({ ...form, marca: v })} />
            <Field label="Modelo" value={form.modelo} onChange={(v) => setForm({ ...form, modelo: v })} />
            <Field label="Número de serie" value={form.serie} onChange={(v) => setForm({ ...form, serie: v })} />
            <Field label="Fabricante" value={form.fabricante} onChange={(v) => setForm({ ...form, fabricante: v })} />
            <Field label="Fecha de compra" type="date" value={form.fechaCompra} onChange={(v) => setForm({ ...form, fechaCompra: v })} />
            <Field label="Fecha de instalación" type="date" value={form.fechaInstalacion} onChange={(v) => setForm({ ...form, fechaInstalacion: v })} />
            <SelectField label="Área / Servicio" options={AREAS} value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
            <Field label="Sala / Ubicación específica" value={form.sala} onChange={(v) => setForm({ ...form, sala: v })} />
            <SelectField label="Estado" options={Object.entries(EQUIPMENT_STATUS).map(([value, v]) => ({ value, label: v.label }))} value={form.estado} onChange={(v) => setForm({ ...form, estado: v })} />
            <SelectField label="Criticidad / riesgo" options={Object.entries(CRITICALITY).map(([value, v]) => ({ value, label: v.label }))} value={form.criticidad} onChange={(v) => setForm({ ...form, criticidad: v })} />
            <Field label="Valor de adquisición (USD)" type="number" value={form.valorAdquisicion} onChange={(v) => setForm({ ...form, valorAdquisicion: v })} />
            <Field label="Vida útil estimada (años)" type="number" value={form.vidaUtilAnios} onChange={(v) => setForm({ ...form, vidaUtilAnios: v })} />
          </div>

          <div className="pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <label className="block text-xs font-medium mb-1.5 mt-3" style={{ color: "var(--color-muted)" }}>
              Hoja de vida (enlace al documento completo del equipo)
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={form.hojaVidaUrl}
              onChange={(e) => setForm({ ...form, hojaVidaUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ borderColor: "var(--color-line)" }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Registrar equipo"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar equipo" width="max-w-sm">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
          Se eliminará <strong>{confirmDelete?.nombre}</strong> ({confirmDelete?.codigo}) del inventario. Esta acción no elimina su historial de mantenimientos.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, required, className = "", type = "text", value, onChange }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>{label}{required && <span style={{ color: "var(--color-critical)" }}> *</span>}</label>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--color-line)" }} />
    </div>
  );
}
function SelectField({ label, options, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "var(--color-line)" }}>
        <option value="">Seleccionar…</option>
        {options.map((opt) => <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>)}
      </select>
    </div>
  );
}
