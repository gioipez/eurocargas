import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { CONCEPTOS_RECARGO, FRECUENCIAS, INCOTERMS, formatRecargos, formatTransito, frecuenciaLabel } from "../../labels.js";

const TIPOS = [
  { value: "contenedor_maritimo", label: "Contenedor marítimo (FCL)" },
  { value: "carga_aerea", label: "Carga aérea" },
  { value: "lcl", label: "LCL / Fragmento" },
];

const UNIDADES = [
  { value: "por_contenedor", label: "Tarifa plana por contenedor" },
  { value: "por_kg", label: "Por kg (peso cobrable)" },
  { value: "por_cbm_wm", label: "Por CBM / W&M" },
];

const IMPORTACION = ["importacion", "exportacion"];

const initialForm = {
  empresa_id: "",
  tipo: TIPOS[0].value,
  descripcion: "",
  origen: "",
  destino: "",
  unidad_tarifa: UNIDADES[0].value,
  costo_base: "",
  impuestos_pct: "0",
  tipo_importacion: IMPORTACION[0],
  vigencia_dias: "30",
  transito_dias: "",
  frecuencia: "",
  incoterm: "",
};

// Porcentajes del desglose; vacío = el concepto no aplica.
const initialRecargos = Object.fromEntries(CONCEPTOS_RECARGO.map((c) => [c.value, ""]));

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [puertos, setPuertos] = useState([]);
  const [recargos, setRecargos] = useState(initialRecargos);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  const cargar = () => {
    api.listarItems().then(setItems).catch((e) => setError(e.message));
    api.listarEmpresas().then(setEmpresas).catch((e) => setError(e.message));
    api.listarPuertos().then(setPuertos).catch((e) => setError(e.message));
  };

  useEffect(() => { cargar(); }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const limpiarFormulario = () => {
    setForm(initialForm);
    setRecargos(initialRecargos);
    setEditandoId(null);
  };

  // 0.07 * 100 = 7.000000000000001: se redondea para no mostrar ruido de coma flotante.
  const aPorcentaje = (fraccion) => String(Number((fraccion * 100).toFixed(4)));

  const onEditar = (it) => {
    setError(null);
    setEditandoId(it.id);
    setForm({
      empresa_id: String(it.empresa_id),
      tipo: it.tipo,
      descripcion: it.descripcion,
      origen: it.origen,
      destino: it.destino,
      unidad_tarifa: it.unidad_tarifa,
      costo_base: String(it.costo_base),
      impuestos_pct: aPorcentaje(it.impuestos_pct),
      tipo_importacion: it.tipo_importacion,
      vigencia_dias: String(it.vigencia_dias),
      // Ítems anteriores a estos campos llegan en null: quedan vacíos y obligatorios.
      transito_dias: it.transito_dias == null ? "" : String(it.transito_dias),
      frecuencia: it.frecuencia ?? "",
      incoterm: it.incoterm ?? "",
    });
    setRecargos({
      ...initialRecargos,
      ...Object.fromEntries(it.recargos.map((r) => [r.concepto, aPorcentaje(r.porcentaje)])),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const conceptosActivos = CONCEPTOS_RECARGO.filter((c) => recargos[c.value] !== "");
  const hayDesglose = conceptosActivos.length > 0;
  const totalDesglose = conceptosActivos.reduce((acc, c) => acc + Number(recargos[c.value]), 0);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        ...form,
        empresa_id: Number(form.empresa_id),
        costo_base: Number(form.costo_base),
        // Con desglose, el backend calcula impuestos_pct como la suma de los recargos.
        impuestos_pct: hayDesglose ? 0 : Number(form.impuestos_pct) / 100,
        recargos: conceptosActivos.map((c) => ({ concepto: c.value, porcentaje: Number(recargos[c.value]) / 100 })),
        vigencia_dias: Number(form.vigencia_dias),
        transito_dias: Number(form.transito_dias),
      };
      if (editandoId) await api.actualizarItem(editandoId, payload);
      else await api.crearItem(payload);
      limpiarFormulario();
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    setError(null);
    try {
      await api.eliminarItem(id);
      if (id === editandoId) limpiarFormulario();
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <h2>{editandoId ? `Editando ítem #${editandoId}` : "Ítems de costo"}</h2>
      {error && <div className="error-banner">{error}</div>}
      <form className="inline-form" onSubmit={onSubmit}>
        <label>
          Empresa
          <select value={form.empresa_id} onChange={set("empresa_id")} required>
            <option value="" disabled>Seleccionar...</option>
            {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
          </select>
        </label>
        <label>
          Tipo de ítem
          <select value={form.tipo} onChange={set("tipo")}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label>
          Descripción
          <input value={form.descripcion} onChange={set("descripcion")} placeholder="Contenedor 40' estándar" required />
        </label>
        <label>
          Origen
          <select value={form.origen} onChange={set("origen")} required>
            <option value="" disabled>Seleccionar...</option>
            {puertos.map((p) => <option key={p.id} value={p.nombre}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ""}</option>)}
          </select>
        </label>
        <label>
          Destino
          <select value={form.destino} onChange={set("destino")} required>
            <option value="" disabled>Seleccionar...</option>
            {puertos.map((p) => <option key={p.id} value={p.nombre}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ""}</option>)}
          </select>
        </label>
        <label>
          Unidad de tarifa
          <select value={form.unidad_tarifa} onChange={set("unidad_tarifa")}>
            {UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </label>
        <label>
          Costo base (USD)
          <input type="number" step="0.01" min="0.01" value={form.costo_base} onChange={set("costo_base")} required />
        </label>
        <label>
          Recargos consolidados (%)
          <input type="number" step="0.1" min="0" value={hayDesglose ? totalDesglose.toFixed(2) : form.impuestos_pct}
                 onChange={set("impuestos_pct")} disabled={hayDesglose} required />
          {hayDesglose && <span className="muted">Suma del desglose</span>}
        </label>
        <label>
          Tipo de importación
          <select value={form.tipo_importacion} onChange={set("tipo_importacion")}>
            {IMPORTACION.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Vigencia (días)
          <input type="number" min="1" value={form.vigencia_dias} onChange={set("vigencia_dias")} required />
        </label>
        <label>
          Tránsito (días)
          <input type="number" min="1" step="1" value={form.transito_dias} onChange={set("transito_dias")} required />
        </label>
        <label>
          Frecuencia de salidas
          <select value={form.frecuencia} onChange={set("frecuencia")} required>
            <option value="" disabled>Seleccionar...</option>
            {FRECUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <label>
          Incoterm cubierto
          <select value={form.incoterm} onChange={set("incoterm")} required>
            <option value="" disabled>Seleccionar...</option>
            {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
        <div className="recargos-grid">
          {CONCEPTOS_RECARGO.map((c) => (
            <label key={c.value}>
              {c.label} (%)
              <input type="number" step="0.1" min="0" value={recargos[c.value]}
                     onChange={(e) => setRecargos({ ...recargos, [c.value]: e.target.value })} placeholder="No aplica" />
            </label>
          ))}
        </div>
        <button className="primary" type="submit">{editandoId ? "Guardar cambios" : "Agregar ítem"}</button>
        {editandoId && <button className="secondary" type="button" onClick={limpiarFormulario}>Cancelar edición</button>}
      </form>

      <table>
        <thead>
          <tr>
            <th>Empresa</th><th>Tipo</th><th>Ruta</th><th>Tarifa</th><th>Recargos</th><th>Incoterm</th><th>Tránsito</th><th>Salidas</th><th>Vigencia</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className={it.id === editandoId ? "selected" : ""}>
              <td>{it.empresa.nombre}</td>
              <td>{it.descripcion}</td>
              <td>{it.origen} → {it.destino}</td>
              <td>${it.costo_base} <span className="muted">({UNIDADES.find((u) => u.value === it.unidad_tarifa)?.label})</span></td>
              <td>{formatRecargos(it)}</td>
              <td>{it.incoterm ?? <span className="muted">Sin dato</span>}</td>
              <td>{formatTransito(it.transito_dias)}</td>
              <td>{frecuenciaLabel(it.frecuencia)}</td>
              <td>{it.vigencia_dias} días</td>
              <td>
                <button className="secondary" onClick={() => onEditar(it)}>Editar</button>{" "}
                <button className="secondary" onClick={() => onDelete(it.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
