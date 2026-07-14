import { Truck } from "lucide-react";
import CollectionManager from "../components/CollectionManager";

export default function Proveedores() {
  const fields = [
    { key: "nombre", label: "Nombre de la empresa", required: true, span: 2 },
    { key: "tipo", label: "Tipo", type: "select", options: [{ value: "mantenimiento", label: "Empresa de mantenimiento" }, { value: "fabricante", label: "Fabricante" }, { value: "calibracion", label: "Laboratorio de calibración" }, { value: "repuestos", label: "Proveedor de repuestos" }] },
    { key: "contacto", label: "Contacto" },
    { key: "telefono", label: "Teléfono" },
    { key: "email", label: "Correo electrónico" },
    { key: "tiempoRespuestaHoras", label: "Tiempo de respuesta (horas)", type: "number" },
    { key: "contrato", label: "Contrato vigente (descripción)", type: "textarea", span: 2 },
    { key: "vigenciaGarantia", label: "Vigencia de garantía", type: "date" },
  ];

  const columns = [
    { key: "nombre", label: "Proveedor" },
    { key: "tipo", label: "Tipo" },
    { key: "contacto", label: "Contacto" },
    { key: "tiempoRespuestaHoras", label: "Respuesta (h)" },
  ];

  return (
    <CollectionManager
      collectionName="proveedores"
      moduleKey="proveedores"
      title="Gestión de proveedores"
      description="Empresas de mantenimiento, fabricantes, contratos y tiempos de respuesta"
      icon={Truck}
      fields={fields}
      columns={columns}
      searchKeys={["nombre", "contacto", "email"]}
      emptyTitle="Sin proveedores registrados"
      emptyDescription="Agrega un proveedor o fabricante para vincularlo a contratos y garantías."
    />
  );
}
