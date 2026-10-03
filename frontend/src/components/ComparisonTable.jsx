import { Fragment, useMemo, useState } from "react";
import { UNIDAD_CORTA, estadoVigencia, formatRecargos, formatTransito, formatUsd, frecuenciaLabel, textoPorVencer } from "../labels.js";

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
      }))
      .sort((a, b) => a.servicio.localeCompare(b.servicio));
  }, [filas, orden]);

  if (filas.length === 0) {
    return <p className="empty-state">No hay empresas con ítems vigentes para esta combinación.</p>;
  }

  const variosGrupos = grupos.length > 1;
  const avisoIncoterm = (g) => `Las ofertas no cubren el mismo Incoterm (${g.incoterms.join(", ")}): los precios no son directamente comparables.`;

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
              <th className="num">Costo total (USD, con recargos)</th>
              <th>Vigente hasta</th>
            </tr>
          </thead>
          <tbody className="clickable">
            {grupos.map((g) => (
              <Fragment key={g.servicio}>
              {variosGrupos && (
                <tr className="grupo-header">
                  <td colSpan={10}>
                    {g.servicio} · {g.filas.length} {g.filas.length === 1 ? "oferta" : "ofertas"}
                    {g.incoterms.length > 1 && (
                      <>{" "}<span className="chip warn" title={avisoIncoterm(g)}>Incoterms distintos: {g.incoterms.join(", ")}</span></>
                    )}
                  </td>
                </tr>
              )}
              {g.filas.map((f) => (
                <tr
                  key={f.item.id}
                  data-fila
                  className={[f.item.id === seleccionadoId && "selected", estadoVigencia(f.vigenciaHasta).estado === "vencida" && "vencida"].filter(Boolean).join(" ")}
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
                  <td className="nowrap">{formatUsd(f.item.costo_base)} <span className="muted">{UNIDAD_CORTA[f.item.unidad_tarifa]}</span></td>
                  <td className="muted">{formatRecargos(f.item)}</td>
                  <td>{f.item.incoterm ?? <span className="muted">Sin dato</span>}</td>
                  <td>{formatTransito(f.item.transito_dias)}</td>
                  <td>{frecuenciaLabel(f.item.frecuencia)}</td>
                  <td className="num total">{formatUsd(f.costoTotal)}</td>
                  <td>{f.vigenciaHasta}</td>
                </tr>
              ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
