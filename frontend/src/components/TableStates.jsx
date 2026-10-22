// Estados de tabla: cargando (filas esqueleto) y vacío/error.
// "Cargando…" no usa role=status: ese rol queda reservado para los avisos de éxito de cada pantalla.
export function LoadingRow({ colSpan, filas = 3 }) {
  return (
    <>
      <tr className="loading-row">
        <td colSpan={colSpan}><span className="loading-text">Cargando…</span></td>
      </tr>
      {Array.from({ length: filas }, (_, i) => (
        <tr key={i} className="skeleton-row" aria-hidden="true">
          <td colSpan={colSpan}><span className="skeleton" /></td>
        </tr>
      ))}
    </>
  );
}

export function TableEmpty({ colSpan, titulo, detalle }) {
  return (
    <tr className="empty-row">
      <td colSpan={colSpan} className="empty-state">
        <strong className="empty-title">{titulo}</strong>
        {detalle && <span className="empty-detail">{detalle}</span>}
      </td>
    </tr>
  );
}
