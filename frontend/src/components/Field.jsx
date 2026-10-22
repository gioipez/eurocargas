import { cloneElement, useCallback, useId, useRef, useState } from "react";

// Campo de formulario: etiqueta encima, control, ayuda y error.
// La ayuda y el error quedan FUERA del <label> (el nombre accesible es solo `label`)
// y se enlazan al control con aria-describedby.
export function Field({ label, help, error, children, className = "" }) {
  const autoId = useId();
  const id = children.props.id ?? `campo${autoId.replace(/:/g, "")}`;
  const helpId = help ? `${id}-ayuda` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [children.props["aria-describedby"], errorId, helpId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`field ${error ? "has-error" : ""} ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error && <p id={errorId} className="field-error">{error}</p>}
      {help && <p id={helpId} className="field-help">{help}</p>}
    </div>
  );
}

function decimalesDe(step) {
  const s = String(step ?? "");
  return s.includes(".") ? s.split(".")[1].length : 0;
}

// Mensaje en español a partir de la validación nativa del control (required, min, pattern, step…).
// `data-error` en el control permite un texto propio.
export function mensajeDeValidez(el) {
  const v = el.validity;
  if (v.valid) return null;
  if (el.dataset?.error && !v.valueMissing) return el.dataset.error;
  if (v.valueMissing) return el.tagName === "SELECT" ? "Selecciona una opción." : "Este campo es obligatorio.";
  if (v.badInput) return "Ingresa un número válido.";
  if (v.patternMismatch) return "El formato no es válido.";
  if (v.rangeUnderflow) return Number(el.min) > 0 && Number(el.min) < 1 ? "Debe ser mayor que 0." : `Debe ser mayor o igual a ${el.min}.`;
  if (v.rangeOverflow) return `Debe ser menor o igual a ${el.max}.`;
  if (v.stepMismatch) {
    const d = decimalesDe(el.step);
    return d === 0 ? "Debe ser un número entero." : `Usa como máximo ${d} ${d === 1 ? "decimal" : "decimales"}.`;
  }
  if (v.tooLong) return `Máximo ${el.maxLength} caracteres.`;
  if (v.tooShort) return `Mínimo ${el.minLength} caracteres.`;
  return "Valor no válido.";
}

// Validación en línea sobre la API de restricciones del navegador: el formulario usa noValidate,
// y al enviar se muestran los errores junto a cada campo (por `name`) y se enfoca el primero inválido.
export function useValidacion() {
  const [errores, setErrores] = useState({});
  const formRef = useRef(null);

  const validar = useCallback(() => {
    const form = formRef.current;
    if (!form) return true;
    const nuevos = {};
    let primero = null;
    for (const el of form.elements) {
      if (!el.name || !el.willValidate) continue;
      const msg = mensajeDeValidez(el);
      if (msg) {
        nuevos[el.name] = msg;
        primero ??= el;
      }
    }
    setErrores(nuevos);
    primero?.focus();
    return !primero;
  }, []);

  // Al corregir un campo con error se revalida solo ese campo (no se marcan errores mientras se escribe).
  const onCambio = useCallback((e) => {
    const el = e.target;
    if (!el?.name) return;
    setErrores((prev) => (prev[el.name] ? { ...prev, [el.name]: mensajeDeValidez(el) ?? undefined } : prev));
  }, []);

  // Errores por campo que devuelve el backend (422): se muestran junto al campo si existe en el formulario.
  const aplicarErroresServidor = useCallback((campos = {}) => {
    const form = formRef.current;
    const nuevos = {};
    let primero = null;
    for (const [nombre, msg] of Object.entries(campos)) {
      const el = form?.elements.namedItem(nombre);
      if (el) {
        nuevos[nombre] = msg;
        primero ??= el;
      }
    }
    if (primero) {
      setErrores((prev) => ({ ...prev, ...nuevos }));
      primero.focus?.();
    }
  }, []);

  const limpiar = useCallback(() => setErrores({}), []);

  return { formRef, errores, validar, onCambio, aplicarErroresServidor, limpiar };
}
