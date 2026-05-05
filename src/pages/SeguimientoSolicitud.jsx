import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const RAW_API = import.meta.env.VITE_API_URL;
const API_URL =
  RAW_API && !RAW_API.startsWith("/")
    ? RAW_API.replace(/\/$/, "")
    : "https://compliance.colautos.co/api";

const STATUS_COLORS = {
  aprobado: "bg-green-100 text-green-800 border-green-200",
  rechazado: "bg-red-100 text-red-800 border-red-200",
  pendiente: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

function StatusBadge({ value }) {
  const val = value || "pendiente";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
        STATUS_COLORS[val] || STATUS_COLORS.pendiente
      }`}
    >
      <span className="text-[8px]">●</span>
      {val}
    </span>
  );
}

// Mapea el texto del estado de BD a los 3 estados del front
function mapEstadoArchivoToStatus(estado) {
  if (!estado) return "pendiente";
  const up = String(estado).toUpperCase();
  if (up.includes("APROB")) return "aprobado";
  if (up.includes("RECHAZ")) return "rechazado";
  return "pendiente";
}

const formatDate = (iso) => {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export default function SeguimientoUsuario() {
  const { user } = useAuth();

  // Si no hay sesión → al login
  if (!user) return <Navigate to="/login" replace />;

  // Si entra alguien que NO es contraparte normal → opcional: lo sacas
  if (user.role !== "usuario") {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">No autorizado</h2>
          <p className="text-sm text-gray-600">
            Esta vista es solo para contrapartes que consultan su solicitud.
          </p>
        </div>
      </div>
    );
  }

  // Tomamos correo y documento desde la sesión
  const email = useMemo(
    () =>
      (user.email || user.username || user.correo || "")
        .toString()
        .trim()
        .toLowerCase(),
    [user]
  );
  const numeroDocumento = useMemo(
    () =>
      (user.numeroDocumento || user.nro_doc || user.documento || "")
        .toString()
        .trim(),
    [user]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [contraparte, setContraparte] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [filesBySolicitud, setFilesBySolicitud] = useState({});

  const hasData = useMemo(
    () => !!contraparte && solicitudes.length > 0,
    [contraparte, solicitudes]
  );

  useEffect(() => {
    const load = async () => {
      if (!email) {
        setError("No se encontró el correo en la sesión del usuario.");
        return;
      }

      setLoading(true);
      setError("");
      setContraparte(null);
      setSolicitudes([]);
      setFilesBySolicitud({});

      try {
        // 1) CONTRAPARTE por correo (y opcionalmente por documento)
        const contraRes = await fetch(`${API_URL}/contrapartes`);
        const contraJson = await contraRes.json();
        if (!contraRes.ok || !contraJson.success) {
          throw new Error(
            contraJson.message || "Error al obtener contrapartes"
          );
        }

        const contras = contraJson.data || [];

        let match = contras.find((c) => {
          const mailBD = String(c.Correo || "").toLowerCase();
          if (numeroDocumento) {
            return (
              mailBD === email &&
              String(c.Nro_doc || "") === String(numeroDocumento)
            );
          }
          // Si en la sesión no viene el número, filtramos solo por correo
          return mailBD === email;
        });

        if (!match) {
          setError(
            "No se encontró ninguna solicitud asociada a tus datos de inicio de sesión."
          );
          return;
        }

        setContraparte(match);

        // 2) SOLICITUDES de esa contraparte
        const solRes = await fetch(`${API_URL}/solicitudes`);
        const solJson = await solRes.json();
        if (!solRes.ok || !solJson.success) {
          throw new Error(solJson.message || "Error al obtener solicitudes");
        }

        const sols = (solJson.data || []).filter(
          (s) => s.id_contraparte === match.id
        );
        setSolicitudes(sols);

        if (sols.length === 0) {
          return;
        }

        // 3) ARCHIVOS y agruparlos por id_solicitud
        const archRes = await fetch(`${API_URL}/archivos`);
        const archJson = await archRes.json();
        if (!archRes.ok || !archJson.success) {
          throw new Error(archJson.message || "Error al obtener archivos");
        }

        const archivos = archJson.data || [];
        const bySolicitud = archivos.reduce((acc, a) => {
          if (!a.id_solicitud) return acc;
          if (!acc[a.id_solicitud]) acc[a.id_solicitud] = [];
          acc[a.id_solicitud].push(a);
          return acc;
        }, {});

        setFilesBySolicitud(bySolicitud);
      } catch (err) {
        console.error("Error en seguimiento usuario:", err);
        setError(err.message || "Error al consultar la información.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [email, numeroDocumento]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Seguimiento de tu solicitud
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Aquí puedes ver el estado de tu proceso de debida diligencia y los
          documentos revisados por el área de Cumplimiento.
        </p>

        {loading && (
          <p className="mt-3 text-sm text-gray-500">Cargando información…</p>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Datos de la contraparte + solicitudes */}
      {contraparte && (
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {contraparte.Nombre}
              </h2>
              <p className="text-sm text-gray-500">
                {contraparte.Tipo_Contraparte} — {contraparte.Segmento}
              </p>
            </div>
            <div className="text-xs text-gray-500">
              <div>
                <span className="font-semibold">Correo: </span>
                {contraparte.Correo}
              </div>
              <div>
                <span className="font-semibold">Documento: </span>
                {contraparte.Tipo_doc} {contraparte.Nro_doc}
              </div>
            </div>
          </div>

          {solicitudes.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">
              No se encontraron solicitudes asociadas a tu usuario.
            </p>
          ) : (
            <div className="space-y-4 mt-2">
              {solicitudes.map((sol) => {
                const archivos = filesBySolicitud[sol.id] || [];
                return (
                  <div
                    key={sol.id}
                    className="border border-gray-200 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Solicitud #{sol.id}
                        </h3>
                        <p className="text-xs text-gray-500">
                          Fecha creación: {formatDate(sol.fecha_actual)} —
                          Última actualización:{" "}
                          {formatDate(sol.fecha_ult_actualizacion)}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-semibold">
                          Estado general ID:
                        </span>{" "}
                        {sol.id_ult_estado}
                      </div>
                    </div>

                    {archivos.length === 0 ? (
                      <p className="text-xs text-gray-500 mt-1">
                        Aún no hay archivos registrados para esta solicitud.
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 mt-2">
                        {archivos.map((a) => {
                          const status = mapEstadoArchivoToStatus(a.Estado);
                          return (
                            <div
                              key={a.id}
                              className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <p className="text-[11px] font-semibold text-gray-700 uppercase">
                                    {a.tipo_documento || "DOCUMENTO"}
                                  </p>
                                  <p className="text-xs text-gray-700">
                                    {a.nombre_archivo}
                                  </p>
                                  <p className="text-[11px] text-gray-500">
                                    Estado BD: {a.Estado}
                                  </p>
                                </div>
                                <StatusBadge value={status} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!hasData && !loading && !error && (
        <p className="text-xs text-gray-400 text-center">
          En cuanto se cree una solicitud asociada a tu usuario, la verás aquí.
        </p>
      )}
    </div>
  );
}
