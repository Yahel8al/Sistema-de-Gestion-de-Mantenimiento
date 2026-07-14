import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { FileWarning } from "lucide-react";
import { db } from "../lib/firebase";
import CollectionManager from "../components/CollectionManager";
import { Badge } from "../components/ui";

export default function Incidencias() {
  const [equipos, setEquipos] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "equipos"), (s) => setEquipos(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  const fields = [
    { key: "equipoId", label: "Equipo involucrado", type: "select", required: true, options: equipos.map((e) => ({ value: e.id, label: `${e.codigo} — ${e.nombre}` })) },
    { key: "fechaEvento", label: "Fecha del evento", type: "date", required: true },
    { key: "gravedad", label: "Gravedad", type: "select", options: [{ value: "alta", label: "Alta" }, { value: "media", label: "Media" }, { value: "baja", label: "Baja" }] },
    { key: "retiradoServicio", label: "¿Equipo retirado de servicio?", type: "checkbox" },
    { key: "descripcionEvento", label: "Descripción del evento adverso", type: "textarea", span: 2, required: true },
    { key: "accionesCorrectivas", label: "Acciones correctivas tomadas", type: "textarea", span: 2 },
    { key: "estadoSeguimiento", label: "Estado del seguimiento", type: "select", options: [{ value: "abierta", label: "Abierta" }, { value: "en_seguimiento", label: "En seguimiento" }, { value: "cerrada", label: "Cerrada" }] },
  ];

  const columns = [
    { key: "equipoId", label: "Equipo", render: (r) => equipos.find((e) => e.id === r.equipoId)?.nombre || "—" },
    { key: "fechaEvento", label: "Fecha" },
    { key: "gravedad", label: "Gravedad", render: (r) => <Badge color={r.gravedad === "alta" ? "critical" : r.gravedad === "media" ? "warn" : "ok"}>{r.gravedad || "—"}</Badge> },
    { key: "estadoSeguimiento", label: "Seguimiento", render: (r) => <Badge color={r.estadoSeguimiento === "cerrada" ? "ok" : "warn"}>{r.estadoSeguimiento || "abierta"}</Badge> },
  ];

  return (
    <CollectionManager
      collectionName="incidencias"
      moduleKey="incidencias"
      title="Gestión de incidencias"
      description="Eventos adversos, retiro de servicio, acciones correctivas y seguimiento"
      icon={FileWarning}
      fields={fields}
      columns={columns}
      searchKeys={["descripcionEvento"]}
      emptyTitle="Sin incidencias registradas"
      emptyDescription="Registra un evento adverso relacionado con un equipo para iniciar su seguimiento."
    />
  );
}
