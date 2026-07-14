import {
  LayoutDashboard, Boxes, History, CalendarClock, Wrench, Siren,
  ClipboardList, BadgeCheck, FileWarning, ShieldCheck, ScrollText,
  PackageSearch, Truck, FolderOpen, Gauge, FileBarChart, Users, BellRing,
} from "lucide-react";

// Roles del sistema y jerarquía de permisos
export const ROLES = {
  admin: { label: "Administrador", level: 5 },
  ingeniero: { label: "Ingeniero clínico", level: 4 },
  supervisor: { label: "Supervisor", level: 4 },
  tecnico: { label: "Técnico biomédico", level: 3 },
  auditor: { label: "Auditor", level: 2 },
  clinico: { label: "Usuario clínico", level: 1 },
};

// Estructura de navegación agrupada por dominio funcional.
// "roles: null" = visible para todos los roles autenticados.
export const NAV_GROUPS = [
  {
    label: "Panel",
    items: [
      { key: "dashboard", label: "Panel de control", path: "/", icon: LayoutDashboard, roles: null },
      { key: "alertas", label: "Alertas y notificaciones", path: "/alertas", icon: BellRing, roles: null },
      { key: "calendario", label: "Calendario por área", path: "/calendario", icon: CalendarClock, roles: null },
    ],
  },
  {
    label: "Equipos",
    items: [
      { key: "inventario", label: "Inventario de equipos", path: "/inventario", icon: Boxes, roles: null },
      { key: "historial", label: "Historial del equipo", path: "/historial", icon: History, roles: null },
      { key: "calibraciones", label: "Calibraciones", path: "/calibraciones", icon: BadgeCheck, roles: null },
    ],
  },
  {
    label: "Mantenimiento",
    items: [
      { key: "preventivos", label: "Mant. preventivos", path: "/preventivos", icon: Wrench, roles: null },
      { key: "correctivos", label: "Mant. correctivos", path: "/correctivos", icon: Siren, roles: null },
      { key: "ordenes", label: "Órdenes de trabajo", path: "/ordenes", icon: ClipboardList, roles: null },
    ],
  },
  {
    label: "Calidad y cumplimiento",
    items: [
      { key: "incidencias", label: "Incidencias", path: "/incidencias", icon: FileWarning, roles: null },
      { key: "cumplimiento", label: "Cumplimiento normativo", path: "/cumplimiento", icon: ShieldCheck, roles: null },
      { key: "trazabilidad", label: "Trazabilidad / auditoría", path: "/trazabilidad", icon: ScrollText, roles: ["admin", "ingeniero", "auditor", "supervisor"] },
    ],
  },
  {
    label: "Recursos",
    items: [
      { key: "repuestos", label: "Repuestos e inventario", path: "/repuestos", icon: PackageSearch, roles: null },
      { key: "proveedores", label: "Proveedores", path: "/proveedores", icon: Truck, roles: null },
      { key: "documentos", label: "Gestión documental", path: "/documentos", icon: FolderOpen, roles: null },
    ],
  },
  {
    label: "Gestión",
    items: [
      { key: "kpis", label: "Indicadores (KPI)", path: "/kpis", icon: Gauge, roles: null },
      { key: "reportes", label: "Reportes", path: "/reportes", icon: FileBarChart, roles: null },
      { key: "usuarios", label: "Usuarios", path: "/usuarios", icon: Users, roles: ["admin"] },
    ],
  },
];

export const EQUIPMENT_STATUS = {
  activo: { label: "Activo", color: "ok" },
  mantenimiento: { label: "En mantenimiento", color: "warn" },
  fuera_servicio: { label: "Fuera de servicio", color: "critical" },
  baja: { label: "Dado de baja", color: "idle" },
};

export const CRITICALITY = {
  alta: { label: "Alta", color: "critical" },
  media: { label: "Media", color: "warn" },
  baja: { label: "Baja", color: "ok" },
};

export const AREAS = [
  "Cuidados Intensivos (UCI)", "Quirófanos", "Emergencias", "Imagenología",
  "Laboratorio Clínico", "Hemodiálisis", "Hospitalización", "Consulta Externa",
  "Esterilización", "Neonatología",
];
