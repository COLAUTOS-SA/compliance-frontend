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
  FiLock,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUpload,
  FiUser,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";

// URL base del backend
const RAW_API = import.meta.env.VITE_API_URL;
const API_URL = RAW_API
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

const fileNameFromPath = (value, fallback = "archivo") => {
  const name = String(value || "")
    .split(/[\\/]/)
    .pop();
  return name || fallback;
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
  const isAdmin = user?.role === "admin";
  const redirectToLogin = !user;
  const showRestricted = user && !isAdmin;
  const [activePanel, setActivePanel] = useState("solicitudes");

  // ----- filtros
  const [type, setType] = useState(COUNTERPART_TYPES[0].key);
  const segments = useMemo(() => SEGMENTS_BY_TYPE[type] || [], [type]);
  const [segment, setSegment] = useState(segments[0]?.slug || "");

  useEffect(() => {
    setSegment(segments[0]?.slug || "");
  }, [type, segments]);

  // ----- data
  const [rows, setRows] = useState([]);
  const [archivosAll, setArchivosAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersMsg, setUsersMsg] = useState({ ok: "", err: "" });
  const [userSearch, setUserSearch] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({
    nombre: "",
    correo: "",
    id_rol: "",
    contrasena: "",
  });
  const [passwordDrafts, setPasswordDrafts] = useState({});

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
  const [solicitudObservacion, setSolicitudObservacion] = useState("");
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
      if (!isAdmin || !segment) {
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
          segments.find((s) => s.slug === segment) || null;
        const segmentId = currentSegmentObj?.segmentId || null;

        // join solicitud + contraparte
        const joined = solicitudes
          .map((sol) => {
            const c = contrapartes.find((ct) => ct.id === sol.id_contraparte);
            if (!c) return null;

            return {
              id: sol.id,
              id_solicitud: sol.id,
              id_contraparte: c.id,
              id_estado_solicitud:
                sol.id_estado_solicitud ?? sol.id_ult_estado ?? null,
              observacion: sol.observacion ?? "",
              counterpartType: c.Tipo_Contraparte,
              id_segmento: c.id_segmento,
              segmentName: c.Segmento,
              nombre: c.Nombre,
              email: c.Correo,
              tipoDocumento: c.Tipo_doc,
              numeroDocumento: c.Nro_doc,
              firmadoUrl: sol.conocimiento_contrapartes,
              tratamientoDatosUrl: sol.tratamiento_datos,
              archivoRespuestaUrl: sol.archivo_respuesta_ruta,
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
  }, [isAdmin, segment, segments, type]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!isAdmin || activePanel !== "usuarios") return;

      setUsersLoading(true);
      setUsersMsg({ ok: "", err: "" });

      try {
        const [usuariosJson, rolesJson] = await Promise.all([
          fetchJson(`${API_URL}/usuarios`),
          fetchJson(`${API_URL}/roles`),
        ]);

        const nextRoles = rolesJson.data || [];
        setUsuarios(usuariosJson.data || []);
        setRoles(nextRoles);
        setUserForm((current) => ({
          ...current,
          id_rol: current.id_rol || String(nextRoles[0]?.id || ""),
        }));
      } catch (e) {
        setUsersMsg({
          ok: "",
          err: e.message || "No se pudieron cargar los usuarios",
        });
      } finally {
        setUsersLoading(false);
      }
    };

    loadUsers();
  }, [activePanel, isAdmin]);

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

    setSolicitudObservacion(openRow.observacion ?? "");
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
      return (
        nameStr.includes(term) ||
        docStr.includes(term) ||
        emailStr.includes(term)
      );
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

  const filteredUsuarios = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return usuarios;
    return usuarios.filter((u) =>
      [u.nombre, u.correo, u.nombre_rol]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [userSearch, usuarios]);

  const sortedRows = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    const copy = [...statusFilteredRows];
    copy.sort((a, b) => {
      if (sortBy === "nombre") {
        return (
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }) *
          factor
        );
      }
      if (sortBy === "documento") {
        return (
          String(a.numeroDocumento).localeCompare(
            String(b.numeroDocumento),
            "es",
            {
              numeric: true,
              sensitivity: "base",
            },
          ) * factor
        );
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
      const aDate = new Date(
        a.fecha_ult_actualizacion || a.fecha_actual || 0,
      ).getTime();
      const bDate = new Date(
        b.fecha_ult_actualizacion || b.fecha_actual || 0,
      ).getTime();
      return (aDate - bDate) * factor;
    });
    return copy;
  }, [statusFilteredRows, sortBy, sortDir]);

  useEffect(() => setPage(1), [search, statusFilter, sortBy, sortDir]);

  // paginación
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE) || 1);
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(startIndex, startIndex + PAGE_SIZE);

  const showingFrom = sortedRows.length === 0 ? 0 : startIndex + 1;
  const showingTo = sortedRows.length === 0 ? 0 : startIndex + pagedRows.length;

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

  const reloadUsers = async () => {
    const [usuariosJson, rolesJson] = await Promise.all([
      fetchJson(`${API_URL}/usuarios`),
      fetchJson(`${API_URL}/roles`),
    ]);
    setUsuarios(usuariosJson.data || []);
    setRoles(rolesJson.data || []);
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserForm({
      nombre: "",
      correo: "",
      id_rol: String(roles[0]?.id || ""),
      contrasena: "",
    });
  };

  const editUser = (usuario) => {
    setEditingUserId(usuario.id);
    setUserForm({
      nombre: usuario.nombre || "",
      correo: usuario.correo || "",
      id_rol: String(usuario.id_rol || ""),
      contrasena: "",
    });
  };

  const saveUser = async (event) => {
    event.preventDefault();
    setUsersMsg({ ok: "", err: "" });

    try {
      if (!userForm.nombre || !userForm.correo || !userForm.id_rol) {
        throw new Error("Completa nombre, correo y rol");
      }

      if (!editingUserId && String(userForm.contrasena).length < 8) {
        throw new Error(
          "La contrasena inicial debe tener al menos 8 caracteres",
        );
      }

      const payload = {
        nombre: userForm.nombre.trim(),
        correo: userForm.correo.trim(),
        id_rol: Number(userForm.id_rol),
      };

      await fetchJson(
        editingUserId
          ? `${API_URL}/usuarios/${editingUserId}`
          : `${API_URL}/usuarios`,
        {
          method: editingUserId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingUserId
              ? payload
              : { ...payload, contrasena: userForm.contrasena },
          ),
        },
      );

      await reloadUsers();
      resetUserForm();
      setUsersMsg({
        ok: editingUserId ? "Usuario actualizado." : "Usuario creado.",
        err: "",
      });
    } catch (e) {
      setUsersMsg({ ok: "", err: e.message || "No se pudo guardar usuario" });
    }
  };

  const toggleUserStatus = async (usuario) => {
    setUsersMsg({ ok: "", err: "" });
    try {
      const nextActive = Number(usuario.activo ?? 1) !== 1;
      await fetchJson(`${API_URL}/usuarios/${usuario.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: nextActive }),
      });
      await reloadUsers();
      setUsersMsg({
        ok: nextActive ? "Usuario habilitado." : "Usuario deshabilitado.",
        err: "",
      });
    } catch (e) {
      setUsersMsg({ ok: "", err: e.message || "No se pudo cambiar estado" });
    }
  };

  const changeUserPassword = async (usuario) => {
    const contrasena = passwordDrafts[usuario.id] || "";
    setUsersMsg({ ok: "", err: "" });

    try {
      if (contrasena.length < 8) {
        throw new Error("La nueva contrasena debe tener al menos 8 caracteres");
      }

      await fetchJson(`${API_URL}/usuarios/${usuario.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrasena }),
      });

      setPasswordDrafts((current) => ({ ...current, [usuario.id]: "" }));
      setUsersMsg({ ok: "Contrasena actualizada.", err: "" });
    } catch (e) {
      setUsersMsg({
        ok: "",
        err: e.message || "No se pudo cambiar contrasena",
      });
    }
  };

  // Guardar SOLO los archivos del modal
  const saveModal = async () => {
    if (!openRow) return;

    setSavingModal(true);
    setModalMsg({ ok: "", err: "" });

    try {
      // 1) Lista de archivos que están en este modal
      const archivos = docsInModal;

      // 2) Guardar estado y concepto de cada archivo
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
            id_usuario_concepto: user?.id || null,
          }),
        });
      }

      // 3) Convertir estado visual a ID de BD
      const solicitudEstadoId =
        solicitudStatusEdit === "aprobado"
          ? 2
          : solicitudStatusEdit === "rechazado"
            ? 3
            : 1;

      // 4) Guardar estado + observación de la solicitud
      await fetchJson(`${API_URL}/solicitudes/${openRow.id_solicitud}/estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_estado_solicitud: solicitudEstadoId,
          observacion: solicitudObservacion.trim() || null,
        }),
      });

      // 5) Refrescar archivos
      const archJson = await fetchJson(`${API_URL}/archivos`);
      const archivosActualizados = archJson.data || [];
      setArchivosAll(archivosActualizados);

      // 6) Rehidratar grid
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

      // 7) Actualizar la fila de la solicitud
      const solJson = await fetchJson(`${API_URL}/solicitudes`);
      const solicitudesActualizadas = solJson.data || [];

      const solicitudActualizada = solicitudesActualizadas.find(
        (sol) => Number(sol.id) === Number(openRow.id_solicitud),
      );

      if (solicitudActualizada) {
        setRows((current) =>
          current.map((row) =>
            Number(row.id_solicitud) === Number(openRow.id_solicitud)
              ? {
                  ...row,
                  id_estado_solicitud:
                    solicitudActualizada.id_estado_solicitud ??
                    solicitudActualizada.id_ult_estado ??
                    row.id_estado_solicitud,
                  observacion: solicitudActualizada.observacion ?? "",
                  fecha_ult_actualizacion:
                    solicitudActualizada.fecha_ult_actualizacion ??
                    row.fecha_ult_actualizacion,
                }
              : row,
          ),
        );
      }

      setModalMsg({
        ok: "Cambios de la solicitud guardados correctamente.",
        err: "",
      });
    } catch (e) {
      console.error(e);

      setModalMsg({
        ok: "",
        err: e.message || "Error guardando los cambios de la solicitud",
      });
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
        throw new Error(
          json?.message || "No se pudo cargar archivo de respuesta",
        );
      }

      const archJson = await fetchJson(`${API_URL}/archivos`);
      setArchivosAll(archJson.data || []);
      setRows((current) =>
        current.map((row) =>
          row.id_solicitud === openRow.id_solicitud
            ? { ...row, archivoRespuestaUrl: json.data?.archivo_respuesta_ruta }
            : row,
        ),
      );
      setResponseFile(null);
      setResponseMsg({
        ok: "Archivo de respuesta cargado correctamente.",
        err: "",
      });
    } catch (e) {
      setResponseMsg({
        ok: "",
        err: e.message || "No se pudo registrar el archivo de respuesta.",
      });
    } finally {
      setUploadingResponse(false);
    }
  };

  if (redirectToLogin) return <Navigate to="/login" replace />;

  if (showRestricted) {
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        {/* Header + filtros + buscador */}
        <div className="px-6 py-4 border-b border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Panel de aprobación</h2>
              <p className="text-sm text-gray-500">
                Gestiona solicitudes, usuarios y permisos operativos.
              </p>
            </div>

            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
              <button
                type="button"
                onClick={() => setActivePanel("solicitudes")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
                  activePanel === "solicitudes"
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FiFileText />
                Solicitudes
              </button>
              <button
                type="button"
                onClick={() => setActivePanel("usuarios")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
                  activePanel === "usuarios"
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FiUsers />
                Usuarios
              </button>
            </div>

            {activePanel === "solicitudes" && (
              <div className="w-full md:w-64 relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  autoComplete="off"
                  name="admin-search"
                  className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm shadow-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none"
                  placeholder="Buscar por nombre, correo o documento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          {activePanel === "solicitudes" && (
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
          )}
        </div>

        {activePanel === "usuarios" && (
          <div className="grid gap-4 bg-slate-50 p-4 lg:grid-cols-[360px_1fr]">
            <form
              onSubmit={saveUser}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                    Usuarios
                  </p>
                  <h3 className="text-base font-semibold text-slate-950">
                    {editingUserId ? "Editar usuario" : "Nuevo usuario"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={resetUserForm}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Limpiar
                </button>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">
                    Nombre
                  </span>
                  <input
                    value={userForm.nombre}
                    onChange={(e) =>
                      setUserForm((current) => ({
                        ...current,
                        nombre: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">
                    Correo
                  </span>
                  <input
                    type="email"
                    value={userForm.correo}
                    onChange={(e) =>
                      setUserForm((current) => ({
                        ...current,
                        correo: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">
                    Rol
                  </span>
                  <select
                    value={userForm.id_rol}
                    onChange={(e) =>
                      setUserForm((current) => ({
                        ...current,
                        id_rol: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.nombre_rol}
                      </option>
                    ))}
                  </select>
                </label>
                {!editingUserId && (
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">
                      Contraseña inicial
                    </span>
                    <input
                      type="password"
                      value={userForm.contrasena}
                      onChange={(e) =>
                        setUserForm((current) => ({
                          ...current,
                          contrasena: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>
                )}
              </div>

              <button
                type="submit"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
              >
                <FiPlus />
                {editingUserId ? "Guardar cambios" : "Crear usuario"}
              </button>
              {usersMsg.ok && (
                <p className="mt-3 text-xs text-green-700">{usersMsg.ok}</p>
              )}
              {usersMsg.err && (
                <p className="mt-3 text-xs text-red-700">{usersMsg.err}</p>
              )}
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">
                    Directorio de usuarios
                  </h3>
                  <p className="text-xs text-slate-500">
                    Edita datos, deshabilita accesos o cambia contraseñas.
                  </p>
                </div>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    autoComplete="off"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar usuario..."
                    className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 md:w-64"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {usersLoading ? (
                  <p className="p-6 text-center text-sm text-slate-500">
                    Cargando usuarios...
                  </p>
                ) : filteredUsuarios.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500">
                    No hay usuarios para mostrar.
                  </p>
                ) : (
                  filteredUsuarios.map((usuario) => {
                    const active = Number(usuario.activo ?? 1) === 1;
                    return (
                      <div
                        key={usuario.id}
                        className="grid gap-3 p-4 xl:grid-cols-[1fr_280px]"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              active
                                ? "bg-green-50 text-green-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <FiUser />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-950">
                                {usuario.nombre}
                              </p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {active ? "Activo" : "Deshabilitado"}
                              </span>
                            </div>
                            <p className="break-all text-sm text-slate-600">
                              {usuario.correo}
                            </p>
                            <p className="mt-1 text-xs font-medium text-primary-700">
                              {usuario.nombre_rol}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={passwordDrafts[usuario.id] || ""}
                              onChange={(e) =>
                                setPasswordDrafts((current) => ({
                                  ...current,
                                  [usuario.id]: e.target.value,
                                }))
                              }
                              placeholder="Nueva contraseña"
                              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                            />
                            <button
                              type="button"
                              onClick={() => changeUserPassword(usuario)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              <FiLock />
                              Cambiar
                            </button>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editUser(usuario)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(usuario)}
                              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                active
                                  ? "bg-red-50 text-red-700 hover:bg-red-100"
                                  : "bg-green-50 text-green-700 hover:bg-green-100"
                              }`}
                            >
                              {active ? <FiXCircle /> : <FiCheckCircle />}
                              {active ? "Deshabilitar" : "Habilitar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabla */}
        {activePanel === "solicitudes" && (
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
                    <button
                      type="button"
                      onClick={() => onSort("nombre")}
                      className="inline-flex items-center gap-1 font-semibold"
                    >
                      Nombre{" "}
                      {sortBy === "nombre" &&
                        (sortDir === "asc" ? (
                          <FiChevronUp />
                        ) : (
                          <FiChevronDown />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center">Correo</th>
                  <th className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onSort("documento")}
                      className="inline-flex items-center gap-1 font-semibold"
                    >
                      Documento{" "}
                      {sortBy === "documento" &&
                        (sortDir === "asc" ? (
                          <FiChevronUp />
                        ) : (
                          <FiChevronDown />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onSort("estado")}
                      className="inline-flex items-center gap-1 font-semibold"
                    >
                      Estado{" "}
                      {sortBy === "estado" &&
                        (sortDir === "asc" ? (
                          <FiChevronUp />
                        ) : (
                          <FiChevronDown />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onSort("fecha_ult_actualizacion")}
                      className="inline-flex items-center gap-1 font-semibold"
                    >
                      Última actualización{" "}
                      {sortBy === "fecha_ult_actualizacion" &&
                        (sortDir === "asc" ? (
                          <FiChevronUp />
                        ) : (
                          <FiChevronDown />
                        ))}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center ">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-sm text-gray-500"
                    >
                      No hay solicitudes para los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="px-3 py-3 text-center font-medium text-gray-900">
                        {r.nombre}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-gray-600">
                        {r.email}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-gray-700">
                        {r.tipoDocumento} - {r.numeroDocumento}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <StatusBadge value={r.solicitudStatus} />
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-gray-600">
                        {formatDate(
                          r.fecha_ult_actualizacion || r.fecha_actual,
                        )}
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
        )}

        {/* Footer paginación */}
        {activePanel === "solicitudes" && (
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
        )}
      </div>

      {/* Modal */}
      {openRow && (
        <div className="fixed left-0 top-0 right-0 bottom-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-600/75 p-4 backdrop-blur-sm">
          <div className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-white/20">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 truncate text-base font-semibold text-slate-950">
                  📄 Documentos de {openRow.nombre}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Revisa soportes, decide el estado y registra el concepto.
                </p>
              </div>
              <button
                onClick={() => setOpenRowId(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                X
              </button>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_220px]">
                {/* EMAIL */}
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-start gap-3">
                    <div className="bg-cyan-50 my-auto text-cyan-700 rounded-lg p-1.5 text-sm">
                      <FiMail />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide mb-4 text-gray-400 font-semibold">
                        Correo electrónico
                      </p>
                      <p className="text-sm text-slate-900 font-medium break-all">
                        {openRow.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* DOCUMENTO */}
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-start gap-3">
                    <div className="bg-violet-50 my-auto text-violet-700 rounded-lg p-1.5 text-sm">
                      <FiUser />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-4 font-semibold">
                        Documento
                      </p>
                      <p className="text-sm text-slate-900 font-medium">
                        {openRow.tipoDocumento} {openRow.numeroDocumento}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                    Estado de la solicitud
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={solicitudStatusEdit}
                      onChange={(e) => setSolicitudStatusEdit(e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm bg-white shadow-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="aprobado">Aprobado</option>
                      <option value="rechazado">Rechazado</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <label className="text-[11px] uppercase tracking-wide text-amber-800 font-semibold">
                    Observación de la solicitud
                  </label>

                  <textarea
                    value={solicitudObservacion}
                    onChange={(e) => setSolicitudObservacion(e.target.value)}
                    placeholder="Escribe una observación general sobre esta solicitud (opcional)..."
                    className="mt-1.5 w-full min-h-[80px] resize-none rounded-md border border-amber-200 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />

                  <p className="mt-1 text-[10px] text-amber-700">
                    Esta observación aplica a toda la solicitud y es opcional.
                  </p>
                </div>
              </div>
              {/* FORMULARIOS FIRMADOS */}
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-800">
                      Formularios firmados
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-700">
                      Documentos diligenciados y firmados por la contraparte.
                    </p>
                  </div>

                  <FiCheckCircle className="text-emerald-600 text-lg shrink-0" />
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {/* Conocimiento de contrapartes */}
                  {openRow.firmadoUrl ? (
                    <a
                      href={`${API_URL}/files/download?path=${encodeURIComponent(
                        openRow.firmadoUrl,
                      )}&name=${encodeURIComponent(
                        `formulario_${openRow.id_solicitud}.pdf`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
                    >
                      <FiFileText />
                      Ver formulario de vinculación
                    </a>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-400">
                      Formulario de vinculación no disponible
                    </span>
                  )}

                  {/* Tratamiento de datos */}
                  {openRow.tratamientoDatosUrl ? (
                    <a
                      href={`${API_URL}/files/download?path=${encodeURIComponent(
                        openRow.tratamientoDatosUrl,
                      )}&name=${encodeURIComponent(
                        `tratamiento_datos_${openRow.id_solicitud}.pdf`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm hover:bg-violet-50"
                    >
                      <FiFileText />
                      Ver tratamiento de datos
                    </a>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-400">
                      Tratamiento de datos no disponible
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                  Archivo de respuesta (solo Oficial de Cumplimiento)
                </p>
                <p className="hidden">
                  Carga aquí documentación externa de soporte para esta
                  solicitud.
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-indigo-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm hover:bg-indigo-100">
                    <FiUpload />
                    Seleccionar archivo
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) =>
                        setResponseFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                  <span className="max-w-[260px] truncate text-xs text-indigo-700">
                    {responseFile
                      ? responseFile.name
                      : "Ningún archivo seleccionado"}
                  </span>
                  <button
                    type="button"
                    onClick={uploadResponseDocument}
                    disabled={!responseFile || uploadingResponse}
                    className="rounded-md bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingResponse ? "Cargando..." : "Guardar"}
                  </button>
                </div>
                {openRow.archivoRespuestaUrl && (
                  <a
                    href={`${API_URL}/files/download?path=${encodeURIComponent(openRow.archivoRespuestaUrl)}&name=${encodeURIComponent(fileNameFromPath(openRow.archivoRespuestaUrl, "respuesta-oficial"))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block text-xs font-medium text-green-700 underline"
                  >
                    Ver respuesta actual
                  </a>
                )}
                {responseMsg.ok && (
                  <p className="mt-1 text-xs text-green-700">
                    {responseMsg.ok}
                  </p>
                )}
                {responseMsg.err && (
                  <p className="mt-1 text-xs text-red-700">{responseMsg.err}</p>
                )}
              </div>
            </div>

            <div className="px-5 py-3 overflow-y-auto flex-1 bg-slate-100">
              {docsInModal.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No hay archivos registrados.
                </p>
              ) : (
                <div className="w-full mx-auto grid lg:grid-cols-2 2xl:grid-cols-3 gap-3">
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
                        className="flex min-h-[250px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-primary-200 hover:shadow-md"
                      >
                        <div className="flex flex-1 flex-col gap-2.5 px-3 py-3">
                          {/* HEADER */}
                          <div className="flex justify-between items-start gap-4">
                            <h2 className="line-clamp-2 text-sm font-semibold text-slate-950 leading-snug max-w-[68%]">
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
                          <p className="line-clamp-1 text-xs text-slate-500 break-words">
                            {doc.nombre_archivo}
                          </p>

                          {/* LINK */}
                          <a
                            href={`${API_URL}/files/download?path=${encodeURIComponent(doc.ruta_archivo)}&name=${doc.nombre_archivo}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-fit items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            📎 Ver / Descargar
                          </a>

                          {/* ESTADO */}
                          <div className="flex items-center gap-2">
                            <select
                              className="border border-slate-300 rounded-md px-2.5 py-1.5 text-xs bg-white shadow-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
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
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Concepto
                            </label>

                            <textarea
                              className="w-full min-h-[84px] border border-slate-300 bg-slate-50 rounded-md px-2.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 resize-none"
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

            <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                  className="text-sm px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  onClick={saveModal}
                  disabled={savingModal}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-1.5 rounded-md shadow-sm"
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
