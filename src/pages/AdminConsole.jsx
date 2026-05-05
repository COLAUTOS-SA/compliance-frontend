import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Navigate } from "react-router-dom";
import {
  COUNTERPART_TYPES,
  SEGMENTS_BY_TYPE,
} from "../constants/adminCatalogs.js";
import {
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiFileText,
  FiMail,
  FiSearch,
  FiUpload,
  FiUser,
  FiXCircle,
} from "react-icons/fi";

// URL base del backend
const RAW_API = import.meta.env.VITE_API_URL;
const API_URL =
  RAW_API && !RAW_API.startsWith("/")
    ? RAW_API.replace(/\/$/, "")
    : "https://compliance.colautos.co/api";

/**
 * IMPORTANTE:
 * Ajusta estos IDs según tu tabla estado_archivo
 * (lo ideal es que en DB tengas algo como: 1=PENDIENTE, 2=APROBADO, 3=RECHAZADO)
 */
const ESTADO_ARCHIVO_ID = {
  pendiente: 1,
  aprobado: 2,
  rechazado: 3,
};

// Para pintar la UI
const STATUS_COLORS = {
  aprobado: "bg-green-100 text-green-800 border-green-200",
  rechazado: "bg-red-100 text-red-800 border-red-200",
  pendiente: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

function mapSolicitudEstadoToStatus(rawEstadoId) {
  const id = Number(rawEstadoId);
  if (id === 2) return "aprobado";
  if (id === 3) return "rechazado";
  return "pendiente";
}

const StatusBadge = ({ value }) => {
  const map = {
    aprobado: <FiCheckCircle className="inline mr-1" />,
    rechazado: <FiXCircle className="inline mr-1" />,
    pendiente: <FiClock className="inline mr-1" />,
  };
  const val = value || "pendiente";
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border ${
        STATUS_COLORS[val] || STATUS_COLORS.pendiente
      }`}
    >
      {map[val] || map.pendiente}
      {val}
    </span>
  );
};

const formatDate = (iso) => {
  if (!iso) return "Sin cambios";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin cambios";
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
};

// Mapea clave del select al texto de la BD
function mapTypeKeyToNombreBD(typeKey) {
  switch (typeKey) {
    case "proveedores":
      return "PROVEEDOR";
    case "clientes":
      return "CLIENTE";
    case "accionistas":
      return "ACCIONISTA";
    case "empleados":
      return "EMPLEADO";
    default:
      return null;
  }
}

// Mapea Estado (texto) -> status front
function mapEstadoTextoToStatus(estadoTexto) {
  const s = (estadoTexto ?? "").toString().toUpperCase();
  if (s.includes("APROB")) return "aprobado";
  if (s.includes("RECHAZ")) return "rechazado";
  return "pendiente";
}

// (Opcional) si tu endpoint de archivos NO trae id_estado_archivo, usamos el texto.
// Si sí lo trae, esto lo hace más robusto.
function mapArchivoToStatus(archivo) {
  if (archivo?.id_estado_archivo) {
    const id = Number(archivo.id_estado_archivo);
    if (id === ESTADO_ARCHIVO_ID.aprobado) return "aprobado";
    if (id === ESTADO_ARCHIVO_ID.rechazado) return "rechazado";
    return "pendiente";
  }
  return mapEstadoTextoToStatus(archivo?.Estado);
}

// Helpers fetch
async function fetchJson(url, opts) {
  const resp = await fetch(url, opts);
  const text = await resp.text();
  // Evita el error JSON cuando el backend devuelve HTML
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Respuesta no JSON desde ${url}: ${text?.slice(0, 60) || ""}`,
    );
  }
  if (!resp.ok || (json && json.success === false)) {
    throw new Error(json?.message || `Error HTTP ${resp.status}`);
  }
  return json;
}

