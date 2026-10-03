import { useEffect, useState } from "react";
import { api } from "../../api.js";

const TIPOS = ["naviera", "aerolinea", "agente"];

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState([]);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [error, setError] = useState(null);

  const cargar = () => api.listarEmpresas().then(setEmpresas).catch((e) => setError(e.message));

  useEffect(() => { cargar(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.crearEmpresa({ nombre, tipo });
      setNombre("");
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    setError(null);
    try {
      await api.eliminarEmpresa(id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <h2>Empresas proveedoras</h2>
      {error && <div className="error-banner">{error}</div>}
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
      <table>
        <thead><tr><th>Nombre</th><th>Tipo</th><th></th></tr></thead>
        <tbody>
          {empresas.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.nombre}</td>
              <td>{emp.tipo}</td>
              <td><button className="secondary" onClick={() => onDelete(emp.id)}>Eliminar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
