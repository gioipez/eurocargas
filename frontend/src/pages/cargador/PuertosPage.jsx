import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import ConfirmButton from "../../components/ConfirmButton.jsx";
import { Field, useValidacion } from "../../components/Field.jsx";
import { LoadingRow, TableEmpty } from "../../components/TableStates.jsx";

const initialForm = { nombre: "", codigo: "", pais: "" };

// Mismo criterio que el backend: IATA (3 letras) o UN/LOCODE (2 letras de país + 3 alfanuméricos).
// El valor se normaliza a mayúsculas sin espacios mientras se escribe.
const PATRON_CODIGO = "[A-Z]{3}|[A-Z]{2}[A-Z0-9]{3}";

export default function PuertosPage() {
  const [puertos, setPuertos] = useState([]);
  const [carga, setCarga] = useState("cargando"); // cargando | ok | error
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);
  const listaRef = useRef(null);
  const { formRef, errores, validar, onCambio, aplicarErroresServidor } = useValidacion();

  const cargar = () =>
    api.listarPuertos()
      .then((data) => { setPuertos(data); setCarga("ok"); })
      .catch((e) => { setError(e.message); setCarga((c) => (c === "ok" ? c : "error")); });

  useEffect(() => { cargar(); }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const setCodigo = (e) => setForm({ ...form, codigo: e.target.value.replace(/\s+/g, "").toUpperCase() });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (enCurso.current) return;
    setError(null);
    setAviso(null);
    if (!validar()) return;
    enCurso.current = true;
    setGuardando(true);
    try {
      await api.crearPuerto({
        nombre: form.nombre,
        codigo: form.codigo.trim() ? form.codigo.trim().toUpperCase() : null,
        pais: form.pais.trim() || null,
      });
      setAviso(`Puerto "${form.nombre.trim()}" agregado.`);
      setForm(initialForm);
      cargar();
    } catch (err) {
      setError(err.message);
      aplicarErroresServidor(err.campos);
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  };

  const onDelete = async (id) => {
    setError(null);
    setAviso(null);
    try {
      await api.eliminarPuerto(id);
      setAviso("Puerto eliminado.");
      listaRef.current?.focus();
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h2>Puertos y aeropuertos</h2>
        <p className="page-subtitle">Catálogo único de origen/destino. Los ítems solo pueden usar puertos de esta lista.</p>
      </header>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {aviso && <div className="success-banner" role="status">{aviso}</div>}

      <section className="card">
        <h3 id="puertos-nuevo" className="card-title">Nuevo puerto</h3>
        <form ref={formRef} className="inline-form" onSubmit={onSubmit} onChange={onCambio} noValidate>
          <Field label="Nombre" error={errores.nombre}>
            <input name="nombre" value={form.nombre} onChange={set("nombre")} placeholder="Cartagena" required autoComplete="off" />
          </Field>
          <Field label="Código (UN/LOCODE o IATA)" error={errores.codigo} help="Opcional. 3 letras (IATA, p. ej. BOG) o 5 caracteres (UN/LOCODE, p. ej. COCTG).">
            <input
              name="codigo"
              value={form.codigo}
              onChange={setCodigo}
              placeholder="COCTG"
              maxLength={5}
              pattern={PATRON_CODIGO}
              data-error="Usa 3 letras (IATA) o 5 caracteres (UN/LOCODE)."
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="País" error={errores.pais}>
            <input name="pais" value={form.pais} onChange={set("pais")} placeholder="Colombia" />
          </Field>
          <div className="form-actions">
            <button className="primary" type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Agregar puerto"}
            </button>
          </div>
        </form>
      </section>

      <section className="card card-flush">
        <div className="card-header">
          <h3 id="puertos-lista" className="card-title" tabIndex={-1} ref={listaRef}>
            Catálogo {carga === "ok" && <span className="count">({puertos.length})</span>}
          </h3>
        </div>
        <div className="table-wrap">
          <table aria-busy={carga === "cargando" || undefined}>
            <caption className="sr-only">Puertos y aeropuertos del catálogo</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th><th scope="col">Código</th><th scope="col">País</th>
                <th scope="col" className="col-actions"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {carga === "cargando" && <LoadingRow colSpan={4} />}
              {carga === "error" && (
                <TableEmpty colSpan={4} titulo="No se pudo cargar el catálogo." detalle="Revisa el mensaje de error y recarga la página." />
              )}
              {carga === "ok" && puertos.length === 0 && (
                <TableEmpty colSpan={4} titulo="Aún no hay puertos en el catálogo." detalle="Agrega los puertos y aeropuertos que usarán los ítems." />
              )}
              {puertos.map((p) => (
                <tr key={p.id}>
                  <td><span className="empresa-nombre">{p.nombre}</span></td>
                  <td>{p.codigo ? <code className="code">{p.codigo}</code> : <span className="muted">Sin código</span>}</td>
                  <td>{p.pais ?? <span className="muted">—</span>}</td>
                  <td className="col-actions"><ConfirmButton mensaje="¿Eliminar puerto?" onConfirm={() => onDelete(p.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
