// Cada item: { name: "RUT", required: true | false }
export const REQUIRED_DOCS_BY_SEGMENT = {
  // =========================
  // PROVEEDORES
  // =========================

  "proveedores-generales-pj-y-financieras": [
    {
      name: "LISTADO DE BENEFICIARIOS FINALES",
      required: true,
    },
    { name: "RUT", required: true },
    { name: "CAMARA DE COMERCIO", required: true },
    { name: "COPIA DOCUMENTO IDENTIDAD REPRESENTANTE LEGAL", required: true },
    { name: "DECLARACIÓN DE RENTA", required: true },
    { name: "ESTADOS FINANCIEROS", required: true },
    { name: "COMPOSICIÓN ACCIONARIA", required: true },
    { name: "REFERENCIAS COMERCIALES", required: true },
    { name: "CERTIFICACIÓN BANCARIA", required: true },
  ],

  "proveedores-generales-pn": [
    { name: "COPIA DOCUMENTO IDENTIDAD", required: true },
    { name: "RUT", required: true },
    { name: "CERTIFICACIÓN BANCARIA", required: true },
    { name: "REFERENCIAS COMERCIALES", required: false },
    { name: "DECLARACIÓN DE RENTA", required: false },
    { name: "CAMARA DE COMERCIO", required: false },
    { name: "ESTADOS FINANCIEROS", required: false },
  ],

  "proveedores-menores-pj": [
    {
      name: "LISTADO DE BENEFICIARIOS FINALES",
      required: false,
    },
    { name: "RUT", required: true },
    { name: "CAMARA DE COMERCIO", required: false },
    { name: "COPIA DOCUMENTO IDENTIDAD REPRESENTANTE LEGAL", required: true },
    { name: "CERTIFICACIÓN BANCARIA", required: true },
    { name: "DECLARACIÓN DE RENTA", required: false },
    { name: "ESTADOS FINANCIEROS", required: false },
    { name: "COMPOSICIÓN ACCIONARIA", required: false },
    { name: "REFERENCIAS COMERCIALES", required: false },
  ],

  "proveedores-menores-pn": [
    { name: "COPIA DOCUMENTO IDENTIDAD", required: true },
    { name: "RUT", required: true },
    { name: "CERTIFICACIÓN BANCARIA", required: true },
    { name: "DECLARACIÓN DE RENTA", required: false },
    { name: "CAMARA DE COMERCIO", required: false },
    { name: "ESTADOS FINANCIEROS", required: false },
    { name: "REFERENCIAS COMERCIALES", required: false },
  ],

  "proveedores-menores-caja-viaticos": [{ name: "RUT", required: true }],

  "proveedores-internacionales-esporadicos": [
    {
      name: "DOCUMENTO DE REGISTRO UNICO TRIBUTARIO DEL PAIS",
      required: true,
    },
  ],

  "proveedores-internacionales-compras-continuas": [
    {
      name: "DOCUMENTO DE REGISTRO UNICO TRIBUTARIO DEL PAIS",
      required: true,
    },
    {
      name: "DOCUMENTOS ADICIONALES SEGÚN PAÍS DE OPERACIÓN",
      required: false, // condicional según país
    },
  ],

  // =========================
  // CLIENTES
  // =========================

  "clientes-otros-pj": [
    { name: "RUT", required: true },
    { name: "CAMARA DE COMERCIO", required: true },
    { name: "COPIA DOCUMENTO IDENTIDAD REPRESENTANTE LEGAL", required: true },
    { name: "DECLARACIÓN DE RENTA", required: true },
    { name: "ESTADOS FINANCIEROS", required: true },
    { name: "COMPOSICIÓN ACCIONARIA", required: true },
    { name: "CERTIFICACIÓN BANCARIA", required: true },
    { name: "REFERENCIAS COMERCIALES", required: true },
  ],

  "clientes-aseguradoras-financieras": [
    { name: "RUT", required: true },
    { name: "CAMARA DE COMERCIO", required: true },
    { name: "COPIA DOCUMENTO IDENTIDAD REPRESENTANTE LEGAL", required: true },
    { name: "DECLARACIÓN DE RENTA", required: true },
    { name: "ESTADOS FINANCIEROS", required: true },
    { name: "COMPOSICIÓN ACCIONARIA", required: true },
    { name: "CERTIFICACIÓN BANCARIA", required: true },
    { name: "REFERENCIAS COMERCIALES", required: false },
  ],

  "clientes-aliados-pj": [
    { name: "RUT", required: true },
    { name: "CAMARA DE COMERCIO", required: true },
    { name: "COPIA DOCUMENTO IDENTIDAD REPRESENTANTE LEGAL", required: true },
    { name: "DECLARACIÓN DE RENTA", required: true },
    { name: "ESTADOS FINANCIEROS", required: true },
    { name: "COMPOSICIÓN ACCIONARIA", required: true },
    { name: "CERTIFICACIÓN BANCARIA", required: true },
    { name: "REFERENCIAS COMERCIALES", required: false },
  ],

  "clientes-otros-pn": [
    { name: "COPIA DOCUMENTO IDENTIDAD", required: false },
    { name: "RUT", required: false },
    { name: "CERTIFICACIÓN BANCARIA", required: false },
    { name: "DECLARACIÓN DE RENTA", required: false },
    { name: "CAMARA DE COMERCIO", required: false },
    { name: "ESTADOS FINANCIEROS", required: false },
    { name: "REFERENCIAS COMERCIALES", required: false },
  ],

  // =========================
  // ACCIONISTAS
  // (un solo segmento; marcamos como opcionales
  // algunos docs que aplican solo a PJ)
  // =========================

  "personas-naturales": [
    // Personas naturales
    { name: "DECLARACIÓN DE ORIGEN DE FONDOS", required: false },
    { name: "COPIA DOCUMENTO IDENTIDAD", required: true },
    { name: "RUT", required: true },
  ],

  "personas-juridicas": [
    // Personas jurídicas (muchos serán condicionales)
    { name: "CAMARA DE COMERCIO", required: false },
    { name: "DECLARACIÓN DE RENTA", required: false },
    { name: "ESTADOS FINANCIEROS", required: false },
    { name: "COMPOSICIÓN ACCIONARIA", required: false },
    { name: "CERTIFICACIÓN BANCARIA", required: false },
    { name: "REFERENCIAS COMERCIALES", required: false },
    {
      name: "COPIA DOCUMENTO IDENTIDAD REPRESENTANTE LEGAL",
      required: false,
    },
  ],

  // =========================
  // EMPLEADOS
  // =========================

  "empleados-nuevos": [
    // { name: "AUTORIZACIÓN DE TRATAMIENTO DE DATOS PERSONALES", required: true },
    { name: "COPIA DOCUMENTO DE IDENTIDAD", required: true },
    { name: "RUT", required: true },
    // { name: "DECLARACIÓN DE RENTA", required: true },
    // {
    //   name: "ADJUNTO DE RESULTADO CONSULTA SAGRILAFT",
    //   required: true,
    // },
  ],

  "empleados-existentes":[
    
  ]
};
