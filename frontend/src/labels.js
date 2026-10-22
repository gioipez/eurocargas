export const FRECUENCIAS = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
];

export const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"];

export const CONCEPTOS_RECARGO = [
  { value: "baf", label: "BAF (combustible marítimo)" },
  { value: "caf", label: "CAF (cambiario)" },
  { value: "thc", label: "THC (manejo en terminal)" },
  { value: "documentacion", label: "Documentación" },
  { value: "combustible", label: "Combustible (aéreo)" },
  { value: "seguridad", label: "Seguridad" },
  { value: "otros", label: "Otros" },
];

const FRECUENCIA_LABEL = Object.fromEntries(FRECUENCIAS.map((f) => [f.value, f.label]));
const CONCEPTO_SIGLA = { baf: "BAF", caf: "CAF", thc: "THC", documentacion: "Docs", combustible: "Comb.", seguridad: "Seg.", otros: "Otros" };

// Etiqueta corta de la unidad de tarifa para tablas (en formularios se usa la descripción larga).
export const UNIDAD_CORTA = { por_contenedor: "por contenedor", por_kg: "por kg", por_cbm_wm: "por CBM/W-M" };

export const frecuenciaLabel = (v) => FRECUENCIA_LABEL[v] ?? "Sin dato";

const pluralDias = (n) => `${n} ${n === 1 ? "día" : "días"}`;

export const formatTransito = (dias) => (dias == null ? "Sin dato" : pluralDias(dias));

// Etiquetas legibles de los enums del backend (los valores enviados no cambian).
export const TIPOS_EMPRESA = [
  { value: "naviera", label: "Naviera" },
  { value: "aerolinea", label: "Aerolínea" },
  { value: "agente", label: "Agente de carga" },
];

export const TIPOS_ITEM = [
  { value: "contenedor_maritimo", label: "Contenedor marítimo (FCL)" },
  { value: "carga_aerea", label: "Carga aérea" },
  { value: "lcl", label: "LCL / Fragmento" },
];

export const TIPOS_IMPORTACION = [
  { value: "importacion", label: "Importación" },
  { value: "exportacion", label: "Exportación" },
];

const aMapa = (lista) => Object.fromEntries(lista.map((x) => [x.value, x.label]));
const TIPO_EMPRESA_LABEL = aMapa(TIPOS_EMPRESA);
const TIPO_ITEM_LABEL = aMapa(TIPOS_ITEM);
const TIPO_IMPORTACION_LABEL = aMapa(TIPOS_IMPORTACION);

// Si llega un valor desconocido se muestra tal cual en vez de ocultarlo.
export const tipoEmpresaLabel = (v) => TIPO_EMPRESA_LABEL[v] ?? v;
export const tipoItemLabel = (v) => TIPO_ITEM_LABEL[v] ?? v;
export const tipoImportacionLabel = (v) => TIPO_IMPORTACION_LABEL[v] ?? v;

// Montos con separador de miles y código de moneda; formato fijo (no depende del idioma del navegador).
const conMiles = (n, decimales) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

export const formatUsd = (n) => `USD ${conMiles(n, 2)}`;

// Los pesos se muestran sin decimales.
export const formatCop = (n) => `COP ${conMiles(Math.round(n), 0)}`;

export const formatMoneda = (n, moneda) => (moneda === "COP" ? formatCop(n) : formatUsd(n));

// Diferencia contra la mejor oferta: "+USD 160.50 · +5.4%".
export function formatDelta(diferencia, base) {
  const pct = base > 0 ? Math.round((diferencia / base) * 1000) / 10 : 0;
  return `+${formatUsd(diferencia)} · +${pct}%`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// "2026-01-31" (o un ISO con hora) -> "31 ene 2026". Se lee el texto, no se convierte de zona horaria.
export function formatFecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return iso ?? "";
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

// Fecha hasta la que es válida la tarifa: creación + días de vigencia ("YYYY-MM-DD").
export function vigenciaHasta(item) {
  const fecha = new Date(item.fecha_creacion);
  fecha.setDate(fecha.getDate() + item.vigencia_dias);
  return fecha.toISOString().slice(0, 10);
}

// `vigenciaHasta` es "YYYY-MM-DD". Vencida si ya pasó ese día; "por vencer" si faltan 7 días o menos.
export function estadoVigencia(vigenciaHasta, ahora = new Date()) {
  const hoy = ahora.toISOString().slice(0, 10);
  const dias = Math.round((Date.parse(vigenciaHasta) - Date.parse(hoy)) / 86400000);
  if (dias < 0) return { estado: "vencida", dias };
  if (dias <= 7) return { estado: "por_vencer", dias };
  return { estado: "vigente", dias };
}

export const textoPorVencer = (dias) => (dias === 0 ? "Vence hoy" : `Vence en ${pluralDias(dias)}`);

// Ítems anteriores al desglose solo tienen el total consolidado.
export function formatRecargos(item) {
  if (!item.recargos?.length) return `${(item.impuestos_pct * 100).toFixed(1)}% (consolidado)`;
  return item.recargos.map((r) => `${CONCEPTO_SIGLA[r.concepto]} ${(r.porcentaje * 100).toFixed(1)}%`).join(" · ");
}
