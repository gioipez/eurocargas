import { useEffect, useState } from "react";
import { api } from "../../api.js";

const initialForm = { nombre: "", codigo: "", pais: "" };

export default function PuertosPage() {
  const [puertos, setPuertos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  const cargar = () => api.listarPuertos().then(setPuertos).catch((e) => setError(e.message));

  useEffect(() => { cargar(); }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.crearPuerto({
        nombre: form.nombre,
        codigo: form.codigo.trim() ? form.codigo.trim().toUpperCase() : null,
        pais: form.pais.trim() || null,
      });
      setForm(initialForm);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    setError(null);
    try {
      await api.eliminarPuerto(id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <h2>Puertos y aeropuertos</h2>
      <p className="muted">Catálogo único de origen/destino. Los ítems solo pueden usar puertos de esta lista.</p>
      {error && <div className="error-banner">{error}</div>}
      <form className="inline-form" onSubmit={onSubmit}>
        <label>
          Nombre
          <input value={form.nombre} onChange={set("nombre")} placeholder="Cartagena" required />
        </label>
        <label>
          Código (UN/LOCODE o IATA)
          <input value={form.codigo} onChange={set("codigo")} placeholder="COCTG" maxLength={5} />
        </label>
        <label>
          País
          <input value={form.pais} onChange={set("pais")} placeholder="Colombia" />
        </label>
        <button className="primary" type="submit">Agregar puerto</button>
      </form>
      <table>
        <thead><tr><th>Nombre</th><th>Código</th><th>País</th><th></th></tr></thead>
        <tbody>
          {puertos.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td>{p.codigo ?? <span className="muted">Sin código</span>}</td>
              <td>{p.pais ?? <span className="muted">—</span>}</td>
              <td><button className="secondary" onClick={() => onDelete(p.id)}>Eliminar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
