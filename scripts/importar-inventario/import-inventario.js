#!/usr/bin/env node
/**
 * Carga masiva de equipos al Inventario de Pulso desde un archivo CSV.
 *
 * Uso:
 *   node import-inventario.js archivo.csv --dry-run   (solo valida, no sube nada)
 *   node import-inventario.js archivo.csv              (valida y sube a Firestore)
 *
 * Ver README.md en esta misma carpeta para la guía completa paso a paso.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const admin = require("firebase-admin");

const args = process.argv.slice(2);
const csvPathArg = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");

if (!csvPathArg) {
  console.error("Uso: node import-inventario.js <archivo.csv> [--dry-run]");
  process.exit(1);
}

const csvPath = path.resolve(process.cwd(), csvPathArg);
if (!fs.existsSync(csvPath)) {
  console.error(`No se encontró el archivo: ${csvPath}`);
  process.exit(1);
}

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error(
    "\nFalta el archivo serviceAccountKey.json en esta carpeta.\n" +
    "Descárgalo desde Firebase Console → Configuración del proyecto → Cuentas de servicio →\n" +
    "\"Generar nueva clave privada\", y guárdalo aquí con ese nombre exacto.\n" +
    "Ver README.md de esta carpeta para el detalle.\n"
  );
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
const db = admin.firestore();

// Acepta tanto la clave interna como la etiqueta en español, sin distinguir mayúsculas/minúsculas.
const ESTADOS = {
  activo: "activo",
  "en mantenimiento": "mantenimiento",
  mantenimiento: "mantenimiento",
  "fuera de servicio": "fuera_servicio",
  fuera_servicio: "fuera_servicio",
  "dado de baja": "baja",
  baja: "baja",
};
const CRITICIDADES = { alta: "alta", media: "media", baja: "baja" };

function norm(v) {
  return (v ?? "").toString().trim();
}

async function main() {
  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true, bom: true });

  console.log(`\nLeídas ${rows.length} filas del archivo "${path.basename(csvPath)}".`);

  console.log("Consultando equipos existentes para evitar duplicados...");
  const existentesSnap = await db.collection("equipos").get();
  const codigosExistentes = new Set(
    existentesSnap.docs.map((d) => norm(d.data().codigo).toLowerCase()).filter(Boolean)
  );

  const errores = [];
  const validos = [];
  const codigosVistos = new Set();

  rows.forEach((row, i) => {
    const nroFila = i + 2; // fila 1 = encabezado
    const codigo = norm(row.codigo);
    const nombre = norm(row.nombre);

    if (!codigo || !nombre) {
      errores.push(`Fila ${nroFila}: se omite — falta "codigo" o "nombre".`);
      return;
    }
    const key = codigo.toLowerCase();
    if (codigosVistos.has(key)) {
      errores.push(`Fila ${nroFila}: se omite — el código "${codigo}" está repetido dentro del CSV.`);
      return;
    }
    if (codigosExistentes.has(key)) {
      errores.push(`Fila ${nroFila}: se omite — el código "${codigo}" ya existe en el inventario.`);
      return;
    }
    codigosVistos.add(key);

    const estadoRaw = norm(row.estado).toLowerCase();
    const estado = ESTADOS[estadoRaw] || "activo";
    if (estadoRaw && !ESTADOS[estadoRaw]) {
      errores.push(`Fila ${nroFila}: aviso — estado "${row.estado}" no reconocido, se usará "activo".`);
    }

    const criticidadRaw = norm(row.criticidad).toLowerCase();
    const criticidad = CRITICIDADES[criticidadRaw] || "media";
    if (criticidadRaw && !CRITICIDADES[criticidadRaw]) {
      errores.push(`Fila ${nroFila}: aviso — criticidad "${row.criticidad}" no reconocida, se usará "media".`);
    }

    validos.push({
      codigo,
      nombre,
      tipo: norm(row.tipo),
      marca: norm(row.marca),
      modelo: norm(row.modelo),
      serie: norm(row.serie),
      fabricante: norm(row.fabricante),
      fechaCompra: norm(row.fechaCompra),
      fechaInstalacion: norm(row.fechaInstalacion),
      area: norm(row.area),
      sala: norm(row.sala),
      estado,
      criticidad,
      valorAdquisicion: norm(row.valorAdquisicion),
      vidaUtilAnios: norm(row.vidaUtilAnios),
      hojaVidaUrl: norm(row.hojaVidaUrl),
    });
  });

  console.log(`\n${validos.length} registros listos para subir.`);
  if (errores.length) {
    console.log(`\n⚠ ${errores.length} avisos/errores encontrados:`);
    errores.forEach((e) => console.log("  - " + e));
  }

  if (dryRun) {
    console.log("\n(modo --dry-run: no se subió nada a Firestore. Corrige los avisos y vuelve a correr sin --dry-run.)");
    return;
  }

  if (validos.length === 0) {
    console.log("\nNo hay registros válidos para subir. Revisa el CSV y vuelve a intentar.");
    return;
  }

  const BATCH_SIZE = 400; // Firestore permite máx. 500 escrituras por batch
  let subidos = 0;
  for (let i = 0; i < validos.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = validos.slice(i, i + BATCH_SIZE);
    chunk.forEach((equipo) => {
      const ref = db.collection("equipos").doc();
      batch.set(ref, { ...equipo, creadoEn: admin.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
    subidos += chunk.length;
    console.log(`  Subidos ${subidos}/${validos.length}...`);
  }

  console.log(`\n✅ Carga completa: ${subidos} equipos nuevos en el inventario.`);
}

main().catch((err) => {
  console.error("\nError inesperado:", err);
  process.exit(1);
});