export default function AdminConsole() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Acceso restringido
          </h2>
          <p className="text-sm text-gray-600">
            Solo usuarios con rol <strong>admin</strong>.
          </p>
        </div>
      </div>
    );
  }

  // ----- filtros
  const [type, setType] = useState(COUNTERPART_TYPES[0].key);
  const segments = SEGMENTS_BY_TYPE[type] || [];
  const [segment, setSegment] = useState(segments[0]?.slug || "");

  useEffect(() => {
    setSegment(segments[0]?.slug || "");
  }, [type, segments]);

  // ----- data
  const [rows, setRows] = useState([]);
  const [archivosAll, setArchivosAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // buscador + paginación
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sortBy, setSortBy] = useState("fecha_ult_actualizacion");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  // Modal
  const [openRowId, setOpenRowId] = useState(null);

  // Guardado modal
  const [savingModal, setSavingModal] = useState(false);
  const [modalMsg, setModalMsg] = useState({ ok: "", err: "" });
  const [solicitudStatusEdit, setSolicitudStatusEdit] = useState("pendiente");
  const [responseFile, setResponseFile] = useState(null);
  const [uploadingResponse, setUploadingResponse] = useState(false);
  const [responseMsg, setResponseMsg] = useState({ ok: "", err: "" });

  /**
   * grid[archivoId] = { status, concepto }
   * (NO por tipo_documento, porque se pisa)
   */
  const [grid, setGrid] = useState({});

  // Carga principal
  useEffect(() => {
    const load = async () => {
      if (!segment) {
        setRows([]);
        setArchivosAll([]);
        setGrid({});
        return;
      }

      setLoading(true);
      setError("");
      setModalMsg({ ok: "", err: "" });

      try {
        const [solJson, contraJson, archJson] = await Promise.all([
          fetchJson(`${API_URL}/solicitudes`),
          fetchJson(`${API_URL}/contrapartes`),
          fetchJson(`${API_URL}/archivos`),
        ]);

        const solicitudes = solJson.data || [];
        const contrapartes = contraJson.data || [];
        const archivos = archJson.data || [];

        setArchivosAll(archivos);

        const tipoBD = mapTypeKeyToNombreBD(type);

        // Segmento actual (requiere segmentId en adminCatalogs)
        const currentSegmentObj =
          (SEGMENTS_BY_TYPE[type] || []).find((s) => s.slug === segment) ||
          null;
        const segmentId = currentSegmentObj?.segmentId || null;

        // join solicitud + contraparte
        const joined = solicitudes
          .map((sol) => {
            const c = contrapartes.find((ct) => ct.id === sol.id_contraparte);
            if (!c) return null;

            return {
              id: sol.id, // id solicitud
              id_solicitud: sol.id,
              id_contraparte: c.id,
              id_estado_solicitud:
                sol.id_estado_solicitud ?? sol.id_ult_estado ?? null,
              counterpartType: c.Tipo_Contraparte,
              id_segmento: c.id_segmento,
              segmentName: c.Segmento,
              nombre: c.Nombre,
              email: c.Correo,
              tipoDocumento: c.Tipo_doc,
              numeroDocumento: c.Nro_doc,
              firmadoUrl: sol.conocimiento_contrapartes,
              fecha_actual: sol.fecha_actual,
              fecha_ult_actualizacion: sol.fecha_ult_actualizacion,
            };
          })
          .filter(Boolean);

        // filtro tipo + segmento
        const filtered = joined.filter((row) => {
          if (tipoBD && row.counterpartType !== tipoBD) return false;
          if (segmentId && Number(row.id_segmento) !== Number(segmentId))
            return false;
          return true;
        });

        setRows(filtered);

        // Inicializar grid desde archivos (concepto y estado reales)
        const nextGrid = {};
        for (const a of archivos) {
          // a.id es id del archivo en DB
          const archivoId = Number(a.id);
          if (!archivoId) continue;

          nextGrid[archivoId] = {
            status: mapArchivoToStatus(a),
            concepto: (a.concepto ?? "").toString(), // <- aquí se muestra lo guardado
            // Para mostrar fecha si tu query la trae:
            fecha_concepto: a.fecha_concepto || null,
          };
        }
        setGrid(nextGrid);

        setSearch("");
        setPage(1);
      } catch (e) {
        console.error(e);
        setError(e.message || "Error al cargar datos");
        setRows([]);
        setArchivosAll([]);
        setGrid({});
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [type, segment]);

  // openRow
  const openRow = useMemo(
    () => rows.find((r) => r.id === openRowId) || null,
    [rows, openRowId],
  );

  useEffect(() => {
    if (!openRow) return;
    setSolicitudStatusEdit(
      mapSolicitudEstadoToStatus(
        openRow.id_estado_solicitud ?? openRow.id_ult_estado ?? 1,
      ),
    );
  }, [openRow]);

  // Documentos (archivos) SOLO de la solicitud del modal
  const docsInModal = useMemo(() => {
    if (!openRow) return [];
    const sid = Number(openRow.id_solicitud);
    return (archivosAll || []).filter((a) => Number(a.id_solicitud) === sid);
  }, [openRow, archivosAll]);

  // búsqueda
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      const nameStr = (r.nombre ?? "").toString().toLowerCase();
      const docStr = (r.numeroDocumento ?? "").toString().toLowerCase();
      const emailStr = (r.email ?? "").toString().toLowerCase();
      return nameStr.includes(term) || docStr.includes(term) || emailStr.includes(term);
    });
  }, [rows, search]);

  const rowsWithComputedStatus = useMemo(
    () =>
      filteredRows.map((r) => ({
        ...r,
        solicitudStatus: mapSolicitudEstadoToStatus(r.id_estado_solicitud),
      })),
    [filteredRows],
  );

  const statusFilteredRows = useMemo(() => {
    if (statusFilter === "todos") return rowsWithComputedStatus;
    return rowsWithComputedStatus.filter(
      (r) => r.solicitudStatus === statusFilter,
    );
  }, [rowsWithComputedStatus, statusFilter]);

  const sortedRows = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    const copy = [...statusFilteredRows];
    copy.sort((a, b) => {
      if (sortBy === "nombre") {
        return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }) * factor;
      }
      if (sortBy === "documento") {
        return String(a.numeroDocumento).localeCompare(String(b.numeroDocumento), "es", {
          numeric: true,
          sensitivity: "base",
        }) * factor;
      }
      if (sortBy === "estado") {
        return (
          String(a.solicitudStatus).localeCompare(
            String(b.solicitudStatus),
            "es",
            {
              sensitivity: "base",
            },
          ) * factor
        );
      }
      const aDate = new Date(a.fecha_ult_actualizacion || a.fecha_actual || 0).getTime();
      const bDate = new Date(b.fecha_ult_actualizacion || b.fecha_actual || 0).getTime();
      return (aDate - bDate) * factor;
    });
    return copy;
  }, [statusFilteredRows, sortBy, sortDir]);

  useEffect(() => setPage(1), [search, statusFilter, sortBy, sortDir]);

  // paginación
  const totalPages = Math.max(
    1,
    Math.ceil(sortedRows.length / PAGE_SIZE) || 1,
  );
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(startIndex, startIndex + PAGE_SIZE);

  const showingFrom = sortedRows.length === 0 ? 0 : startIndex + 1;
  const showingTo =
    sortedRows.length === 0 ? 0 : startIndex + pagedRows.length;

  const onSort = (column) => {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir("asc");
  };

  const updateArchivoCell = (archivoId, patch) => {
    setGrid((g) => {
      const cur = g[archivoId] || { status: "pendiente", concepto: "" };
      return {
        ...g,
        [archivoId]: {
          ...cur,
          ...patch,
        },
      };
    });
  };

  // Guardar SOLO los archivos del modal
  const saveModal = async () => {
    if (!openRow) return;
    setSavingModal(true);
    setModalMsg({ ok: "", err: "" });

    try {
      // 1) Lista de archivos que están en este modal (solicitud)
      const archivos = docsInModal;

      // 2) Enviar 1 PUT por archivo
      //    Si quieres optimizar: luego creas un endpoint bulk, pero con tu API actual es 1x1.
      for (const a of archivos) {
        const archivoId = Number(a.id);
        const cell = grid[archivoId] || {};

        const status = cell.status || "pendiente";
        const id_estado_archivo =
          ESTADO_ARCHIVO_ID[status] || ESTADO_ARCHIVO_ID.pendiente;

        await fetchJson(`${API_URL}/archivos/${archivoId}/revision`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_estado_archivo,
            concepto: (cell.concepto ?? "").toString(),
            id_usuario_concepto: user?.id || null, // si tu auth guarda el id
          }),
        });
      }

      const solicitudEstadoId =
        solicitudStatusEdit === "aprobado"
          ? 2
          : solicitudStatusEdit === "rechazado"
            ? 3
            : 1;

      await fetchJson(`${API_URL}/solicitudes/${openRow.id_solicitud}/estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_estado_solicitud: solicitudEstadoId,
        }),
      });

      // 3) Refrescar archivos para que el modal muestre lo persistido (fecha, estado, etc.)
      const archJson = await fetchJson(`${API_URL}/archivos`);
      const archivosActualizados = archJson.data || [];
      setArchivosAll(archivosActualizados);

      // Rehidratar grid desde lo persistido
      const nextGrid = {};
      for (const a of archivosActualizados) {
        const archivoId = Number(a.id);
        if (!archivoId) continue;
        nextGrid[archivoId] = {
          status: mapArchivoToStatus(a),
          concepto: (a.concepto ?? "").toString(),
          fecha_concepto: a.fecha_concepto || null,
        };
      }
      setGrid(nextGrid);

      setModalMsg({ ok: "Conceptos guardados correctamente.", err: "" });
    } catch (e) {
      console.error(e);
      setModalMsg({ ok: "", err: e.message || "Error guardando conceptos" });
    } finally {
      setSavingModal(false);
    }
  };

  const uploadResponseDocument = async () => {
    if (!openRow || !responseFile) return;
    setUploadingResponse(true);
    setResponseMsg({ ok: "", err: "" });

    try {
      const fd = new FormData();
      fd.append("archivo_respuesta", responseFile);

      const resp = await fetch(
        `${API_URL}/solicitudes/${openRow.id_solicitud}/archivo-respuesta`,
        {
          method: "PUT",
          body: fd,
        },
      );
      const json = await resp.json();
      if (!resp.ok || json?.success === false) {
        throw new Error(json?.message || "No se pudo cargar archivo de respuesta");
      }

      const archJson = await fetchJson(`${API_URL}/archivos`);
      setArchivosAll(archJson.data || []);
      setResponseFile(null);
      setResponseMsg({ ok: "Archivo de respuesta cargado correctamente.", err: "" });
    } catch (e) {
      setResponseMsg({ ok: "", err: e.message || "No se pudo registrar el archivo de respuesta." });
    } finally {
      setUploadingResponse(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        {/* Header + filtros + buscador */}
        <div className="px-6 py-4 border-b border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Panel de aprobación</h2>
              <p className="text-sm text-gray-500">
                Gestiona solicitudes, revisa soportes y registra conceptos por
                archivo.
              </p>
            </div>

            <div className="w-full md:w-64 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm shadow-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none"
                placeholder="Buscar por nombre o N° documento…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full md:w-auto">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-600 mb-1">
                Tipo de contraparte
              </span>
              <select
                className="border rounded-xl px-3 py-2 bg-white text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {COUNTERPART_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-600 mb-1">
                Segmento
              </span>
              <select
                className="border rounded-xl px-3 py-2 bg-white text-sm"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
              >
                {segments.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-600 mb-1">
                Estado de solicitud
              </span>
              <select
                className="border rounded-xl px-3 py-2 bg-white text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="p-4 overflow-auto">
          {loading && (
            <div className="text-center py-6 text-gray-500 animate-pulse">
              ⏳ Cargando solicitudes...
            </div>
          )}
          {error && <p className="text-xs text-red-600 px-3 pb-2">{error}</p>}

          <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-xl border border-gray-200 bg-white text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                <th className="px-3 py-3 text-center">
                  <button type="button" onClick={() => onSort("nombre")} className="inline-flex items-center gap-1 font-semibold">
                    Nombre {sortBy === "nombre" && (sortDir === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center">Correo</th>
                <th className="px-3 py-3 text-center">
                  <button type="button" onClick={() => onSort("documento")} className="inline-flex items-center gap-1 font-semibold">
                    Documento {sortBy === "documento" && (sortDir === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center">
                  <button type="button" onClick={() => onSort("estado")} className="inline-flex items-center gap-1 font-semibold">
                    Estado {sortBy === "estado" && (sortDir === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center">
                  <button type="button" onClick={() => onSort("fecha_ult_actualizacion")} className="inline-flex items-center gap-1 font-semibold">
                    Última actualización {sortBy === "fecha_ult_actualizacion" && (sortDir === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
                  </button>
                </th>
                <th className="px-3 py-3 text-center ">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    No hay solicitudes para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-3 text-center font-medium text-gray-900">{r.nombre}</td>
                    <td className="px-3 py-3 text-center text-xs text-gray-600">{r.email}</td>
                    <td className="px-3 py-3 text-center text-xs text-gray-700">
                      {r.tipoDocumento} - {r.numeroDocumento}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge value={r.solicitudStatus} />
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-gray-600">
                      {formatDate(r.fecha_ult_actualizacion || r.fecha_actual)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-end gap-2">
                        {r.firmadoUrl && (
                          <a
                            href={`${API_URL}/files/download?path=${encodeURIComponent(r.firmadoUrl)}&name=formulario_${r.id}.pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Ver firmado
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setOpenRowId(r.id);
                            setModalMsg({ ok: "", err: "" });
                            setResponseMsg({ ok: "", err: "" });
                          }}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs hover:bg-gray-200"
                        >
                          Documentos
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer paginación */}
        <div className="px-6 py-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs text-gray-500">
            {sortedRows.length > 0 ? (
              <>
                Mostrando{" "}
                <span className="font-semibold">
                  {showingFrom}–{showingTo}
                </span>{" "}
                de <span className="font-semibold">{sortedRows.length}</span>.
              </>
            ) : (
              <>Sin resultados.</>
            )}
          </div>

          {sortedRows.length > PAGE_SIZE && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-2 py-1 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="text-gray-600">
                Página <span className="font-semibold">{safePage}</span> de{" "}
                <span className="font-semibold">{totalPages}</span>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-2 py-1 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {openRow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-[90vw] max-w-6xl h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-2 bg-whiteborder-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  📄 Documentos de {openRow.nombre}
                </h3>
                <p className="text-xs text-gray-500">
                  Cada archivo se aprueba/rechaza y se registra concepto
                  individual.
                </p>
              </div>
              <button
                onClick={() => setOpenRowId(null)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100"
              >
                X
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* EMAIL */}
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-700 rounded-xl p-2 text-sm">
                    <FiMail />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                      Correo electrónico
                    </p>
                    <p className="text-sm text-gray-800 font-medium break-all">
                      {openRow.email}
                    </p>
                  </div>
                </div>

                {/* DOCUMENTO */}
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 text-purple-700 rounded-xl p-2 text-sm">
                    <FiUser />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                      Documento
                    </p>
                    <p className="text-sm text-gray-800 font-medium">
                      {openRow.tipoDocumento} {openRow.numeroDocumento}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                  Estado de la solicitud
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    value={solicitudStatusEdit}
                    onChange={(e) => setSolicitudStatusEdit(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                  <StatusBadge value={solicitudStatusEdit} />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">
                  Archivo de respuesta (solo Oficial de Cumplimiento)
                </p>
                <p className="mt-1 text-xs text-indigo-700">
                  Carga aquí documentación externa de soporte para esta solicitud.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-400 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                    <FiUpload />
                    Seleccionar archivo
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setResponseFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <span className="text-xs text-indigo-700">
                    {responseFile ? responseFile.name : "Ningún archivo seleccionado"}
                  </span>
                  <button
                    type="button"
                    onClick={uploadResponseDocument}
                    disabled={!responseFile || uploadingResponse}
                    className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingResponse ? "Cargando..." : "Guardar archivo de respuesta"}
                  </button>
                </div>
                {responseMsg.ok && <p className="mt-2 text-xs text-green-700">{responseMsg.ok}</p>}
                {responseMsg.err && <p className="mt-2 text-xs text-red-700">{responseMsg.err}</p>}
              </div>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 bg-gray-50">
              {docsInModal.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay archivos registrados.
                </p>
              ) : (
                <div className="w-full mx-auto grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {docsInModal.map((doc) => {
                    const archivoId = Number(doc.id);
                    const cell = grid[archivoId] || {
                      status: "pendiente",
                      concepto: "",
                      fecha_concepto: null,
                    };

                    return (
                      <div
                        key={doc.id}
                        className="bg-white border border-gray-200 rounded-2xl px-5 py-2 shadow-sm hover:shadow-lg transition space-y-4"
                      >
                        <div className="flex flex-col gap-4">
                          {/* HEADER */}
                          <div className="flex justify-between items-start gap-4">
                            <h2 className="text-sm font-semibold text-gray-900 leading-snug max-w-[70%]">
                              {(doc.tipo_documento ?? "DOCUMENTO").toString()}
                            </h2>

                            <div className="text-[10px] text-gray-400 text-right leading-tight">
                              <span className="block font-semibold text-gray-500">
                                Última actualización
                              </span>
                              {formatDate(
                                doc.fecha_concepto || cell.fecha_concepto,
                              )}
                            </div>
                          </div>

                          {/* NOMBRE ARCHIVO */}
                          <p className="text-xs text-gray-500 break-words">
                            {doc.nombre_archivo}
                          </p>

                          {/* LINK */}
                          <a
                            href={`${API_URL}/files/download?path=${encodeURIComponent(doc.ruta_archivo)}&name=${doc.nombre_archivo}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 w-fit"
                          >
                            📎 Ver / Descargar
                          </a>

                          {/* ESTADO */}
                          <div className="flex items-center gap-2">
                            <select
                              className="border rounded-lg px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-primary-200"
                              value={cell.status || "pendiente"}
                              onChange={(e) =>
                                updateArchivoCell(archivoId, {
                                  status: e.target.value,
                                })
                              }
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="aprobado">Aprobado</option>
                              <option value="rechazado">Rechazado</option>
                            </select>

                            <StatusBadge value={cell.status} />
                          </div>

                          {/* CONCEPTO */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-gray-600">
                              Concepto
                            </label>

                            <textarea
                              className="w-full min-h-[90px] border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-primary-200 resize-none"
                              placeholder="Escribe observaciones claras sobre este documento..."
                              value={cell.concepto ?? ""}
                              onChange={(e) =>
                                updateArchivoCell(archivoId, {
                                  concepto: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <div className="text-xs">
                {modalMsg.ok && (
                  <span className="text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                    {modalMsg.ok}
                  </span>
                )}
                {modalMsg.err && (
                  <span className="text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                    {modalMsg.err}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpenRowId(null)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Cerrar
                </button>
                <button
                  onClick={saveModal}
                  disabled={savingModal}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-xl"
                >
                  {savingModal ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
