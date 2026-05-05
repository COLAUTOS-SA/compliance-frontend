import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { FiSave, FiUpload, FiLoader } from "react-icons/fi";
import { useAuth } from "../context/AuthContext.jsx";
import { findLabel, SEGMENTS_BY_ROLE } from "../constants/segments.js";
import { REQUIRED_DOCS_BY_SEGMENT } from "../constants/requiredDocs.js";
// import useAdobeSign from "../hooks/useAdobeSign";

const TIPO_DOC = ["CC", "CE", "NIT", "PASAPORTE"];
const API_URL =
  import.meta.env.VITE_API_URL || "https://compliance.colautos.co/api";
const ADOBE_WEBFORM_URL =
  "https://secure.na4.adobesign.com/public/esignWidget?wid=CBFCIBAA3AAABLblqZhBNNU1M0xpYcPOpctKOucZOVta7feMRFxxKjI-8TT5he7WaVBqGeSTLEfJF2maqerk*";
const BENEFICIARIOS_DOC_OLD = "CUESTIONARIO VINCULACIÓN DE PROVEEDORES Y CONTRATISTAS";
const BENEFICIARIOS_DOC_NEW = "LISTADO DE BENEFICIARIOS FINALES";

// Mapea el rol del usuario al id_tipo_contraparte de la BD
function mapRoleToTipoContraparteId(role) {
  switch (role) {
    case "proveedores":
      return 1; // PROVEEDOR
    case "accionistas":
      return 2; // ACCIONISTA
    case "clientes":
      return 3; // CLIENTE
    case "empleados":
      return 4; // EMPLEADO
    default:
      return null;
  }
}

// Mapea el rol a tipo de contraparte en string (para Adobe Sign)
function mapRoleToTipoContraparte(role) {
  switch (role) {
    case "proveedores":
      return "PROVEEDOR";
    case "accionistas":
      return "ACCIONISTA";
    case "clientes":
      return "CLIENTE";
    case "empleados":
      return "EMPLEADO";
    default:
      return null;
  }
}

function mapSegmentSlugToSegmentId(segmento) {
  // IDs alineados con tabla segmento en BD (1..14)
  // Se mantienen aliases legacy para no romper rutas antiguas.
  const SEGMENT_ID_BY_SLUG = {
    // PROVEEDORES
    "proveedores-generales-pj-y-financieras": 1,
    "proveedores-generales-pn": 2,
    "proveedores-menores-pj": 3,
    "proveedores-menores-pn": 4,
    "proveedores-menores-caja-viaticos": 5,
    "proveedores-internacionales-esporadicos": 6,
    "proveedores-internacionales-compras-continuas": 7,
    "proveedores-internacionales-continuos": 7, // legacy

    // CLIENTES
    "personas-juridicas-venta-vehiculos": 8,
    "aseguradoras-y-financieras": 9,
    "aliados-retomadores-pj": 10,
    "aliados-retomadores-pn": 11,
    "clientes-pj-vehiculos": 8, // legacy
    "clientes-aseguradoras-financieras": 9, // legacy
    "clientes-aliados-pj": 10, // legacy
    "clientes-aliados-pn": 11, // legacy

    // ACCIONISTAS
    "personas-naturales": 12,
    "personas-juridicas": 13,

    // EMPLEADOS
    "todos-los-empleados": 14,
  };

  return SEGMENT_ID_BY_SLUG[segmento] ?? null;
}

// Helper para formatear fecha a "YYYY-MM-DD HH:mm:ss" para MySQL
function nowForMySQL() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds())
  );
}

