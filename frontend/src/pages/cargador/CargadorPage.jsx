import { useState } from "react";
import EmpresasPage from "./EmpresasPage.jsx";
import PuertosPage from "./PuertosPage.jsx";
import ItemsPage from "./ItemsPage.jsx";
import ConfigPage from "./ConfigPage.jsx";

const TABS = [
  { id: "empresas", label: "Empresas" },
  { id: "puertos", label: "Puertos" },
  { id: "items", label: "Ítems / Tarifas" },
  { id: "config", label: "Configuración" },
];

export default function CargadorPage() {
  const [tab, setTab] = useState("empresas");

  return (
    <div>
      <nav className="tabs" aria-label="Secciones del Cargador">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "empresas" && <EmpresasPage />}
      {tab === "puertos" && <PuertosPage />}
      {tab === "items" && <ItemsPage />}
      {tab === "config" && <ConfigPage />}
    </div>
  );
}
