import { useEffect, useState } from "react";
import { api } from "../../api.js";
import ConfirmButton from "../../components/ConfirmButton.jsx";
import { CONCEPTOS_RECARGO, FRECUENCIAS, INCOTERMS, UNIDAD_CORTA, formatRecargos, formatTransito, formatUsd, frecuenciaLabel } from "../../labels.js";

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
  const [aviso, setAviso] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);

  const cargar = () => {
    api.listarItems().then(setItems).catch((e) => setError(e.message)).finally(() => setCargando(false));
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
    setAviso(null);
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
    setAviso(null);
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
      const edicion = Boolean(editandoId);
      if (edicion) await api.actualizarItem(editandoId, payload);
      else await api.crearItem(payload);
      limpiarFormulario();
      setAviso(edicion ? "Ítem actualizado." : "Ítem agregado.");
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (id) => {
    setError(null);
    setAviso(null);
    try {
      await api.eliminarItem(id);
      setAviso("Ítem eliminado.");
      if (id === editandoId) limpiarFormulario();
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const termino = busqueda.trim().toLowerCase();
  const visibles = termino
    ? items.filter((it) => [it.empresa.nombre, it.descripcion, it.origen, it.destino].some((t) => t.toLowerCase().includes(termino)))
    : items;

  return (
    <div className="card">
      <h2>{editandoId ? `Editando ítem #${editandoId}` : "Ítems de costo"}</h2>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {aviso && <div className="success-banner" role="status">{aviso}</div>}
      <form className="form-sections" onSubmit={onSubmit}>
        <fieldset>
          <legend>Servicio</legend>
          <div className="field-grid">
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
              Tipo de importación
              <select value={form.tipo_importacion} onChange={set("tipo_importacion")}>
                {IMPORTACION.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Ruta</legend>
          <div className="field-grid">
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
          </div>
        </fieldset>

        <fieldset>
          <legend>Tarifa y vigencia</legend>
          <div className="field-grid">
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
              Vigencia (días)
              <input type="number" min="1" value={form.vigencia_dias} onChange={set("vigencia_dias")} required />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Condiciones de la oferta</legend>
          <p className="hint">Permiten al comercial comparar ofertas de forma objetiva.</p>
          <div className="field-grid">
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
          </div>
        </fieldset>

        <fieldset className="ancho-completo">
          <legend>Desglose de recargos (opcional)</legend>
          <p className="hint">Porcentajes sobre el costo base. Si completas alguno, el total se calcula solo; déjalos vacíos si no aplican.</p>
          <div className="field-grid">
            {CONCEPTOS_RECARGO.map((c) => (
              <label key={c.value}>
                {c.label} (%)
                <input type="number" step="0.1" min="0" value={recargos[c.value]}
                       onChange={(e) => setRecargos({ ...recargos, [c.value]: e.target.value })} placeholder="No aplica" />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-actions">
          <button className="primary" type="submit">{editandoId ? "Guardar cambios" : "Agregar ítem"}</button>
          {editandoId && <button className="secondary" type="button" onClick={limpiarFormulario}>Cancelar edición</button>}
        </div>
      </form>

      <h3>Tarifas cargadas <span className="muted">({visibles.length}{termino ? ` de ${items.length}` : ""})</span></h3>
      <input
        type="search"
        className="search-box"
        aria-label="Buscar ítems"
        placeholder="Buscar por empresa, ruta o servicio…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empresa</th><th>Tipo</th><th>Ruta</th><th className="num">Tarifa</th><th>Recargos</th><th>Incoterm</th><th>Tránsito</th><th>Salidas</th><th>Vigencia</th><th></th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={10} className="empty-state">Cargando…</td></tr>}
            {!cargando && visibles.length === 0 && (
              <tr><td colSpan={10} className="empty-state">{items.length === 0 ? "Aún no hay ítems. Agrega el primero con el formulario." : "Ningún ítem coincide con la búsqueda."}</td></tr>
            )}
            {visibles.map((it) => (
              <tr key={it.id} className={it.id === editandoId ? "selected" : ""}>
                <td><span className="empresa-nombre">{it.empresa.nombre}</span></td>
                <td>{it.descripcion}</td>
                <td>{it.origen} → {it.destino}</td>
                <td className="num nowrap">{formatUsd(it.costo_base)} <span className="muted">{UNIDAD_CORTA[it.unidad_tarifa]}</span></td>
                <td className="muted">{formatRecargos(it)}</td>
                <td>{it.incoterm ?? <span className="muted">Sin dato</span>}</td>
                <td>{formatTransito(it.transito_dias)}</td>
                <td>{frecuenciaLabel(it.frecuencia)}</td>
                <td>{it.vigencia_dias} días</td>
                <td>
                  <div className="row-actions">
                    <button className="secondary" onClick={() => onEditar(it)}>Editar</button>
                    <ConfirmButton mensaje="¿Eliminar ítem?" onConfirm={() => onDelete(it.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
