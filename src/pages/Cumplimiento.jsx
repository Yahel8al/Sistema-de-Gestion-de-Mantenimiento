import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { ShieldCheck } from "lucide-react";
import { db } from "../lib/firebase";
import CollectionManager from "../components/CollectionManager";
import { Badge } from "../components/ui";

const NORMAS = [
  { value: "iec_60601", label: "IEC 60601 — Seguridad eléctrica" },
  { value: "iso_13485", label: "ISO 13485 — Gestión de calidad" },
  { value: "iso_14971", label: "ISO 14971 — Gestión de riesgos" },
  { value: "autoridad_sanitaria", label: "Autoridad sanitaria nacional (INVIMA/COFEPRIS/ANMAT/DIGEMID/FDA u otra)" },
];

export default function Cumplimiento() {
  const [equipos, setEquipos] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  const fields = [
    { key: "equipoId", label: "Equipo", type: "select", required: true, options: equipos.map((e) => ({ value: e.id, label: `${e.codigo} — ${e.nombre}` })) },
    { key: "norma", label: "Norma / requisito", type: "select", required: true, options: NORMAS },
    { key: "estado", label: "Estado de cumplimiento", type: "select", options: [{ value: "conforme", label: "Conforme" }, { value: "en_proceso", label: "En proceso" }, { value: "no_conforme", label: "No conforme" }] },
    { key: "fechaVerificacion", label: "Fecha de verificación", type: "date" },
    { key: "evidencia", label: "Evidencia / observaciones", type: "textarea", span: 2 },
    { key: "responsable", label: "Responsable de la verificación" },
  ];

  const columns = [
    { key: "equipoId", label: "Equipo", render: (r) => equipos.find((e) => e.id === r.equipoId)?.nombre || "—" },
    { key: "norma", label: "Norma", render: (r) => <Badge color="info">{NORMAS.find((n) => n.value === r.norma)?.label.split(" — ")[0] || r.norma}</Badge> },
    { key: "estado", label: "Estado", render: (r) => <Badge color={r.estado === "conforme" ? "ok" : r.estado === "no_conforme" ? "critical" : "warn"}>{r.estado || "en_proceso"}</Badge> },
    { key: "fechaVerificacion", label: "Verificado" },
  ];

  return (
    <CollectionManager
      collectionName="cumplimiento_normativo"
      moduleKey="cumplimiento"
      title="Cumplimiento normativo"
      description="Seguimiento de IEC 60601, ISO 13485, ISO 14971 y autoridades sanitarias"
      icon={ShieldCheck}
      fields={fields}
      columns={columns}
      searchKeys={["responsable"]}
      emptyTitle="Sin verificaciones registradas"
      emptyDescription="Registra la verificación normativa de un equipo frente a una norma aplicable."
    />
  );
}
