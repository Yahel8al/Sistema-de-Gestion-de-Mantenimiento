import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Registra una entrada de auditoría/trazabilidad.
 * Se llama automáticamente desde el CollectionManager y otros módulos
 * en cada operación de creación, edición o eliminación.
 */
export async function logAudit({ user, accion, modulo, detalle, entidadId }) {
  try {
    await addDoc(collection(db, "auditoria"), {
      usuarioUid: user?.uid || "desconocido",
      usuarioNombre: user?.displayName || user?.email || "desconocido",
      accion, // "crear" | "editar" | "eliminar" | "login" | "cambio_estado"
      modulo,
      entidadId: entidadId || null,
      detalle: detalle || "",
      fecha: serverTimestamp(),
    });
  } catch (e) {
    console.error("No se pudo registrar la auditoría:", e);
  }
}
