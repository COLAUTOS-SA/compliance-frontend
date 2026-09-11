export const COUNTERPART_TYPES = [
  { key: "proveedores", label: "Proveedores" },
  { key: "clientes", label: "Clientes" },
  { key: "accionistas", label: "Accionistas" },
  { key: "empleados", label: "Empleados" },
];

// ⚠️ OJO: segmentId = id de la tabla `segmento`
export const SEGMENTS_BY_TYPE = {
  proveedores: [
    {
      slug: "proveedores-generales-pj-y-financieras",
      label: "GENERALES PERSONA JURIDICA Y ENTIDADES FINANCIERAS",
      segmentId: 1,
    },
    {
      slug: "proveedores-generales-pn",
      label: "GENERALES PERSONA NATURAL",
      segmentId: 2,
    },
    {
      slug: "proveedores-menores-pj",
      label: "MENORES (compras hasta 1 SMLMV o 1 sola vez) PERSONA JURIDICA",
      segmentId: 3,
    },
    {
      slug: "proveedores-menores-pn",
      label: "MENORES (compras hasta 1 SMLMV o 1 sola vez) PERSONA NATURAL",
      segmentId: 4,
    },
    {
      slug: "proveedores-menores-caja-viaticos",
      label: "MENORES (Cajas menores, viaticos)",
      segmentId: 5,
    },
    {
      slug: "proveedores-internacionales-esporadicos",
      label: "INTERNACIONALES y/o ESPORÁDICOS (PLATAFORMAS DIGITALES)",
      segmentId: 6,
    },
    {
      slug: "proveedores-internacionales-compras-continuas",
      label: "INTERNACIONALES y/o COMPRAS CONTINUAS",
      segmentId: 7,
    },
  ],

  clientes: [
    {
      slug: "personas-juridicas-venta-vehiculos",
      label: "PERSONAS JURIDICAS VENTA DE VEHÍCULOS",
      segmentId: 8,
    },
    {
      slug: "aseguradoras-y-financieras",
      label: "ASEGURADORAS Y FINANCIERAS",
      segmentId: 9,
    },
    {
      slug: "aliados-retomadores-pj",
      label: "ALIADOS RETOMADORES Y OTROS PERSONA JURIDICA",
      segmentId: 10,
    },
    {
      slug: "aliados-retomadores-pn",
      label: "ALIADOS RETOMADORES Y OTROS PERSONA NATURAL",
      segmentId: 11,
    },
  ],

  accionistas: [
    {
      slug: "personas-naturales",
      label: "PERSONAS NATURALES",
      segmentId: 12,
    },
    {
      slug: "personas-juridicas",
      label: "PERSONAS JURIDICAS",
      segmentId: 13,
    },
  ],

  empleados: [
    {
      slug: "empleados-nuevos",
      label: "EMPLEADOS NUEVOS",
      segmentId: 14,
    },
    {
      slug: "empleados-existentes",
      label: "EMPLEADOS EXISTENTES",
      segmentId: 15,
    },
  ],
};

// Requisitos por segmento (2–5 doc aprox.)
export const REQUIRED_DOCS_BY_SEGMENT = {
  // CLIENTES
  "personas-juridicas-venta-vehiculos": [
    "RUT",
    "Cámara de Comercio",
    "Representación Legal",
    "CC Representante",
    "Autorización de Datos",
  ],
  "aseguradoras-y-financieras": [
    "RUT",
    "Certificación Bancaria",
    "Cámara de Comercio",
    "Representación Legal",
  ],
  "aliados-retomadores-pj": [
    "RUT",
    "Cámara de Comercio",
    "CC Representante",
    "Formato Conocimiento",
  ],
  "aliados-retomadores-pn": [
    "CC",
    "Certificación Laboral/Ingresos",
    "Formato Conocimiento",
  ],

  // PROVEEDORES
  "proveedores-generales-pj-y-financieras": [
    "RUT",
    "Cámara de Comercio",
    "CC Representante",
    "Certificación Bancaria",
    "Formato Conocimiento",
  ],
  "proveedores-generales-pn": [
    "CC",
    "RUT (si aplica)",
    "Certificación Bancaria",
    "Formato Conocimiento",
  ],
  "proveedores-menores-pj": ["RUT", "Cámara de Comercio", "CC Representante"],
  "proveedores-menores-pn": ["CC", "Autodeclaración Ingresos"],
  "proveedores-menores-caja-viaticos": [
    "Copia Documento",
    "Soporte Gasto/Factura",
  ],
  "proveedores-internacionales-esporadicos": [
    "Registro Fiscal/Equivalente",
    "Certificación Bancaria Internacional",
  ],
  "proveedores-internacionales-compras-continuas": [
    "Registro Fiscal",
    "Contrato/Marco",
    "Certificación Bancaria Internacional",
  ],

  // ACCIONISTAS
  "personas-naturales": ["CC", "Declaración de Origen de Fondos"],
  "personas-juridicas": [
    "Cámara de Comercio",
    "Representación Legal",
    "CC Representante",
  ],

  // EMPLEADOS
  "empleados-nuevos": ["CC", "Certificación Laboral/Ingresos"],
  "empleados-existentes": [],
};
