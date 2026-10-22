import { useCallback, useEffect, useRef, useState } from "react";
import CargadorPage from "./pages/cargador/CargadorPage.jsx";
import WizardPage from "./pages/comercial/WizardPage.jsx";
import { buildHash, parseHash } from "./routing.js";

const ROL_LABEL = { cargador: "Cargador", comercial: "Comercial" };
const TITULO_TAB = { empresas: "Empresas", puertos: "Puertos", items: "Ítems / Tarifas", config: "Configuración" };

function IconoCargador() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </svg>
  );
}

function IconoComercial() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" />
    </svg>
  );
}

function RoleLanding({ onElegir }) {
  return (
    <main className="landing">
      <span className="brand-mark brand-mark-lg" aria-hidden="true">E</span>
      <h1>Eurocargas · Cotizador</h1>
      <p className="landing-lead">Compara tarifas de proveedores y genera cotizaciones. ¿Con qué rol vas a trabajar?</p>
      <div className="role-picker">
        <button type="button" className="role-card" onClick={() => onElegir("cargador")}>
          <span className="role-icon" aria-hidden="true"><IconoCargador /></span>
          <span className="role-title">Soy Cargador</span>
          <span className="role-desc">Registrar empresas, puertos e ítems de costo</span>
          <span className="role-cta" aria-hidden="true">Entrar →</span>
        </button>
        <button type="button" className="role-card" onClick={() => onElegir("comercial")}>
          <span className="role-icon" aria-hidden="true"><IconoComercial /></span>
          <span className="role-title">Soy Comercial</span>
          <span className="role-desc">Comparar ofertas y generar cotización</span>
          <span className="role-cta" aria-hidden="true">Entrar →</span>
        </button>
      </div>
    </main>
  );
}

export default function App() {
  const [ruta, setRuta] = useState(() => parseHash(window.location.hash));
  const [wizardSucio, setWizardSucio] = useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const cambiarRolRef = useRef(null);
  const seguirRef = useRef(null);

  // Atrás/adelante del navegador o un enlace con hash: la URL es la fuente de verdad.
  useEffect(() => {
    const onHash = () => {
      setRuta(parseHash(window.location.hash));
      setConfirmandoSalida(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const partes = [ruta.rol === "cargador" ? TITULO_TAB[ruta.tab] : ruta.rol === "comercial" ? "Cotización" : null, "Eurocargas - Cotizador"];
    document.title = partes.filter(Boolean).join(" · ");
  }, [ruta]);

  const navegar = useCallback((destino) => {
    const hash = buildHash(destino);
    if (window.location.hash !== hash) window.location.hash = hash; // crea entrada de historial
    setRuta(parseHash(hash)); // sin esperar al evento hashchange (que trae el mismo valor)
    setConfirmandoSalida(false);
    if (destino.rol !== "comercial") setWizardSucio(false);
  }, []);

  const onCambiarRol = () => {
    if (ruta.rol === "comercial" && wizardSucio) setConfirmandoSalida(true);
    else navegar({ rol: null });
  };

  const volverFocoACambiarRol = useRef(false);
  const cancelarSalida = () => {
    volverFocoACambiarRol.current = true;
    setConfirmandoSalida(false);
  };

  // Al abrir la confirmación el foco va a la opción segura; al cancelarla vuelve a "Cambiar rol".
  useEffect(() => {
    if (confirmandoSalida) seguirRef.current?.focus();
    else if (volverFocoACambiarRol.current) {
      volverFocoACambiarRol.current = false;
      cambiarRolRef.current?.focus();
    }
  }, [confirmandoSalida]);

  if (!ruta.rol) {
    return (
      <div className="container">
        <RoleLanding onElegir={(rol) => navegar({ rol, tab: rol === "cargador" ? "empresas" : null })} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">E</span>
            <h1 className="app-title">
              Eurocargas <span className="role-pill">Cotizador ({ROL_LABEL[ruta.rol]})</span>
            </h1>
          </div>
          {confirmandoSalida ? (
            <div
              className="header-confirm"
              role="group"
              aria-label="Confirmar cambio de rol"
              onKeyDown={(e) => { if (e.key === "Escape") cancelarSalida(); }}
            >
              <span className="header-confirm-text">Hay una cotización en curso. Si cambias de rol se perderá.</span>
              <button type="button" className="danger" onClick={() => navegar({ rol: null })}>Descartar y cambiar</button>
              <button type="button" className="ghost" ref={seguirRef} onClick={cancelarSalida}>Seguir cotizando</button>
            </div>
          ) : (
            <button type="button" className="ghost" ref={cambiarRolRef} onClick={onCambiarRol}>Cambiar rol</button>
          )}
        </div>
      </header>
      <main className="container">
        {ruta.rol === "cargador"
          ? <CargadorPage tab={ruta.tab} onTab={(tab) => navegar({ rol: "cargador", tab })} />
          : <WizardPage onDirtyChange={setWizardSucio} />}
      </main>
    </div>
  );
}
