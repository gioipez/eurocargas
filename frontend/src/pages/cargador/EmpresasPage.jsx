import { useEffect, useState } from "react";
import { api } from "../../api.js";
import ConfirmButton from "../../components/ConfirmButton.jsx";

const TIPOS = ["naviera", "aerolinea", "agente"];

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState([]);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = () => api.listarEmpresas().then(setEmpresas).catch((e) => setError(e.message));

  useEffect(() => { cargar(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setAviso(null);
    try {
      await api.crearEmpresa({ nombre, tipo });
      setAviso(`Empresa "${nombre}" agregada.`);
      setNombre("");
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    setError(null);
    setAviso(null);
    try {
      await api.eliminarEmpresa(id);
      setAviso("Empresa eliminada.");
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <h2>Empresas proveedoras</h2>
      <p className="muted">Navieras, aerolíneas y agentes que ofrecen las tarifas.</p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {aviso && <div className="success-banner" role="status">{aviso}</div>}
      <form className="inline-form" onSubmit={onSubmit}>
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button className="primary" type="submit">Agregar empresa</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Tipo</th><th></th></tr></thead>
          <tbody>
            {empresas.length === 0 && <tr><td colSpan={3} className="empty-state">Aún no hay empresas registradas.</td></tr>}
            {empresas.map((emp) => (
              <tr key={emp.id}>
                <td><span className="empresa-nombre">{emp.nombre}</span></td>
                <td>{emp.tipo}</td>
                <td><ConfirmButton mensaje="Se eliminarán también sus ítems de costo." onConfirm={() => onDelete(emp.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
