import { useEffect, useMemo, useState } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { addDays, isBefore, parseISO } from "date-fns";
import { FolderOpen, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { Badge, Button, Card, Modal, EmptyState } from "../components/ui";

const TIPOS = [
  { value: "manual_usuario", label: "Manual de usuario" },
  { value: "manual_servicio", label: "Manual de servicio" },
  { value: "diagrama", label: "Diagrama eléctrico" },
  { value: "procedimiento", label: "Procedimiento" },
  { value: "protocolo", label: "Protocolo" },
  { value: "certificado", label: "Certificado" },
  { value: "garantia", label: "Garantía" },
  { value: "contrato", label: "Contrato de mantenimiento" },
];

const emptyForm = { titulo: "", tipo: "manual_usuario", equipoId: "", url: "", vigencia: "" };

function estadoVigencia(vigencia) {
  if (!vigencia) return null;
  const hoy = new Date();
  const f = parseISO(vigencia);
  if (isBefore(f, hoy)) return { label: "Vencido", color: "critical" };
  if (isBefore(f, addDays(hoy, 30))) return { label: "Por vencer", color: "warn" };
  return { label: "Vigente", color: "ok" };
}

export default function Documentos() {
  const { user } = useAuth();
  const [equipos, setEquipos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabTipo, setTabTipo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const q = query(collection(db, "documentos"), orderBy("creadoEn", "desc"));
    const u2 = onSnapshot(q, (s) => { setDocumentos(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => setLoading(false));
    return () => { u1(); u2(); };
  }, []);

  const filtrados = useMemo(() => tabTipo ? documentos.filter((d) => d.tipo === tabTipo) : documentos, [documentos, tabTipo]);

  function openCreate() { setForm(emptyForm); setEditing(null); setModalOpen(true); }
  function openEdit(d) { setForm({ ...emptyForm, ...d }); setEditing(d); setModalOpen(true); }

  async function handleSubmit(e) {
    e.preventDefault();
    const equipo = equipos.find((eq) => eq.id === form.equipoId);
    const payload = { ...form, equipoNombre: equipo?.nombre || "" };
    delete payload.id;
    try {
      if (editing) {
        await updateDoc(doc(db, "documentos", editing.id), { ...payload, actualizadoEn: serverTimestamp() });
        await logAudit({ user, accion: "editar", modulo: "documentos", entidadId: editing.id, detalle: `Editó documento "${payload.titulo}"` });
      } else {
        const ref = await addDoc(collection(db, "documentos"), { ...payload, creadoEn: serverTimestamp() });
        await logAudit({ user, accion: "crear", modulo: "documentos", entidadId: ref.id, detalle: `Cargó documento "${payload.titulo}"` });
      }
      setModalOpen(false);
    } catch (err) { console.error(err); alert("No se pudo guardar el documento."); }
  }

  async function handleDelete(d) {
    await deleteDoc(doc(db, "documentos", d.id));
    await logAudit({ user, accion: "eliminar", modulo: "documentos", entidadId: d.id, detalle: `Eliminó documento "${d.titulo}"` });
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
            <FolderOpen size={19} style={{ color: "var(--color-info)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Gestión documental</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Manuales, diagramas, protocolos, certificados, garantías y contratos</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo documento</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTabTipo("")} className="px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ background: tabTipo === "" ? "var(--color-teal)" : "var(--color-card)", color: tabTipo === "" ? "#fff" : "var(--color-ink)", borderColor: tabTipo === "" ? "var(--color-teal)" : "var(--color-line)" }}>
          Todos ({documentos.length})
        </button>
        {TIPOS.map((t) => {
          const count = documentos.filter((d) => d.tipo === t.value).length;
          if (count === 0) return null;
          return (
            <button key={t.value} onClick={() => setTabTipo(t.value)} className="px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ background: tabTipo === t.value ? "var(--color-teal)" : "var(--color-card)", color: tabTipo === t.value ? "#fff" : "var(--color-ink)", borderColor: tabTipo === t.value ? "var(--color-teal)" : "var(--color-line)" }}>
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</div>
        ) : filtrados.length === 0 ? (
          <EmptyState icon={FolderOpen} title="Sin documentos cargados" description="Sube el enlace del primer manual, protocolo o certificado del hospital." action={<Button onClick={openCreate}><Plus size={16} /> Nuevo documento</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {["Documento", "Tipo", "Equipo", "Vigencia", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d) => {
                  const vig = estadoVigencia(d.vigencia);
                  return (
                    <tr key={d.id} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                      <td className="px-4 py-3 font-medium">
                        {d.url ? (
                          <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: "var(--color-teal)" }}>
                            {d.titulo} <ExternalLink size={12} />
                          </a>
                        ) : d.titulo}
                      </td>
                      <td className="px-4 py-3"><Badge color="info">{TIPOS.find((t) => t.value === d.tipo)?.label || d.tipo}</Badge></td>
                      <td className="px-4 py-3">{d.equipoNombre || "General"}</td>
                      <td className="px-4 py-3">{vig ? <Badge color={vig.color} dot={vig.color !== "ok"}>{vig.label} · {d.vigencia}</Badge> : <span style={{ color: "var(--color-muted)" }}>—</span>}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(d)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Pencil size={14} style={{ color: "var(--color-muted)" }} /></button>
                        <button onClick={() => setConfirmDelete(d)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Trash2 size={14} style={{ color: "var(--color-critical)" }} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar documento" : "Nuevo documento"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Título del documento *</label>
            <input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Tipo de documento</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Equipo relacionado (opcional)</label>
            <select value={form.equipoId} onChange={(e) => setForm({ ...form, equipoId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
              <option value="">General (no asociado a un equipo)</option>
              {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.codigo} — {eq.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Enlace al archivo</label>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://drive.google.com/..." className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Fecha de vigencia / vencimiento</label>
            <input type="date" value={form.vigencia} onChange={(e) => setForm({ ...form, vigencia: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Cargar documento"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar documento" width="max-w-sm">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>Se eliminará <strong>{confirmDelete?.titulo}</strong> de forma permanente.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
