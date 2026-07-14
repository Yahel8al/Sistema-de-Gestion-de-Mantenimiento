/**
 * Devuelve los correos de los usuarios que deben recibir alertas del sistema
 * (por defecto: administradores e ingenieros clínicos, cuentas activas).
 */
async function getDestinatariosAlertas(db, rolesIncluidos = ["admin", "ingeniero"]) {
  const snap = await db.collection("usuarios").where("rol", "in", rolesIncluidos).get();
  return snap.docs
    .map((d) => d.data())
    .filter((u) => u.activo !== false && u.email)
    .map((u) => u.email);
}

function formatearFecha(valor) {
  if (!valor) return "—";
  try {
    return new Date(valor).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return String(valor);
  }
}

module.exports = { getDestinatariosAlertas, formatearFecha };
