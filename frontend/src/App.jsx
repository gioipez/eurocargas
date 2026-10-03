import { useState } from "react";
import CargadorPage from "./pages/cargador/CargadorPage.jsx";
import WizardPage from "./pages/comercial/WizardPage.jsx";

export default function App() {
  const [rol, setRol] = useState(null);

  if (!rol) {
    return (
      <div className="container">
        <div className="role-picker">
          <button onClick={() => setRol("cargador")}>Soy Cargador<br /><span className="muted">Registrar empresas e ítems</span></button>
          <button onClick={() => setRol("comercial")}>Soy Comercial<br /><span className="muted">Generar cotización</span></button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="app-header">
        <h1>Eurocargas — Cotizador ({rol === "cargador" ? "Cargador" : "Comercial"})</h1>
        <button onClick={() => setRol(null)}>Cambiar rol</button>
      </div>
      <div className="container">
        {rol === "cargador" ? <CargadorPage /> : <WizardPage />}
      </div>
    </div>
  );
}
