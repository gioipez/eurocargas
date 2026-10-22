import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import ConfirmButton from "../../components/ConfirmButton.jsx";
import { Field, useValidacion } from "../../components/Field.jsx";
import { LoadingRow, TableEmpty } from "../../components/TableStates.jsx";
import { TIPOS_EMPRESA, tipoEmpresaLabel } from "../../labels.js";

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState([]);
  const [carga, setCarga] = useState("cargando"); // cargando | ok | error
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState(TIPOS_EMPRESA[0].value);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);
  const listaRef = useRef(null);
  const { formRef, errores, validar, onCambio, aplicarErroresServidor } = useValidacion();

  const cargar = () =>
    api.listarEmpresas()
      .then((data) => { setEmpresas(data); setCarga("ok"); })
      .catch((e) => { setError(e.message); setCarga((c) => (c === "ok" ? c : "error")); });

  useEffect(() => { cargar(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (enCurso.current) return; // evita el doble envío
    setError(null);
    setAviso(null);
    if (!validar()) return;
    enCurso.current = true;
    setGuardando(true);
    try {
      await api.crearEmpresa({ nombre, tipo });
      setAviso(`Empresa "${nombre}" agregada.`);
      setNombre("");
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
      await api.eliminarEmpresa(id);
      setAviso("Empresa eliminada.");
      listaRef.current?.focus(); // la fila (y su botón) desaparece: el foco no se pierde
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h2>Empresas proveedoras</h2>
        <p className="page-subtitle">Navieras, aerolíneas y agentes que ofrecen las tarifas.</p>
      </header>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {aviso && <div className="success-banner" role="status">{aviso}</div>}

      <section className="card">
        <h3 id="empresas-nueva" className="card-title">Nueva empresa</h3>
        <form ref={formRef} className="inline-form" onSubmit={onSubmit} onChange={onCambio} noValidate>
          <Field label="Nombre" error={errores.nombre} help="Como aparece en las ofertas del proveedor.">
            <input name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="off" />
          </Field>
          <Field label="Tipo" error={errores.tipo}>
            <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_EMPRESA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <div className="form-actions">
            <button className="primary" type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Agregar empresa"}
            </button>
          </div>
        </form>
      </section>

      <section className="card card-flush">
        <div className="card-header">
          <h3 id="empresas-lista" className="card-title" tabIndex={-1} ref={listaRef}>
            Empresas registradas {carga === "ok" && <span className="count">({empresas.length})</span>}
          </h3>
        </div>
        <div className="table-wrap">
          <table aria-busy={carga === "cargando" || undefined}>
            <caption className="sr-only">Empresas proveedoras registradas</caption>
            <thead>
              <tr><th scope="col">Nombre</th><th scope="col">Tipo</th><th scope="col" className="col-actions"><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              {carga === "cargando" && <LoadingRow colSpan={3} />}
              {carga === "error" && (
                <TableEmpty colSpan={3} titulo="No se pudo cargar el listado." detalle="Revisa el mensaje de error y recarga la página." />
              )}
              {carga === "ok" && empresas.length === 0 && (
                <TableEmpty colSpan={3} titulo="Aún no hay empresas registradas." detalle="Agrega la primera con el formulario de arriba." />
              )}
              {empresas.map((emp) => (
                <tr key={emp.id}>
                  <td><span className="empresa-nombre">{emp.nombre}</span></td>
                  <td>{tipoEmpresaLabel(emp.tipo)}</td>
                  <td className="col-actions"><ConfirmButton mensaje="Se eliminarán también sus ítems de costo." onConfirm={() => onDelete(emp.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
