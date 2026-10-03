import { useMemo, useState } from "react";
import { formatRecargos, formatTransito, frecuenciaLabel } from "../labels.js";

const UNIDAD_LABEL = {
  por_contenedor: "por contenedor",
  por_kg: "por kg",
  por_cbm_wm: "por CBM/W-M",
};

const ORDENES = {
  precio: { label: "Precio (menor a mayor)", cmp: (a, b) => a.costoTotal - b.costoTotal },
  // Sin dato de tránsito va al final: no se puede afirmar que sea el más rápido.
  transito: {
    label: "Tránsito (menor a mayor)",
    cmp: (a, b) => (a.item.transito_dias ?? Infinity) - (b.item.transito_dias ?? Infinity) || a.costoTotal - b.costoTotal,
  },
};

export default function ComparisonTable({ filas, seleccionadoId, onSeleccionar }) {
  const [orden, setOrden] = useState("precio");
  const ordenadas = useMemo(() => [...filas].sort(ORDENES[orden].cmp), [filas, orden]);

  if (filas.length === 0) {
    return <p className="muted">No hay empresas con ítems vigentes para esta combinación.</p>;
  }

  // Precios con distinto Incoterm no cubren lo mismo; "sin dato" cuenta como un valor aparte.
  const incoterms = new Set(filas.map((f) => f.item.incoterm ?? "sin dato"));

  return (
    <>
      {incoterms.size > 1 && (
        <div className="warning-banner">
          Las ofertas no cubren el mismo Incoterm ({[...incoterms].join(", ")}): los precios no son directamente comparables.
        </div>
      )}
      <div className="sort-control">
        <label htmlFor="orden-comparativo">Ordenar por</label>
        <select id="orden-comparativo" value={orden} onChange={(e) => setOrden(e.target.value)}>
          {Object.entries(ORDENES).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Empresa</th>
            <th>Servicio</th>
            <th>Tarifa</th>
            <th>Recargos</th>
            <th>Incoterm</th>
            <th>Tránsito</th>
            <th>Salidas</th>
            <th>Costo total (USD, con recargos)</th>
            <th>Vigente hasta</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((f) => (
            <tr key={f.item.id} className={f.item.id === seleccionadoId ? "selected" : ""}>
              <td><input type="radio" checked={f.item.id === seleccionadoId} onChange={() => onSeleccionar(f.item.id)} /></td>
              <td>{f.item.empresa.nombre}</td>
              <td>{f.item.descripcion}</td>
              <td>${f.item.costo_base.toFixed(2)} {UNIDAD_LABEL[f.item.unidad_tarifa]}</td>
              <td className="muted">{formatRecargos(f.item)}</td>
              <td>{f.item.incoterm ?? <span className="muted">Sin dato</span>}</td>
              <td>{formatTransito(f.item.transito_dias)}</td>
              <td>{frecuenciaLabel(f.item.frecuencia)}</td>
              <td><strong>${f.costoTotal.toFixed(2)}</strong></td>
              <td>{f.vigenciaHasta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
