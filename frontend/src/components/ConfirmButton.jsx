import { useState } from "react";

// Acción destructiva en dos pasos, en línea (sin diálogos del navegador).
export default function ConfirmButton({ onConfirm, mensaje = "¿Seguro?", children = "Eliminar" }) {
  const [pidiendo, setPidiendo] = useState(false);

  if (!pidiendo) {
    return (
      <button type="button" className="secondary danger-text" onClick={() => setPidiendo(true)}>
        {children}
      </button>
    );
  }

  return (
    <span className="confirm-inline" role="group">
      <span className="muted">{mensaje}</span>
      <button type="button" className="danger" onClick={() => { setPidiendo(false); onConfirm(); }}>
        Confirmar
      </button>
      <button type="button" className="secondary" onClick={() => setPidiendo(false)}>
        Cancelar
      </button>
    </span>
  );
}
