import { useState } from "react";
import CargadorPage from "./pages/cargador/CargadorPage.jsx";
import WizardPage from "./pages/comercial/WizardPage.jsx";

export default function App() {
  const [rol, setRol] = useState(null);

  if (!rol) {
    return (
      <div className="container">
        <div className="landing">
          <h1>Eurocargas · Cotizador</h1>
          <p>Compara tarifas de proveedores y genera cotizaciones. ¿Con qué rol vas a trabajar?</p>
          <div className="role-picker">
            <button onClick={() => setRol("cargador")}>Soy Cargador<span className="muted">Registrar empresas, puertos e ítems de costo</span></button>
            <button onClick={() => setRol("comercial")}>Soy Comercial<span className="muted">Comparar ofertas y generar cotización</span></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">E</span>
          <h1>Eurocargas — Cotizador ({rol === "cargador" ? "Cargador" : "Comercial"})</h1>
        </div>
        <button onClick={() => setRol(null)}>Cambiar rol</button>
      </div>
      <div className="container">
        {rol === "cargador" ? <CargadorPage /> : <WizardPage />}
      </div>
    </div>
  );
}
