const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

const { enviarCorreo, MAIL_SECRETS } = require("./lib/mailer");
const { getDestinatariosAlertas } = require("./lib/firestore");
const { digestDiario, incidenciaCritica, correctivoCritico } = require("./lib/templates");

initializeApp();
const db = getFirestore();

const DIAS_PROXIMOS = 7;
const DIAS_VIGENCIA = 30;

function sumarDias(fecha, dias) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

/**
 * Se ejecuta todos los días a las 07:00 (hora de Ecuador) y envía un correo
 * resumen a administradores e ingenieros clínicos con:
 *  - Órdenes de trabajo vencidas o próximas a vencer (7 días)
 *  - Calibraciones por vencer (30 días)
 *  - Garantías/contratos por vencer (30 días)
 *  - Repuestos con stock por debajo del mínimo
 *
 * Para desplegar y activar el envío real de correos, configura los secretos:
 *   firebase functions:secrets:set SMTP_USER
 *   firebase functions:secrets:set SMTP_PASS
 * Ver functions/README.md para el detalle completo.
 */
exports.alertasDiarias = onSchedule(
  { schedule: "every day 07:00", timeZone: "America/Guayaquil", secrets: MAIL_SECRETS },
  async () => {
    const hoy = new Date();
    const en7 = sumarDias(hoy, DIAS_PROXIMOS);
    const en30 = sumarDias(hoy, DIAS_VIGENCIA);

    const [ordenesSnap, calibracionesSnap, documentosSnap, repuestosSnap] = await Promise.all([
      db.collection("ordenes_trabajo").where("estado", "!=", "finalizada").get(),
      db.collection("calibraciones").get(),
      db.collection("documentos").get(),
      db.collection("repuestos").get(),
    ]);

    const ordenes = ordenesSnap.docs.map((d) => d.data());
    const vencidas = ordenes.filter((o) => o.fechaProgramada && new Date(o.fechaProgramada) < hoy);
    const proximas = ordenes.filter((o) => o.fechaProgramada && new Date(o.fechaProgramada) >= hoy && new Date(o.fechaProgramada) <= en7);

    const calibraciones = calibracionesSnap.docs
      .map((d) => d.data())
      .filter((c) => c.fechaVencimiento && new Date(c.fechaVencimiento) <= en30);

    const documentos = documentosSnap.docs
      .map((d) => d.data())
      .filter((d) => d.vigencia && ["garantia", "contrato"].includes(d.tipo) && new Date(d.vigencia) <= en30);

    const stockBajo = repuestosSnap.docs
      .map((d) => d.data())
      .filter((r) => Number(r.stockActual || 0) <= Number(r.stockMinimo || 0));

    const totalAlertas = vencidas.length + proximas.length + calibraciones.length + documentos.length + stockBajo.length;
    if (totalAlertas === 0) {
      logger.info("alertasDiarias: sin alertas activas hoy, no se envía correo.");
      return;
    }

    const destinatarios = await getDestinatariosAlertas(db);
    const html = digestDiario({ vencidas, proximas, calibraciones, documentos, stockBajo });

    await enviarCorreo({
      to: destinatarios,
      subject: `Pulso CMMS · ${totalAlertas} alertas activas hoy`,
      html,
    });

    await db.collection("notificaciones_enviadas").add({
      tipo: "digest_diario",
      totalAlertas,
      destinatarios,
      fecha: new Date(),
    });

    logger.info(`alertasDiarias: correo enviado a ${destinatarios.length} destinatarios con ${totalAlertas} alertas.`);
  }
);

/**
 * Se dispara automáticamente cuando se crea una incidencia de gravedad alta
 * y notifica de inmediato al equipo de ingeniería biomédica.
 */
exports.notificarIncidenciaCritica = onDocumentCreated(
  { document: "incidencias/{id}", secrets: MAIL_SECRETS },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.gravedad !== "alta") return;

    const equipoNombre = data.equipoNombre || (data.equipoId ? (await db.collection("equipos").doc(data.equipoId).get()).data()?.nombre : null);
    const destinatarios = await getDestinatariosAlertas(db);
    const html = incidenciaCritica({ equipoNombre, descripcionEvento: data.descripcionEvento, fechaEvento: data.fechaEvento });

    await enviarCorreo({ to: destinatarios, subject: `⚠ Incidencia crítica — ${equipoNombre || "equipo"}`, html });
    logger.info(`notificarIncidenciaCritica: correo enviado por incidencia ${event.params.id}.`);
  }
);

/**
 * Se dispara automáticamente cuando se registra un correctivo de prioridad alta.
 */
exports.notificarCorrectivoCritico = onDocumentCreated(
  { document: "mantenimientos_correctivos/{id}", secrets: MAIL_SECRETS },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.prioridad !== "alta") return;

    const destinatarios = await getDestinatariosAlertas(db);
    const html = correctivoCritico({
      equipoNombre: data.equipoNombre,
      fallaReportada: data.fallaReportada,
      tecnicoAsignado: data.tecnicoAsignado,
    });

    await enviarCorreo({ to: destinatarios, subject: `🛠 Correctivo prioridad alta — ${data.equipoNombre || "equipo"}`, html });
    logger.info(`notificarCorrectivoCritico: correo enviado por correctivo ${event.params.id}.`);
  }
);
