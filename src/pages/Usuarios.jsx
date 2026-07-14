import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Plus, Users, Pencil, Trash2, AlertCircle, ShieldCheck, Ban, CheckCircle2 } from "lucide-react";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../lib/audit";
import { ROLES } from "../lib/modules";
import { Badge, Button, Card, Modal, EmptyState } from "../components/ui";

const MATRIZ_PERMISOS = [
  { modulo: "Inventario, mantenimientos, órdenes, calibraciones, repuestos, proveedores, documentos", admin: "Ver y editar", ingeniero: "Ver y editar", supervisor: "Ver y editar", tecnico: "Ver y editar", clinico: "Solo ver", auditor: "Solo ver" },
  { modulo: "Incidencias", admin: "Ver y editar", ingeniero: "Ver y editar", supervisor: "Ver y editar", tecnico: "Ver y editar", clinico: "Puede reportar", auditor: "Solo ver" },
  { modulo: "Trazabilidad / auditoría", admin: "Ver", ingeniero: "Ver", supervisor: "Ver", tecnico: "Sin acceso", clinico: "Sin acceso", auditor: "Ver" },
  { modulo: "Usuarios y permisos", admin: "Ver y editar", ingeniero: "Sin acceso", supervisor: "Sin acceso", tecnico: "Sin acceso", clinico: "Sin acceso", auditor: "Sin acceso" },
];

export default function Usuarios() {
  const { user, register } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "clinico" });
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), (snap) => {
      setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  function openCreate() {
    setForm({ nombre: "", email: "", password: "", rol: "clinico" });
    setEditing(null);
    setError("");
    setModalOpen(true);
  }
  function openEdit(u) {
    setForm({ nombre: u.nombre || "", email: u.email || "", password: "", rol: u.rol || "clinico" });
    setEditing(u);
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await updateDoc(doc(db, "usuarios", editing.id), { nombre: form.nombre, rol: form.rol });
        await logAudit({ user, accion: "editar", modulo: "usuarios", entidadId: editing.id, detalle: `Actualizó usuario ${form.email}` });
      } else {
        await register(form.email, form.password, form.nombre, form.rol);
        await logAudit({ user, accion: "crear", modulo: "usuarios", detalle: `Creó usuario ${form.email} con rol ${form.rol}` });
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar el usuario. Verifica que el correo no esté ya registrado y que la contraseña tenga al menos 6 caracteres.");
    }
  }

  async function handleDelete(u) {
    await deleteDoc(doc(db, "usuarios", u.id));
    await logAudit({ user, accion: "eliminar", modulo: "usuarios", entidadId: u.id, detalle: `Eliminó perfil de usuario ${u.email}` });
    setConfirmDelete(null);
  }

  async function toggleActivo(u) {
    const nuevoEstado = !(u.activo !== false);
    await updateDoc(doc(db, "usuarios", u.id), { activo: nuevoEstado });
    await logAudit({ user, accion: "editar", modulo: "usuarios", entidadId: u.id, detalle: `${nuevoEstado ? "Activó" : "Desactivó"} la cuenta de ${u.email}` });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-info-soft)" }}>
            <Users size={19} style={{ color: "var(--color-info)" }} />
          </div>
          <div>
            <h2 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>Gestión de usuarios</h2>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Administrador, ingeniero clínico, técnico, supervisor, usuario clínico y auditor</p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo usuario</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</div>
        ) : usuarios.length === 0 ? (
          <EmptyState icon={Users} title="Sin usuarios registrados" description="Crea la primera cuenta del sistema, normalmente la del administrador." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-paper)" }}>
                  {["Nombre", "Correo", "Rol", "Estado", ""].map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const activo = u.activo !== false;
                  return (
                    <tr key={u.id} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                      <td className="px-4 py-3 font-medium">{u.nombre}</td>
                      <td className="px-4 py-3" style={{ color: "var(--color-muted)" }}>{u.email}</td>
                      <td className="px-4 py-3"><Badge color="info">{ROLES[u.rol]?.label || u.rol}</Badge></td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActivo(u)} className="inline-flex">
                          <Badge color={activo ? "ok" : "critical"} dot={!activo}>{activo ? "Activo" : "Desactivado"}</Badge>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => toggleActivo(u)} title={activo ? "Desactivar cuenta" : "Activar cuenta"} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]">
                          {activo ? <Ban size={14} style={{ color: "var(--color-muted)" }} /> : <CheckCircle2 size={14} style={{ color: "var(--color-ok)" }} />}
                        </button>
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Pencil size={14} style={{ color: "var(--color-muted)" }} /></button>
                        <button onClick={() => setConfirmDelete(u)} className="p-1.5 rounded-md hover:bg-[var(--color-paper)]"><Trash2 size={14} style={{ color: "var(--color-critical)" }} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} style={{ color: "var(--color-teal)" }} />
          <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>Matriz de permisos por rol</h3>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--color-muted)" }}>
          Referencia de lo que cada rol puede hacer, según las reglas de seguridad configuradas en Firestore (<code>firestore.rules</code>).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--color-paper)" }}>
                <th className="text-left px-3 py-2 font-medium uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>Módulo</th>
                {["admin", "ingeniero", "supervisor", "tecnico", "clinico", "auditor"].map((r) => (
                  <th key={r} className="text-left px-3 py-2 font-medium uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>{ROLES[r].label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIZ_PERMISOS.map((fila, i) => (
                <tr key={i} className="border-t align-top" style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-3 py-2 font-medium max-w-[220px]">{fila.modulo}</td>
                  {["admin", "ingeniero", "supervisor", "tecnico", "clinico", "auditor"].map((r) => (
                    <td key={r} className="px-3 py-2" style={{ color: fila[r] === "Sin acceso" ? "var(--color-critical)" : "var(--color-muted)" }}>{fila[r]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar usuario" : "Nuevo usuario"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Nombre completo</label>
            <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Correo electrónico</label>
            <input type="email" required disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm disabled:opacity-60" style={{ borderColor: "var(--color-line)" }} />
          </div>
          {!editing && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Contraseña temporal</label>
              <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-muted)" }}>Rol</label>
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--color-line)" }}>
              {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: "var(--color-critical-soft)", color: "var(--color-critical)" }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--color-line)" }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Crear usuario"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar usuario" width="max-w-sm">
        <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
          Se eliminará el perfil de <strong>{confirmDelete?.nombre}</strong>. Esto no elimina su cuenta de autenticación, solo sus permisos en el sistema.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDelete)}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
