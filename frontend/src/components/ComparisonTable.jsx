import { Fragment, useMemo, useState } from "react";
import {
  UNIDAD_CORTA, estadoVigencia, formatDelta, formatFecha, formatRecargos, formatTransito, formatUsd, frecuenciaLabel, textoPorVencer,
} from "../labels.js";

const ORDENES = {
  precio: { label: "Precio (menor a mayor)", cmp: (a, b) => a.costoTotal - b.costoTotal },
  // Sin dato de tránsito va al final: no se puede afirmar que sea el más rápido.
  transito: {
    label: "Tránsito (menor a mayor)",
    cmp: (a, b) => (a.item.transito_dias ?? Infinity) - (b.item.transito_dias ?? Infinity) || a.costoTotal - b.costoTotal,
  },
};

function TagsVigencia({ vigenciaHasta }) {
  const { estado, dias } = estadoVigencia(vigenciaHasta);
  if (estado === "vencida") return <span className="chip danger">Vencida</span>;
  if (estado === "por_vencer") return <span className="chip warn">{textoPorVencer(dias)}</span>;
  return null;
}

export default function ComparisonTable({ filas, seleccionadoId, onSeleccionar }) {
  const [orden, setOrden] = useState("precio");

  // Solo es válido comparar precios dentro del mismo servicio (p. ej. un 20' no se compara con un 40').
  const grupos = useMemo(() => {
    const porServicio = new Map();
    for (const f of filas) {
      if (!porServicio.has(f.item.descripcion)) porServicio.set(f.item.descripcion, []);
      porServicio.get(f.item.descripcion).push(f);
    }
    return [...porServicio]
      .map(([servicio, fs]) => ({
        servicio,
        filas: [...fs].sort(ORDENES[orden].cmp),
        // Precios con distinto Incoterm no cubren lo mismo; "sin dato" cuenta como un valor aparte.
        incoterms: [...new Set(fs.map((f) => f.item.incoterm ?? "sin dato"))],
        // Referencias del grupo (independientes del orden elegido): menor costo total y menor tránsito conocido.
        minCosto: Math.min(...fs.map((f) => f.costoTotal)),
        minTransito: Math.min(...fs.map((f) => f.item.transito_dias ?? Infinity)),
      }))
      .sort((a, b) => a.servicio.localeCompare(b.servicio));
  }, [filas, orden]);

  if (filas.length === 0) {
    return <p className="empty-state">No hay empresas con ítems vigentes para esta combinación.</p>;
  }

  const variosGrupos = grupos.length > 1;
  const avisoIncoterm = (g) => `Las ofertas no cubren el mismo Incoterm (${g.incoterms.join(", ")}): los precios no son directamente comparables.`;

  const COLUMNAS = 11;

  const onFilaClick = (e, id) => {
    if (e.target.tagName !== "INPUT") onSeleccionar(id); // el radio ya notifica su propio cambio
  };

  return (
    <>
      {!variosGrupos && grupos[0].incoterms.length > 1 && <div className="warning-banner">{avisoIncoterm(grupos[0])}</div>}
      <div className="toolbar">
        <span className="muted">
          {filas.length} {filas.length === 1 ? "oferta" : "ofertas"}
          {variosGrupos && ` en ${grupos.length} servicios (se comparan dentro de cada servicio)`}
        </span>
        <div className="sort-control">
          <label htmlFor="orden-comparativo">Ordenar por</label>
          <select id="orden-comparativo" value={orden} onChange={(e) => setOrden(e.target.value)}>
            {Object.entries(ORDENES).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="table-wrap">
        <table className="comparison-table">
          <caption className="sr-only">Ofertas de los proveedores; seleccione una para cotizar</caption>
          <thead>
            <tr>
              <th scope="col" className="col-select"><span className="sr-only">Seleccionar</span></th>
              <th scope="col">Empresa</th>
              <th scope="col">Servicio</th>
              <th scope="col" className="num">Tarifa</th>
              <th scope="col">Recargos</th>
              <th scope="col">Incoterm</th>
              <th scope="col">Tránsito</th>
              <th scope="col">Salidas</th>
              <th scope="col" className="num">Costo total (USD, con recargos)</th>
              <th scope="col">Frente a la más económica</th>
              <th scope="col">Vigente hasta</th>
            </tr>
          </thead>
          <tbody className="clickable">
            {grupos.map((g) => (
              <Fragment key={g.servicio}>
              {variosGrupos && (
                <tr className="grupo-header">
                  <td colSpan={COLUMNAS}>
                    {g.servicio} · {g.filas.length} {g.filas.length === 1 ? "oferta" : "ofertas"}
                    {g.incoterms.length > 1 && (
                      <>{" "}<span className="chip warn" title={avisoIncoterm(g)}>Incoterms distintos: {g.incoterms.join(", ")}</span></>
                    )}
                  </td>
                </tr>
              )}
              {g.filas.map((f) => {
                const comparable = g.filas.length > 1;
                const esEconomica = comparable && f.costoTotal === g.minCosto;
                const esRapida = comparable && f.item.transito_dias != null && f.item.transito_dias === g.minTransito;
                return (
                <tr
                  key={f.item.id}
                  data-fila
                  className={[
                    f.item.id === seleccionadoId && "selected",
                    esEconomica && "mejor",
                    estadoVigencia(f.vigenciaHasta).estado === "vencida" && "vencida",
                  ].filter(Boolean).join(" ")}
                  onClick={(e) => onFilaClick(e, f.item.id)}
                >
                  <td>
                    <input
                      type="radio"
                      name="oferta"
                      aria-label={`Seleccionar ${f.item.empresa.nombre} · ${f.item.descripcion}`}
                      checked={f.item.id === seleccionadoId}
                      onChange={() => onSeleccionar(f.item.id)}
                    />
                  </td>
                  <td>
                    <span className="empresa-nombre">{f.item.empresa.nombre}</span>
                    <div className="tags"><TagsVigencia vigenciaHasta={f.vigenciaHasta} /></div>
                  </td>
                  <td>{f.item.descripcion}</td>
                  <td className="num nowrap">{formatUsd(f.item.costo_base)} <span className="cell-meta">{UNIDAD_CORTA[f.item.unidad_tarifa]}</span></td>
                  <td className="muted">{formatRecargos(f.item)}</td>
                  <td>{f.item.incoterm ?? <span className="muted">Sin dato</span>}</td>
                  <td>{formatTransito(f.item.transito_dias)}</td>
                  <td>{frecuenciaLabel(f.item.frecuencia)}</td>
                  <td className="num total">{formatUsd(f.costoTotal)}</td>
                  <td className="comparacion">
                    {esEconomica && <span className="badge badge-best">Más económica</span>}
                    {esRapida && <span className="badge badge-fast">Más rápida</span>}
                    {comparable && !esEconomica && <span className="delta">{formatDelta(f.costoTotal - g.minCosto, g.minCosto)}</span>}
                  </td>
                  <td className="nowrap">{formatFecha(f.vigenciaHasta)}</td>
                </tr>
                );
              })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
