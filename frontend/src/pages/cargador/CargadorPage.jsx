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

// La pestaña activa la controla App (vive en el hash de la URL).
export default function CargadorPage({ tab = "empresas", onTab }) {
  return (
    <div>
      <nav className="tabs" aria-label="Secciones del Cargador">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => onTab?.(t.id)}
          >
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
