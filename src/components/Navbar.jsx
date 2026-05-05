import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SEGMENTS_BY_ROLE, firstSegmentOf } from "../constants/segments.js";
import { FiLogOut, FiUser, FiChevronDown } from "react-icons/fi";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = SEGMENTS_BY_ROLE[user?.role] || [];

  // slug actual (si no pertenece al rol, usa el primero)
  let currentSlug = "";
  if (user?.role && user.role !== "admin" && tabs.length > 0) {
    const rawSlug = location.pathname.startsWith("/segment/")
      ? location.pathname.replace("/segment/", "")
      : tabs[0]?.slug;

    currentSlug = tabs.some((t) => t.slug === rawSlug)
      ? rawSlug
      : firstSegmentOf(user.role);
  }

  const goSegment = (slug) => navigate(`/segment/${slug}`);

  const roleLabel =
    user?.role?.charAt(0)?.toUpperCase() + (user?.role?.slice(1) || "");

  return (
    <header className="bg-white border-b border-gray-200">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* <div className="h-9 w-9 rounded-xl bg-primary-600 text-white grid place-content-center font-semibold">
            DD
          </div> */}
          <div className="flex items-center">
            <img src="/logonew.webp" alt="Logo" className="w-32 h-12" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Debida Diligencia
              </h1>
              {/* <p className="text-xs text-gray-500">
                Onboarding y firma electrónica
              </p> */}
            </div>
          </div>

          {/* Acceso rápido al admin */}
          {/* {user?.role === "admin" && (
            <NavLink
              to="/admin"
              className="ml-3 text-xs font-medium px-2 py-1 rounded-lg border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100"
              title="Consola de administración"
            >
              Admin
            </NavLink>
          )} */}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-700">
            <FiUser className="text-primary-600" />
            <span className="font-medium">{user?.name}</span>
            <span className="text-gray-400">•</span>
            <span className="uppercase">{user?.role}</span>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            title="Salir"
          >
            <FiLogOut /> Salir
          </button>
        </div>
      </div>

      {/* Selector de segmento (oculto para admin) */}
      {user?.role !== "admin" && tabs.length > 0 && (
        <div className="border-t border-blue-200 bg-neutral-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              {/* Texto explicativo */}
              <div className="sm:max-w-md">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                  Segmento actual
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Selecciona el segmento de{" "}
                  <span className="font-medium">{roleLabel}</span> para el cual
                  vas a diligenciar la información y firmar los documentos.
                </p>
              </div>

              {/* Select bonito */}
              <div className="relative w-full sm:max-w-md">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Segmento de debida diligencia
                </label>
                <select
                  value={currentSlug}
                  onChange={(e) => goSegment(e.target.value)}
                  className="w-full appearance-none border border-blue-500 rounded-xl bg-white px-4 py-2.5 pr-10 text-sm text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                >
                  {tabs.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-3 top-[2.1rem] text-gray-500" />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
