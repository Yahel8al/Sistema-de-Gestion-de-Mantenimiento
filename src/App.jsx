import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Alertas from "./pages/Alertas";
import Calendario from "./pages/Calendario";
import Inventario from "./pages/Inventario";
import Historial from "./pages/Historial";
import Calibraciones from "./pages/Calibraciones";
import Preventivos from "./pages/Preventivos";
import Correctivos from "./pages/Correctivos";
import OrdenesTrabajo from "./pages/OrdenesTrabajo";
import Incidencias from "./pages/Incidencias";
import Cumplimiento from "./pages/Cumplimiento";
import Trazabilidad from "./pages/Trazabilidad";
import Repuestos from "./pages/Repuestos";
import Proveedores from "./pages/Proveedores";
import Documentos from "./pages/Documentos";
import KPIs from "./pages/KPIs";
import Reportes from "./pages/Reportes";
import Usuarios from "./pages/Usuarios";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-paper)" }}>
        <span className="text-sm" style={{ color: "var(--color-muted)" }}>Cargando…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/alertas" element={<ProtectedRoute><Alertas /></ProtectedRoute>} />
      <Route path="/calendario" element={<ProtectedRoute><Calendario /></ProtectedRoute>} />
      <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
      <Route path="/historial" element={<ProtectedRoute><Historial /></ProtectedRoute>} />
      <Route path="/calibraciones" element={<ProtectedRoute><Calibraciones /></ProtectedRoute>} />
      <Route path="/preventivos" element={<ProtectedRoute><Preventivos /></ProtectedRoute>} />
      <Route path="/correctivos" element={<ProtectedRoute><Correctivos /></ProtectedRoute>} />
      <Route path="/ordenes" element={<ProtectedRoute><OrdenesTrabajo /></ProtectedRoute>} />
      <Route path="/incidencias" element={<ProtectedRoute><Incidencias /></ProtectedRoute>} />
      <Route path="/cumplimiento" element={<ProtectedRoute><Cumplimiento /></ProtectedRoute>} />
      <Route path="/trazabilidad" element={<ProtectedRoute><Trazabilidad /></ProtectedRoute>} />
      <Route path="/repuestos" element={<ProtectedRoute><Repuestos /></ProtectedRoute>} />
      <Route path="/proveedores" element={<ProtectedRoute><Proveedores /></ProtectedRoute>} />
      <Route path="/documentos" element={<ProtectedRoute><Documentos /></ProtectedRoute>} />
      <Route path="/kpis" element={<ProtectedRoute><KPIs /></ProtectedRoute>} />
      <Route path="/reportes" element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