export default function Segment() {
  const { segmento } = useParams();
  const { user } = useAuth();
  // const adobeSign = useAdobeSign(API_URL);

  const allowed = useMemo(
    () => (SEGMENTS_BY_ROLE[user?.role] || []).some((s) => s.slug === segmento),
    [user?.role, segmento],
  );

  const title = useMemo(
    () => findLabel(user?.role, segmento) || "Segmento",
    [user?.role, segmento],
  );

  const requiredDocs = REQUIRED_DOCS_BY_SEGMENT[segmento] || [];
  const mapDocDisplayName = (name) =>
    name === BENEFICIARIOS_DOC_OLD ? BENEFICIARIOS_DOC_NEW : name;
  const isBeneficiariosDoc = (name) =>
    name === BENEFICIARIOS_DOC_OLD || name === BENEFICIARIOS_DOC_NEW;
  const isExcelFile = (file) => {
    if (!file) return false;
    const fileName = (file.name || "").toLowerCase();
    const mime = (file.type || "").toLowerCase();
    const validExt = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const validMime =
      mime.includes("spreadsheetml") ||
      mime.includes("excel") ||
      mime.includes("ms-excel");
    return validExt || validMime;
  };

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    tipoDocumento: "CC",
    numeroDocumento: "",
  });

  // { [docName]: File }
  const [attachments, setAttachments] = useState({});
  const [status, setStatus] = useState({
    saving: false,
    ok: false,
    error: "",
    message: "",
  });

  // Estado para Adobe Sign
  const [adobeStep, setAdobeStep] = useState("idle"); // idle, initiating, waiting_signature, signed, error
  const [solicitudId, setSolicitudId] = useState(null);
  const [contraparteId, setContraparteId] = useState(null);

  useEffect(() => {
    if (!solicitudId || adobeStep !== "waiting_signature") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/solicitudes/${solicitudId}`);
        const data = await res.json();
        const firmado =
          data?.data?.solicitud?.conocimiento_contrapartes ||
          data?.data?.conocimiento_contrapartes ||
          null;

        if (firmado) {
          setAdobeStep("signed");

          setStatus({
            saving: false,
            ok: false,
            error: "",
            message: "✔ Firma detectada automáticamente",
          });

          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [adobeStep, solicitudId]);

  if (!allowed) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            No autorizado
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Este segmento no pertenece a tu rol.
          </p>
        </div>
      </div>
    );
  }

  const handleFileChange = (docName, file) => {
    if (file && isBeneficiariosDoc(docName) && !isExcelFile(file)) {
      setStatus({
        saving: false,
        ok: false,
        error:
          "El documento LISTADO DE BENEFICIARIOS FINALES solo acepta archivos Excel (.xlsx o .xls).",
        message: "",
      });
      return;
    }

    setAttachments((prev) => ({
      ...prev,
      [docName]: file || undefined,
    }));
    setStatus((prev) => ({ ...prev, error: "" }));
  };

  const handleInitiateSignature = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.email || !form.numeroDocumento) {
      setStatus({
        saving: false,
        ok: false,
        error: "Completa todos los datos antes de continuar.",
        message: "",
      });
      return;
    }

    try {
      const missingRequired = requiredDocs
        .filter((doc) => doc.required)
        .filter((doc) => !attachments[doc.name]);

      if (missingRequired.length > 0) {
        setStatus({
          saving: false,
          ok: false,
          error: "Faltan documentos obligatorios.",
          message: "",
        });
        return;
      }

      setStatus({
        saving: true,
        ok: false,
        error: "",
        message: "Creando solicitud...",
      });

      const tipoId = mapRoleToTipoContraparteId(user?.role);
      const segmentoId = mapSegmentSlugToSegmentId(segmento);
      const ahora = nowForMySQL();

      // 🔥 1. CREAR CONTRAPARTE
      const contraparteResp = await fetch(`${API_URL}/contrapartes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Nombre: form.nombre,
          Correo: form.email,
          Tipo_doc: form.tipoDocumento,
          Nro_doc: form.numeroDocumento,
          id_tipo_contraparte: tipoId,
          id_segmento: segmentoId,
        }),
      });

      const contraparteData = await contraparteResp.json();

      if (!contraparteResp.ok || !contraparteData.success) {
        throw new Error("Error creando contraparte");
      }

      const cId = contraparteData.data.id;

      // 🔥 2. CREAR SOLICITUD
      const solicitudResp = await fetch(`${API_URL}/solicitudes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_contraparte: cId,
          fecha_ult_actualizacion: ahora,
          fecha_actual: ahora,
          conocimiento_contrapartes: null,
          id_ult_estado: 1,
        }),
      });

      const solicitudData = await solicitudResp.json();

      if (!solicitudResp.ok || !solicitudData.success) {
        throw new Error("Error creando solicitud");
      }

      const sId = solicitudData.data.id;

      // 🔥 GUARDAR EN STATE
      setContraparteId(cId);
      setSolicitudId(sId);

      // 🔥 3. ABRIR ADOBE
      window.open(ADOBE_WEBFORM_URL, "_blank");

      setAdobeStep("waiting_signature");

      setStatus({
        saving: false,
        ok: false,
        error: "",
        message:
          "Formulario abierto. Firma el documento y luego vuelve para guardar.",
      });
    } catch (err) {
      console.error(err);

      setStatus({
        saving: false,
        ok: false,
        error: err.message,
        message: "",
      });
    }
  };

  const handleSaveAfterSignature = async (e) => {
    e.preventDefault();

    // Si no está firmado, validar
    if (adobeStep !== "signed") {
      setStatus({
        saving: false,
        ok: false,
        error: "Por favor firma el documento antes de continuar.",
        message: "",
      });
      return;
    }

    // Verificación final contra backend para evitar guardar sin firma real
    try {
      const verifyResp = await fetch(`${API_URL}/solicitudes/${solicitudId}`);
      const verifyJson = await verifyResp.json();
      const firmado =
        verifyJson?.data?.solicitud?.conocimiento_contrapartes ||
        verifyJson?.data?.conocimiento_contrapartes ||
        null;
      if (!firmado) {
        setAdobeStep("waiting_signature");
        setStatus({
          saving: false,
          ok: false,
          error:
            "Aún no se registra el formulario firmado en backend. Verifica que en Adobe hayas finalizado/enviado el formulario (botón submit).",
          message: "",
        });
        return;
      }
    } catch {
      // sigue flujo normal si falla verificación puntual
    }

    setStatus({
      saving: true,
      ok: false,
      error: "",
      message: "Guardando documentos...",
    });

    try {
      const docsConArchivo = requiredDocs
        .map((doc) => ({
          definicion: doc,
          file: attachments[doc.name],
        }))
        .filter((x) => x.file);

      if (docsConArchivo.length === 0) {
        throw new Error("No hay archivos para enviar");
      }

      const formData = new FormData();

      // 🔥 TODOS LOS ARCHIVOS
      docsConArchivo.forEach(({ definicion, file }) => {
        formData.append("archivos", file);
        formData.append("tipo_documento", definicion.name);
      });

      // 🔥 DATOS GENERALES
      formData.append("id_contraparte", contraparteId);
      formData.append("id_solicitud", solicitudId);

      console.log("📎 Enviando múltiples archivos...");

      const archivoResp = await fetch(`${API_URL}/archivos`, {
        method: "POST",
        body: formData,
      });

      const archivoPayload = await archivoResp.json();

      if (!archivoResp.ok || !archivoPayload.success) {
        throw new Error(archivoPayload.message || "Error al subir archivos");
      }

      setStatus({ saving: false, ok: true, error: "", message: "" });

      // Reset
      setTimeout(() => {
        setForm({
          nombre: "",
          email: "",
          tipoDocumento: "CC",
          numeroDocumento: "",
        });
        setAttachments({});
        setAdobeStep("idle");
        setSolicitudId(null);
        setContraparteId(null);
      }, 2000);
    } catch (err) {
      console.error("Error en guardado de solicitud:", err);

      setStatus({
        saving: false,
        ok: false,
        error: err.message || "Error al guardar la solicitud",
        message: "",
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg">
        {/* Header bg-gradient-to-br from-slate-50 to-slate-100*/}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary-700 uppercase">
              Debida Diligencia
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Completa los datos, adjunta los documentos requeridos y finalmente
              firma el formulario.
            </p>
          </div>
          {/* <div className="hidden md:flex flex-col items-end text-xs text-slate-500">
            <span className="font-medium text-slate-700">
              Usuario: {user?.name || user?.username}
            </span>
            <span className="mt-0.5 rounded-full px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200">
              Segmento actual
            </span>
            <span className="text-[11px] mt-0.5 max-w-xs text-right">
              {title}
            </span>
          </div> */}
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 flex-1 rounded ${form.nombre ? "bg-green-500" : "bg-gray-200"}`}
            />
            <div
              className={`h-2 flex-1 rounded ${Object.keys(attachments).length > 0 ? "bg-green-500" : "bg-gray-200"}`}
            />
            <div
              className={`h-2 flex-1 rounded ${adobeStep === "signed" ? "bg-green-500" : "bg-gray-200"}`}
            />
          </div>
        </div>

        {/* FORMULARIO */}
        <form className="w-full p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sección 1: Datos básicos */}
          <div className="md:col-span-3 space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-[11px] font-semibold text-white">
                1
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Datos básicos de la contraparte
                </h3>
                <p className="text-xs text-slate-500">
                  Esta información se usará para identificar y contactar a la
                  contraparte.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Nombre completo / Razón social
                </label>
                <input
                  required
                  className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                  placeholder="Ej. Colautos S.A."
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">
                  Correo electrónico
                </label>
                <input
                  required
                  type="email"
                  className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                  placeholder="nombre@empresa.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">
                  Tipo de documento
                </label>
                <select
                  className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                  value={form.tipoDocumento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tipoDocumento: e.target.value }))
                  }
                >
                  {TIPO_DOC.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">
                  Número de documento
                </label>
                <input
                  required
                  className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                  placeholder="Ej. 1090xxxxxx / NIT sin dígito de verificación"
                  value={form.numeroDocumento}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      numeroDocumento: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Adjuntos */}
          <div className="md:col-span-3 mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-[11px] font-semibold text-white">
                2
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Documentos para este segmento
                </h3>
                {requiredDocs.length > 0 ? (
                  <p className="text-xs text-slate-500">
                    Adjunta los documentos listados a continuación. Los marcados
                    como{" "}
                    <span className="font-semibold text-red-600">
                      obligatorios
                    </span>{" "}
                    son necesarios para continuar.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Para este segmento no se han configurado documentos
                    adicionales.
                  </p>
                )}
              </div>
            </div>

            {requiredDocs.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {requiredDocs.map((doc) => {
                  const file = attachments[doc.name];
                  const required = doc.required;
                  return (
                    <div
                      key={doc.name}
                      className={`relative border rounded-2xl p-3.5 bg-white shadow-sm flex flex-col gap-2 ${
                        required ? "border-red-100/70" : "border-slate-200/80"
                      }`}
                    >
                      <div
                        className={`absolute inset-y-0 left-0 w-1 rounded-l-2xl ${
                          required ? "bg-red-500" : "bg-emerald-500"
                        }`}
                      />
                      <div className="pl-3 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            {mapDocDisplayName(doc.name)}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {isBeneficiariosDoc(doc.name)
                              ? "Formato permitido: solo Excel (.xlsx o .xls). Debe incluir nombre, tipo de documento y número de documento."
                              : "Formato permitido: PDF, Word o Excel."}
                          </p>
                        </div>
                        <span
                          className={
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full border " +
                            (required
                              ? "text-red-700 bg-red-50 border-red-200"
                              : "text-emerald-700 bg-emerald-50 border-emerald-200")
                          }
                        >
                          {required ? "Obligatorio" : "Opcional"}
                        </span>
                      </div>

                      <div className="pl-3 flex items-center gap-2 mt-1">
                        <label className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-primary-500 text-primary-700 bg-primary-50 hover:bg-primary-600 hover:text-white cursor-pointer transition">
                          <FiUpload className="shrink-0" />
                          <span>Seleccionar archivo</span>
                          <input
                            type="file"
                            className="hidden"
                            accept={
                              isBeneficiariosDoc(doc.name)
                                ? ".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                : undefined
                            }
                            onChange={(e) =>
                              handleFileChange(
                                doc.name,
                                e.target.files?.[0] || null,
                              )
                            }
                          />
                        </label>
                        {file ? (
                          <span className="text-green-600 text-xs truncate max-w-[220px]">
                            ✔ {file.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sección 3: Adobe Sign */}
          <div className="md:col-span-3 space-y-3 mt-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-[11px] font-semibold text-white">
                3
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Firma electrónica (Adobe Sign)
                </h3>
                <p className="text-xs text-slate-500">
                  Diligencia y firma el formulario de conocimiento de
                  contrapartes.
                </p>
              </div>
            </div>

            {/* 🔹 IDLE */}
            {adobeStep === "idle" && (
              <div className="w-full h-[200px] mt-1 border border-slate-300 rounded-2xl bg-slate-900/5 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-slate-600 text-sm font-medium">
                    📋 Completa los datos básicos arriba para iniciar el
                    proceso.
                  </p>
                </div>
              </div>
            )}

            {/* 🔹 LOADING */}
            {adobeStep === "initiating" && (
              <div className="w-full h-[200px] mt-1 border border-slate-300 rounded-2xl bg-slate-900/5 flex items-center justify-center">
                <div className="text-center">
                  <FiLoader className="inline animate-spin text-primary-600 text-2xl mb-2" />
                  <p className="text-slate-600 text-sm font-medium">
                    Preparando proceso...
                  </p>
                </div>
              </div>
            )}

            {/* 🔥 ESPERANDO FIRMA (SIN IFRAME) */}
            {adobeStep === "waiting_signature" && (
              <div className="space-y-3">
                <div className="w-full h-[200px] border border-blue-200 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <div className="text-center px-4">
                    <p className="text-blue-800 text-sm font-semibold">
                      📝 Se abrió el formulario de Adobe en una nueva pestaña
                    </p>
                    <p className="text-blue-600 text-xs mt-1">
                      Completa y firma el documento, luego regresa aquí para
                      continuar.
                    </p>

                    <a
                      href={ADOBE_WEBFORM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-blue-700 underline text-xs"
                    >
                      🔗 Volver a abrir formulario
                    </a>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-4 rounded-xl shadow-sm">
                  <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    📝 <span>¿Qué debes hacer?</span>
                  </p>

                  <ul className="space-y-2 text-xs text-blue-800">
                    <li className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      Completa el formulario en Adobe
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      Firma el documento electrónicamente
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      Regresa a esta pantalla
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-700">4.</span>
                      Haz clic en{" "}
                      <span className="font-semibold">
                        "Ya firmé, continuar"
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-700">5.</span>
                      Guarda la solicitud
                    </li>
                  </ul>
                </div>
                {adobeStep === "waiting_signature" && (
                  <span className="text-xs text-blue-600 font-medium">
                    ⏳ Esperando que completes la firma...
                  </span>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const verifyResp = await fetch(
                        `${API_URL}/solicitudes/${solicitudId}`,
                      );
                      const verifyJson = await verifyResp.json();
                      const firmado =
                        verifyJson?.data?.solicitud
                          ?.conocimiento_contrapartes ||
                        verifyJson?.data?.conocimiento_contrapartes ||
                        null;

                      if (!firmado) {
                        setStatus({
                          saving: false,
                          ok: false,
                          error:
                            "Todavía no aparece la firma. Asegúrate de terminar y enviar el formulario en Adobe (submit) y espera unos segundos.",
                          message: "",
                        });
                        return;
                      }

                      setAdobeStep("signed");
                      setStatus({
                        saving: false,
                        ok: false,
                        error: "",
                        message:
                          "Firma confirmada en backend. Ahora puedes guardar la solicitud.",
                      });
                    } catch (err) {
                      setStatus({
                        saving: false,
                        ok: false,
                        error:
                          err.message ||
                          "No se pudo validar la firma en este momento.",
                        message: "",
                      });
                    }
                  }}
                  className="mt-3 px-4 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  ✅ Ya firmé, continuar
                </button>
              </div>
            )}

            {/* 🔹 FINAL */}
            {adobeStep === "signed" && (
              <div className="w-full h-[200px] border border-slate-300 rounded-2xl bg-green-50 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-green-700 text-lg font-semibold">
                    ✅ Documento firmado correctamente
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    Ya puedes guardar tu solicitud con los documentos adjuntos.
                  </p>
                </div>
              </div>
            )}

            {/* 🔹 ERROR */}
            {adobeStep === "error" && (
              <div className="w-full h-[200px] border border-slate-300 rounded-2xl bg-red-50 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-red-700 text-sm font-semibold">
                    ❌ Error en el proceso
                  </p>
                  <p className="text-red-600 text-xs mt-1">
                    {status.error || "Por favor intenta nuevamente."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Mensajes y botón */}
          <div className="md:col-span-3 flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200 mt-4">
            {status.ok && (
              <span className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                ✅ Solicitud guardada correctamente.
              </span>
            )}
            {status.error && (
              <span className="text-sm text-red-800 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                ❌ {status.error}
              </span>
            )}
            {status.message && (
              <span className="text-sm text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                ℹ️ {status.message}
              </span>
            )}

            <button
              type="button"
              disabled={
                status.saving ||
                (adobeStep !== "idle" && adobeStep !== "signed")
              }
              onClick={
                adobeStep === "idle"
                  ? handleInitiateSignature
                  : adobeStep === "signed"
                    ? handleSaveAfterSignature
                    : null
              }
              className={`inline-flex items-center gap-2 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition
              ${
                adobeStep === "signed"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-primary-600 hover:bg-primary-700"
              }
                disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70
              `}
            >
              {status.saving && <FiLoader className="animate-spin" />}
              <FiSave className="text-lg" />

              {status.saving
                ? "Procesando..."
                : adobeStep === "idle"
                  ? "Iniciar firma"
                  : adobeStep === "waiting_signature"
                    ? "Esperando firma..."
                    : adobeStep === "signed"
                      ? "Guardar solicitud"
                      : "Reintentar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
