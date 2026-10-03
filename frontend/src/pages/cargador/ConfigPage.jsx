import { useEffect, useState } from "react";
import { api } from "../../api.js";

export default function ConfigPage() {
  const [tasa, setTasa] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.obtenerConfig().then((c) => setTasa(String(c.tasa_cambio_usd_cop))).catch((e) => setError(e.message));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setGuardado(false);
    try {
      await api.actualizarConfig({ tasa_cambio_usd_cop: Number(tasa) });
      setGuardado(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <h2>Configuración global</h2>
      <p className="muted">Todo se cotiza internamente en USD. Esta tasa se usa por defecto para convertir a COP; el comercial puede sobreescribirla en una cotización puntual.</p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {guardado && <div className="success-banner" role="status">Tasa de cambio actualizada.</div>}
      <form className="inline-form" onSubmit={onSubmit}>
        <label>
          Tasa de cambio (COP por 1 USD)
          <input type="number" step="0.01" min="0.01" value={tasa} onChange={(e) => setTasa(e.target.value)} required />
        </label>
        <button className="primary" type="submit">Guardar</button>
      </form>
    </div>
  );
}
