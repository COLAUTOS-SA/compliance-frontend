import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Navbar from "./components/Navbar.jsx";
import Segment from "./pages/Segment.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { firstSegmentOf } from "./constants/segments.js";
import AdminConsole from "./pages/AdminConsole.jsx";
import SeguimientoSolicitud from "./pages/SeguimientoSolicitud.jsx";

function HomeRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // 🔹 Admin siempre al panel administrativo
  if (user.role === "admin") return <Navigate to="/admin" replace />;

  const dest = `/segment/${firstSegmentOf(user.role)}`;
  return <Navigate to={dest} replace />;
}

function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-neutral-200">
        <Routes>
          <Route index element={<HomeRedirect />} />
          <Route path="/segment/:segmento" element={<Segment />} />
          <Route path="/admin" element={<AdminConsole />} /> {/* NUEVO */}
          <Route path="/seguimiento" element={<SeguimientoSolicitud />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t bg-white text-xs text-gray-500 py-3 text-center">
        © {new Date().getFullYear()} Debida Diligencia — Demo
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<AppShell />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
