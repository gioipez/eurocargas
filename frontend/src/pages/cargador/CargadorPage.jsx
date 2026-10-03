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
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "empresas" && <EmpresasPage />}
      {tab === "puertos" && <PuertosPage />}
      {tab === "items" && <ItemsPage />}
      {tab === "config" && <ConfigPage />}
    </div>
  );
}
