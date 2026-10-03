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

// Montos con separador de miles; formato fijo (no depende del idioma del navegador).
export const formatUsd = (n) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
