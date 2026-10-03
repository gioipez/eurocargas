export const empresa = { id: 1, nombre: "Maersk", tipo: "naviera" };

export const puertos = [
  { id: 1, nombre: "Shanghai", codigo: "CNSHA", pais: "China" },
  { id: 2, nombre: "Cartagena", codigo: "COCTG", pais: "Colombia" },
  { id: 3, nombre: "Legacy", codigo: null, pais: null },
];

export function makeItem(overrides = {}) {
  return {
    id: 1,
    empresa_id: 1,
    empresa,
    tipo: "contenedor_maritimo",
    descripcion: "Contenedor 40' estándar",
    origen: "Shanghai",
    destino: "Cartagena",
    unidad_tarifa: "por_contenedor",
    costo_base: 2800,
    impuestos_pct: 0.07,
    tipo_importacion: "importacion",
    vigencia_dias: 30,
    fecha_creacion: "2026-01-01T00:00:00",
    transito_dias: 32,
    frecuencia: "semanal",
    incoterm: "FOB",
    recargos: [
      { concepto: "baf", porcentaje: 0.04 },
      { concepto: "thc", porcentaje: 0.03 },
    ],
    ...overrides,
  };
}

// Ítem anterior a los campos nuevos: llega con nulls y sin desglose.
export const makeLegacyItem = (overrides = {}) =>
  makeItem({ id: 99, transito_dias: null, frecuencia: null, incoterm: null, recargos: [], impuestos_pct: 0.08, ...overrides });

export const fila = (item, costoTotal, vigenciaHasta = "2026-01-31") => ({ item, costoTotal, vigenciaHasta });
