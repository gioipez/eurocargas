import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import ConfirmButton from "../../components/ConfirmButton.jsx";
import { Field, useValidacion } from "../../components/Field.jsx";
import { LoadingRow, TableEmpty } from "../../components/TableStates.jsx";
import {
  CONCEPTOS_RECARGO, FRECUENCIAS, INCOTERMS, TIPOS_IMPORTACION, TIPOS_ITEM, UNIDAD_CORTA, estadoVigencia, formatFecha,
  formatRecargos, formatTransito, formatUsd, frecuenciaLabel, textoPorVencer, tipoImportacionLabel, tipoItemLabel, vigenciaHasta,
} from "../../labels.js";

const TIPOS = TIPOS_ITEM;

const UNIDADES = [
  { value: "por_contenedor", label: "Tarifa plana por contenedor" },
  { value: "por_kg", label: "Por kg (peso cobrable)" },
  { value: "por_cbm_wm", label: "Por CBM / W&M" },
];

const IMPORTACION = TIPOS_IMPORTACION.map((t) => t.value);

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
  const [carga, setCarga] = useState("cargando"); // cargando | ok | error
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);
  const primerCampoRef = useRef(null);
  const enfocarAlEditar = useRef(false);
  const listaRef = useRef(null);
  const { formRef, errores, validar, onCambio, aplicarErroresServidor, limpiar } = useValidacion();

  const cargar = () => {
    api.listarItems()
      .then((data) => { setItems(data); setCarga("ok"); })
      .catch((e) => { setError(e.message); setCarga((c) => (c === "ok" ? c : "error")); });
    api.listarEmpresas().then(setEmpresas).catch((e) => setError(e.message));
    api.listarPuertos().then(setPuertos).catch((e) => setError(e.message));
  };

  useEffect(() => { cargar(); }, []);

  // Al entrar en modo edición, el foco va al primer campo del formulario.
  useEffect(() => {
    if (editandoId && enfocarAlEditar.current) {
      enfocarAlEditar.current = false;
      primerCampoRef.current?.focus({ preventScroll: true });
    }
  }, [editandoId]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const limpiarFormulario = () => {
    setForm(initialForm);
    setRecargos(initialRecargos);
    setEditandoId(null);
    limpiar();
  };

  // 0.07 * 100 = 7.000000000000001: se redondea para no mostrar ruido de coma flotante.
  const aPorcentaje = (fraccion) => String(Number((fraccion * 100).toFixed(4)));

  const onEditar = (it) => {
    setError(null);
    setAviso(null);
    limpiar();
    enfocarAlEditar.current = true;
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
    if (enCurso.current) return; // evita el doble envío
    setError(null);
    setAviso(null);
    if (!validar()) return;
    enCurso.current = true;
    setGuardando(true);
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
      await api.eliminarItem(id);
      setAviso("Ítem eliminado.");
      if (id === editandoId) limpiarFormulario();
      listaRef.current?.focus();
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const termino = busqueda.trim().toLowerCase();
  const visibles = termino
    ? items.filter((it) => [it.empresa.nombre, it.descripcion, it.origen, it.destino].some((t) => t.toLowerCase().includes(termino)))
    : items;

  const sel = (field, opciones, { placeholder = true, required = true } = {}) => (
    <select name={field} value={form[field]} onChange={set(field)} required={required}>
      {placeholder && <option value="" disabled>Seleccionar…</option>}
      {opciones}
    </select>
  );
  const opcionesPuertos = puertos.map((p) => <option key={p.id} value={p.nombre}>{p.nombre}{p.codigo ? ` (${p.codigo})` : ""}</option>);

  return (
    <div className="page">
      <header className="page-header">
        <h2>{editandoId ? `Editando ítem #${editandoId}` : "Ítems de costo"}</h2>
        <p className="page-subtitle">
          {editandoId
            ? "Modifica los datos de la tarifa y guarda los cambios. Las cotizaciones ya emitidas no cambian."
            : "Tarifas de los proveedores por ruta y servicio. Son las que el comercial compara al cotizar."}
        </p>
      </header>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {aviso && <div className="success-banner" role="status">{aviso}</div>}

      <section className={`card ${editandoId ? "card-editing" : ""}`}>
        <h3 id="items-form-titulo" className="card-title">{editandoId ? "Datos del ítem" : "Nuevo ítem"}</h3>
        <form ref={formRef} className="form-sections" onSubmit={onSubmit} onChange={onCambio} noValidate>
          <fieldset>
            <legend>Servicio</legend>
            <div className="field-grid">
              <Field label="Empresa" error={errores.empresa_id}>
                <select ref={primerCampoRef} name="empresa_id" value={form.empresa_id} onChange={set("empresa_id")} required>
                  <option value="" disabled>Seleccionar…</option>
                  {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                </select>
              </Field>
              <Field label="Tipo de ítem" error={errores.tipo}>
                {sel("tipo", TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>), { placeholder: false, required: false })}
              </Field>
              <Field label="Descripción" error={errores.descripcion} help="Nombre del servicio; agrupa las ofertas comparables.">
                <input name="descripcion" value={form.descripcion} onChange={set("descripcion")} placeholder="Contenedor 40' estándar" required />
              </Field>
              <Field label="Tipo de importación" error={errores.tipo_importacion}>
                {sel("tipo_importacion", IMPORTACION.map((t) => <option key={t} value={t}>{tipoImportacionLabel(t)}</option>), { placeholder: false, required: false })}
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend>Ruta</legend>
            <div className="field-grid">
              <Field label="Origen" error={errores.origen}>{sel("origen", opcionesPuertos)}</Field>
              <Field label="Destino" error={errores.destino}>{sel("destino", opcionesPuertos)}</Field>
            </div>
            {puertos.length === 0 && carga === "ok" && (
              <p className="hint">No hay puertos en el catálogo. Agrégalos en la pestaña Puertos.</p>
            )}
          </fieldset>

          <fieldset>
            <legend>Tarifa y vigencia</legend>
            <div className="field-grid">
              <Field label="Unidad de tarifa" error={errores.unidad_tarifa}>
                {sel("unidad_tarifa", UNIDADES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>), { placeholder: false, required: false })}
              </Field>
              <Field label="Costo base (USD)" error={errores.costo_base}>
                <input name="costo_base" type="number" inputMode="decimal" step="0.01" min="0.01" value={form.costo_base} onChange={set("costo_base")} required />
              </Field>
              <Field label="Recargos consolidados (%)" error={errores.impuestos_pct} help={hayDesglose ? "Suma del desglose" : "Porcentaje total sobre el costo base."}>
                <input name="impuestos_pct" type="number" inputMode="decimal" step="0.1" min="0" value={hayDesglose ? totalDesglose.toFixed(2) : form.impuestos_pct}
                       onChange={set("impuestos_pct")} disabled={hayDesglose} required />
              </Field>
              <Field label="Vigencia (días)" error={errores.vigencia_dias} help="Días desde la fecha de registro.">
                <input name="vigencia_dias" type="number" inputMode="numeric" min="1" step="1" value={form.vigencia_dias} onChange={set("vigencia_dias")} required />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend>Condiciones de la oferta</legend>
            <p className="hint">Permiten al comercial comparar ofertas de forma objetiva.</p>
            <div className="field-grid">
              <Field label="Tránsito (días)" error={errores.transito_dias}>
                <input name="transito_dias" type="number" inputMode="numeric" min="1" step="1" value={form.transito_dias} onChange={set("transito_dias")} required />
              </Field>
              <Field label="Frecuencia de salidas" error={errores.frecuencia}>
                {sel("frecuencia", FRECUENCIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>))}
              </Field>
              <Field label="Incoterm cubierto" error={errores.incoterm}>
                {sel("incoterm", INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>))}
              </Field>
            </div>
          </fieldset>

          <fieldset className="ancho-completo">
            <legend>Desglose de recargos (opcional)</legend>
            <p className="hint">Porcentajes sobre el costo base. Si completas alguno, el total se calcula solo; déjalos vacíos si no aplican.</p>
            <div className="field-grid">
              {CONCEPTOS_RECARGO.map((c) => (
                <Field key={c.value} label={`${c.label} (%)`} error={errores[`recargo_${c.value}`]}>
                  <input name={`recargo_${c.value}`} type="number" inputMode="decimal" step="0.1" min="0" value={recargos[c.value]}
                         onChange={(e) => setRecargos({ ...recargos, [c.value]: e.target.value })} placeholder="No aplica" />
                </Field>
              ))}
            </div>
          </fieldset>

          <div className="form-actions">
            <button className="primary" type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar ítem"}
            </button>
            {editandoId && <button className="secondary" type="button" onClick={limpiarFormulario} disabled={guardando}>Cancelar edición</button>}
          </div>
        </form>
      </section>

      <section className="card card-flush">
        <div className="card-header card-header-split">
          <h3 id="items-lista" className="card-title" tabIndex={-1} ref={listaRef}>
            Tarifas cargadas <span className="count">({visibles.length}{termino ? ` de ${items.length}` : ""})</span>
          </h3>
          <input
            type="search"
            className="search-box"
            aria-label="Buscar ítems"
            placeholder="Buscar por empresa, ruta o servicio…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table aria-busy={carga === "cargando" || undefined}>
            <caption className="sr-only">Tarifas cargadas por empresa, servicio y ruta</caption>
            <thead>
              <tr>
                <th scope="col">Empresa</th><th scope="col">Servicio</th><th scope="col">Ruta</th><th scope="col" className="num">Tarifa (USD)</th>
                <th scope="col">Recargos</th><th scope="col">Incoterm</th><th scope="col">Tránsito</th><th scope="col">Salidas</th>
                <th scope="col">Vigencia</th><th scope="col" className="col-actions"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {carga === "cargando" && <LoadingRow colSpan={10} />}
              {carga === "error" && (
                <TableEmpty colSpan={10} titulo="No se pudo cargar el listado." detalle="Revisa el mensaje de error y recarga la página." />
              )}
              {carga === "ok" && visibles.length === 0 && (
                items.length === 0
                  ? <TableEmpty colSpan={10} titulo="Aún no hay ítems. Agrega el primero con el formulario." detalle="Necesitas al menos una empresa y dos puertos registrados." />
                  : <TableEmpty colSpan={10} titulo="Ningún ítem coincide con la búsqueda." detalle="Prueba con otra empresa, ruta o servicio." />
              )}
              {visibles.map((it) => {
                const hasta = vigenciaHasta(it);
                const { estado, dias } = estadoVigencia(hasta);
                return (
                  <tr key={it.id} className={it.id === editandoId ? "selected" : ""}>
                    <td><span className="empresa-nombre">{it.empresa.nombre}</span></td>
                    <td>{it.descripcion}<span className="cell-meta">{tipoItemLabel(it.tipo)} · {tipoImportacionLabel(it.tipo_importacion)}</span></td>
                    <td className="nowrap">{it.origen} → {it.destino}</td>
                    <td className="num nowrap">{formatUsd(it.costo_base)} <span className="cell-meta">{UNIDAD_CORTA[it.unidad_tarifa]}</span></td>
                    <td className="muted">{formatRecargos(it)}</td>
                    <td>{it.incoterm ?? <span className="muted">Sin dato</span>}</td>
                    <td className="nowrap">{formatTransito(it.transito_dias)}</td>
                    <td>{frecuenciaLabel(it.frecuencia)}</td>
                    <td className="nowrap">
                      Hasta {formatFecha(hasta)}
                      <span className="cell-meta">{it.vigencia_dias} días</span>
                      {estado === "vencida" && <span className="chip danger">Vencida</span>}
                      {estado === "por_vencer" && <span className="chip warn">{textoPorVencer(dias)}</span>}
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <button className="secondary" onClick={() => onEditar(it)}>Editar</button>
                        <ConfirmButton mensaje="¿Eliminar ítem?" onConfirm={() => onDelete(it.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
