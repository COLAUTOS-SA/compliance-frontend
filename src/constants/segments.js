

export const SEGMENTS_BY_ROLE = {
  clientes: [
    {
      slug: "personas-juridicas-venta-vehiculos",
      label: "PERSONAS JURIDICAS VENTA DE VEHÍCULOS",
    },
    { slug: "aseguradoras-y-financieras", label: "ASEGURADORAS Y FINANCIERAS" },
    {
      slug: "aliados-retomadores-pj",
      label: "ALIADOS RETOMADORES Y OTROS PERSONA JURIDICA",
    },
    {
      slug: "aliados-retomadores-pn",
      label: "ALIADOS RETOMADORES Y OTROS PERSONA NATURAL",
    },
  ],
  proveedores: [
    {
      slug: "proveedores-generales-pj-y-financieras",
      label: "GENERALES PERSONA JURIDICA Y ENTIDADES FINANCIERAS",
    },
    {
      slug: "proveedores-generales-pn",
      label: "GENERALES PERSONA NATURAL",
    },
    {
      slug: "proveedores-menores-pj",
      label:
        "MENORES (compras hasta 1 SMLMV o 1 sola vez) PERSONA JURIDICA",
    },
    {
      slug: "proveedores-menores-pn",
      label:
        "MENORES (compras hasta 1 SMLMV o 1 sola vez) PERSONA NATURAL",
    },
    {
      slug: "proveedores-menores-caja-viaticos",
      label: "MENORES (Cajas menores, viaticos)",
    },
    {
      slug: "proveedores-internacionales-esporadicos",
      label:
        "INTERNACIONALES y/o ESPORÁDICOS (PLATAFORMAS DIGITALES)",
    },
    {
      slug: "proveedores-internacionales-compras-continuas",
      label: "INTERNACIONALES y/o COMPRAS CONTINUAS",
    },
  ],
  accionistas: [
    { slug: "personas-naturales", label: "PERSONAS NATURALES" },
    { slug: "personas-juridicas", label: "PERSONAS JURIDICAS" },
  ],
  empleados: [{ slug: "empleados-nuevos", label: "EMPLEADOS NUEVOS" },
    { slug: "empleados-existentes", label: "EMPLEADOS EXISTENTES" },
  ],
};


export const firstSegmentOf = (role) =>
  SEGMENTS_BY_ROLE[role]?.[0]?.slug || "empleados-nuevos";

export const findLabel = (role, slug) =>
  SEGMENTS_BY_ROLE[role]?.find((s) => s.slug === slug)?.label || null;

export const isAllowedSegment = (role, slug) =>
  !!SEGMENTS_BY_ROLE[role]?.some((s) => s.slug === slug);

