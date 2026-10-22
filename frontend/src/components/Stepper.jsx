// Indicador de progreso del wizard. Los pasos completados y el actual son botones que llevan a su sección;
// los futuros quedan deshabilitados. No altera el estado del wizard: solo navega (foco + scroll).
export default function Stepper({ pasos, actual, onIr, etiqueta = "Pasos de la cotización" }) {
  return (
    <nav aria-label={etiqueta} className="stepper-nav">
      <ol className="stepper">
        {pasos.map((p, i) => {
          const estado = i < actual ? "done" : i === actual ? "current" : "todo";
          return (
            <li key={p.id} className={`stepper-item is-${estado}`} aria-current={estado === "current" ? "step" : undefined}>
              <button type="button" className="stepper-btn" disabled={estado === "todo"} onClick={() => onIr(p.id)}>
                <span className="stepper-dot" aria-hidden="true">
                  {estado === "done" ? (
                    <svg viewBox="0 0 16 16" width="12" height="12" focusable="false"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : i + 1}
                </span>
                <span className="stepper-label">{p.label}</span>
                {estado === "done" && <span className="sr-only"> (completado)</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
