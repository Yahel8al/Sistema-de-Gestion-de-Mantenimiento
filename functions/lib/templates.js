const COLORS = {
  ink: "#0F2532",
  teal: "#0E7C86",
  paper: "#F3F7F7",
  critical: "#D14B4B",
  warn: "#D9A02A",
  ok: "#2F9E63",
  muted: "#5E7A80",
};

function envoltorio(tituloInterno, contenidoHtml) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:${COLORS.paper}; padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #DCE6E6;">
      <div style="background:${COLORS.ink};padding:20px 24px;">
        <span style="color:#fff;font-size:18px;font-weight:600;">Pulso</span>
        <span style="color:${COLORS.teal};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;margin-left:8px;">CMMS Biomédico</span>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 12px;color:${COLORS.ink};font-size:16px;">${tituloInterno}</h2>
        ${contenidoHtml}
      </div>
      <div style="padding:16px 24px;background:${COLORS.paper};font-size:11px;color:${COLORS.muted};">
        Este correo fue generado automáticamente por Pulso CMMS. No respondas a este mensaje.
      </div>
    </div>
  </div>`;
}

function filaSeccion(titulo, color, items, render) {
  if (!items.length) return "";
  return `
    <div style="margin-bottom:18px;">
      <div style="display:inline-block;background:${color}1a;color:${color};font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;margin-bottom:8px;">
        ${titulo} · ${items.length}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${items.map((item) => `
          <tr style="border-top:1px solid #EEF2F2;">
            <td style="padding:6px 0;color:${COLORS.ink};">${render(item)}</td>
          </tr>`).join("")}
      </table>
    </div>`;
}

function digestDiario({ vencidas, proximas, calibraciones, documentos, stockBajo }) {
  const contenido = `
    <p style="color:${COLORS.muted};font-size:13px;margin-top:0;">Resumen automático de vencimientos y pendientes del día.</p>
    ${filaSeccion("Órdenes vencidas", COLORS.critical, vencidas, (o) => `<strong>${o.equipoNombre || o.numero}</strong> — programada ${o.fechaProgramada}`)}
    ${filaSeccion("Mantenimientos próximos (7 días)", COLORS.warn, proximas, (o) => `<strong>${o.equipoNombre || o.numero}</strong> — programada ${o.fechaProgramada}`)}
    ${filaSeccion("Calibraciones por vencer (30 días)", COLORS.warn, calibraciones, (c) => `<strong>${c.equipoNombre || "Equipo"}</strong> — ${c.laboratorio || ""} vence ${c.fechaVencimiento}`)}
    ${filaSeccion("Garantías / contratos por vencer", COLORS.teal, documentos, (d) => `<strong>${d.titulo}</strong> — vence ${d.vigencia}`)}
    ${filaSeccion("Repuestos con stock bajo", COLORS.critical, stockBajo, (r) => `<strong>${r.nombre}</strong> — ${r.stockActual ?? 0} / mínimo ${r.stockMinimo ?? 0}`)}
    ${[vencidas, proximas, calibraciones, documentos, stockBajo].every((a) => a.length === 0)
      ? `<p style="color:${COLORS.ok};font-size:13px;">No hay alertas activas hoy. Todo en orden.</p>`
      : ""}
  `;
  return envoltorio("Resumen diario de alertas", contenido);
}

function incidenciaCritica({ equipoNombre, descripcionEvento, fechaEvento }) {
  const contenido = `
    <p style="color:${COLORS.muted};font-size:13px;">Se registró un evento adverso de <strong style="color:${COLORS.critical};">gravedad alta</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
      <tr><td style="padding:4px 0;color:${COLORS.muted};width:120px;">Equipo</td><td style="padding:4px 0;"><strong>${equipoNombre || "—"}</strong></td></tr>
      <tr><td style="padding:4px 0;color:${COLORS.muted};">Fecha</td><td style="padding:4px 0;">${fechaEvento || "—"}</td></tr>
      <tr><td style="padding:4px 0;color:${COLORS.muted};vertical-align:top;">Descripción</td><td style="padding:4px 0;">${descripcionEvento || "—"}</td></tr>
    </table>
    <p style="font-size:12px;color:${COLORS.muted};margin-top:16px;">Revisa el módulo de Incidencias para dar seguimiento.</p>
  `;
  return envoltorio("⚠ Incidencia crítica reportada", contenido);
}

function correctivoCritico({ equipoNombre, fallaReportada, tecnicoAsignado }) {
  const contenido = `
    <p style="color:${COLORS.muted};font-size:13px;">Se reportó una falla de <strong style="color:${COLORS.critical};">prioridad alta</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
      <tr><td style="padding:4px 0;color:${COLORS.muted};width:120px;">Equipo</td><td style="padding:4px 0;"><strong>${equipoNombre || "—"}</strong></td></tr>
      <tr><td style="padding:4px 0;color:${COLORS.muted};vertical-align:top;">Falla reportada</td><td style="padding:4px 0;">${fallaReportada || "—"}</td></tr>
      <tr><td style="padding:4px 0;color:${COLORS.muted};">Técnico asignado</td><td style="padding:4px 0;">${tecnicoAsignado || "Sin asignar"}</td></tr>
    </table>
    <p style="font-size:12px;color:${COLORS.muted};margin-top:16px;">Revisa el módulo de Mantenimientos correctivos para darle seguimiento.</p>
  `;
  return envoltorio("🛠 Correctivo de prioridad alta", contenido);
}

module.exports = { digestDiario, incidenciaCritica, correctivoCritico };
