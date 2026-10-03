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

export const frecuenciaLabel = (v) => FRECUENCIA_LABEL[v] ?? "Sin dato";

export const formatTransito = (dias) => (dias == null ? "Sin dato" : `${dias} días`);

// Ítems anteriores al desglose solo tienen el total consolidado.
export function formatRecargos(item) {
  if (!item.recargos?.length) return `${(item.impuestos_pct * 100).toFixed(1)}% (consolidado)`;
  return item.recargos.map((r) => `${CONCEPTO_SIGLA[r.concepto]} ${(r.porcentaje * 100).toFixed(1)}%`).join(" · ");
}
