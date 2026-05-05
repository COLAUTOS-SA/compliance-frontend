export const MOCK_ROWS = [
  {
    id: "row-1",
    counterpartType: "proveedores",
    segment: "proveedores-generales-pj-y-financieras",
    nombre: "ACME S.A.S.",
    tipoDocumento: "NIT",
    numeroDocumento: "901234567-8",
    firmadoUrl: "#", // enlace al PDF firmado (mock)
    docs: {
      RUT: { status: "pendiente", comentario: "", fileName: "" },
      "Cámara de Comercio": {
        status: "pendiente",
        comentario: "",
        fileName: "",
      },
      "CC Representante": { status: "pendiente", comentario: "", fileName: "" },
      "Certificación Bancaria": {
        status: "aprobado",
        comentario: "Vigente",
        fileName: "cert_banco.pdf",
      },
      "Formato Conocimiento": {
        status: "rechazado",
        comentario: "Falta firma",
        fileName: "",
      },
    },
  },
  {
    id: "row-2",
    counterpartType: "clientes",
    segment: "aliados-retomadores-pn",
    nombre: "Juan Pérez",
    tipoDocumento: "CC",
    numeroDocumento: "1090xxxxxx",
    firmadoUrl: "#",
    docs: {
      CC: { status: "aprobado", comentario: "", fileName: "cc_juan.pdf" },
      "Certificación Laboral/Ingresos": {
        status: "pendiente",
        comentario: "",
        fileName: "",
      },
      "Formato Conocimiento": {
        status: "pendiente",
        comentario: "",
        fileName: "",
      },
    },
  },
  {
    id: "row-3",
    counterpartType: "accionistas",
    segment: "personas-juridicas",
    nombre: "Inversiones XYZ S.A.",
    tipoDocumento: "NIT",
    numeroDocumento: "900123456-1",
    firmadoUrl: "#",
    docs: {
      "Cámara de Comercio": {
        status: "pendiente",
        comentario: "",
        fileName: "",
      },
      "Representación Legal": {
        status: "pendiente",
        comentario: "",
        fileName: "",
      },
      "CC Representante": {
        status: "rechazado",
        comentario: "Copia ilegible",
        fileName: "",
      },
    },
  },
];
