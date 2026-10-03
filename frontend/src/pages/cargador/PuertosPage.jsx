import { useEffect, useState } from "react";
import { api } from "../../api.js";
import ConfirmButton from "../../components/ConfirmButton.jsx";

const initialForm = { nombre: "", codigo: "", pais: "" };

export default function PuertosPage() {
  const [puertos, setPuertos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = () => api.listarPuertos().then(setPuertos).catch((e) => setError(e.message));

  useEffect(() => { cargar(); }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setAviso(null);
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
    }
  };

  const onDelete = async (id) => {
    setError(null);
    setAviso(null);
    try {
      await api.eliminarPuerto(id);
      setAviso("Puerto eliminado.");
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <h2>Puertos y aeropuertos</h2>
      <p className="muted">Catálogo único de origen/destino. Los ítems solo pueden usar puertos de esta lista.</p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {aviso && <div className="success-banner" role="status">{aviso}</div>}
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
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Código</th><th>País</th><th></th></tr></thead>
          <tbody>
            {puertos.length === 0 && <tr><td colSpan={4} className="empty-state">Aún no hay puertos en el catálogo.</td></tr>}
            {puertos.map((p) => (
              <tr key={p.id}>
                <td><span className="empresa-nombre">{p.nombre}</span></td>
                <td>{p.codigo ?? <span className="muted">Sin código</span>}</td>
                <td>{p.pais ?? <span className="muted">—</span>}</td>
                <td><ConfirmButton mensaje="¿Eliminar puerto?" onConfirm={() => onDelete(p.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
