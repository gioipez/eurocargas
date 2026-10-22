import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { Field, useValidacion } from "../../components/Field.jsx";

export default function ConfigPage() {
  const [tasa, setTasa] = useState("");
  const [carga, setCarga] = useState("cargando"); // cargando | ok | error
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);
  const { formRef, errores, validar, onCambio, aplicarErroresServidor } = useValidacion();

  useEffect(() => {
    api.obtenerConfig()
      .then((c) => { setTasa(String(c.tasa_cambio_usd_cop)); setCarga("ok"); })
      .catch((e) => { setError(e.message); setCarga("error"); });
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (enCurso.current) return;
    setError(null);
    setGuardado(false);
    if (!validar()) return;
    enCurso.current = true;
    setGuardando(true);
    try {
      await api.actualizarConfig({ tasa_cambio_usd_cop: Number(tasa) });
      setGuardado(true);
    } catch (err) {
      setError(err.message);
      aplicarErroresServidor(err.campos);
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h2>Configuración global</h2>
        <p className="page-subtitle">
          Todo se cotiza internamente en USD. Esta tasa se usa por defecto para convertir a COP; el comercial puede sobreescribirla en una cotización puntual.
        </p>
      </header>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {guardado && <div className="success-banner" role="status">Tasa de cambio actualizada.</div>}

      <section className="card">
        <h3 id="config-tasa" className="card-title">Tasa de cambio</h3>
        {carga === "cargando" && <p className="loading-text">Cargando…</p>}
        {carga === "error" && <p className="muted">No se pudo cargar la configuración actual. Recarga la página para intentarlo de nuevo.</p>}
        {carga === "ok" && (
          <form ref={formRef} className="inline-form" onSubmit={onSubmit} onChange={onCambio} noValidate>
            <Field label="Tasa de cambio (COP por 1 USD)" error={errores.tasa_cambio_usd_cop} help="Pesos colombianos por cada dólar. Usa punto para los decimales.">
              <input
                name="tasa_cambio_usd_cop"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={tasa}
                onChange={(e) => { setTasa(e.target.value); setGuardado(false); }}
                required
              />
            </Field>
            <div className="form-actions">
              <button className="primary" type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
