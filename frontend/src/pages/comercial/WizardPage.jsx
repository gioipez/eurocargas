import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api.js";
import ComparisonTable from "../../components/ComparisonTable.jsx";
import { Field, useValidacion } from "../../components/Field.jsx";
import MarginSelector from "../../components/MarginSelector.jsx";
import Stepper from "../../components/Stepper.jsx";
import {
  estadoVigencia, formatCop, formatFecha, formatMoneda, formatUsd, frecuenciaLabel, formatTransito, textoPorVencer,
  tipoImportacionLabel, tipoItemLabel, vigenciaHasta,
} from "../../labels.js";

const PASOS = [
  { id: "ruta", label: "Ruta" },
  { id: "servicio", label: "Servicio" },
  { id: "comparar", label: "Comparar" },
  { id: "margen", label: "Margen" },
  { id: "generar", label: "Generar" },
];

const MARGEN_INICIAL = { tipo: "porcentaje_total", valor: "10" };

function unique(arr) {
  return [...new Set(arr)];
}

function calcularCostoTotal(item, cantidad) {
  const cantidadEfectiva = item.unidad_tarifa === "por_contenedor" ? 1 : cantidad;
  const base = item.costo_base * cantidadEfectiva;
  return base + base * item.impuestos_pct;
}

function describirMargen(tipo, valor) {
  switch (tipo) {
    case "porcentaje_total": return `${valor}% sobre el costo total`;
    case "porcentaje_item": return `${valor}% por ítem`;
    case "monto_fijo_item": return "monto fijo por ítem";
    default: return "monto fijo sobre el costo total";
  }
}

const unidadCantidad = (tipoItem) => (tipoItem === "carga_aerea" ? "kg" : "CBM / W-M");

// Lleva el foco (y la vista) a la sección de un paso; respeta "reducir movimiento".
function irASeccion(id) {
  const destino = document.getElementById(`paso-${id}-titulo`);
  if (!destino) return;
  const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  destino.scrollIntoView?.({ behavior: reducir ? "auto" : "smooth", block: "start" });
  destino.focus({ preventScroll: true });
}

function StepSection({ id, n, titulo, descripcion, children }) {
  return (
    <section className="wizard-step" id={`paso-${id}`}>
      <div className="wizard-step-head">
        <span className="step-index" aria-hidden="true">{n}</span>
        <div>
          <h3 id={`paso-${id}-titulo`} tabIndex={-1}>{titulo}</h3>
          {descripcion && <p className="wizard-step-desc">{descripcion}</p>}
        </div>
      </div>
      <div className="wizard-step-body">{children}</div>
    </section>
  );
}

export default function WizardPage({ onDirtyChange }) {
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tipoImportacion, setTipoImportacion] = useState("");
  const [tipoItem, setTipoItem] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [itemSeleccionadoId, setItemSeleccionadoId] = useState(null);

  const [clienteNombre, setClienteNombre] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [tasaCambio, setTasaCambio] = useState("");
  const [tipoMargen, setTipoMargen] = useState(MARGEN_INICIAL.tipo);
  const [valorMargen, setValorMargen] = useState(MARGEN_INICIAL.valor);

  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);
  const enfocarInicio = useRef(false);
  const resultadoRef = useRef(null);
  const { formRef, errores, validar, onCambio, aplicarErroresServidor, limpiar } = useValidacion();

  useEffect(() => {
    api.listarItems().then(setItems).catch((e) => setError(e.message)).finally(() => setCargando(false));
    api.obtenerConfig().then((c) => {
      setConfig(c);
      setTasaCambio(String(c.tasa_cambio_usd_cop));
    }).catch((e) => setError(e.message));
  }, []);

  // Hay trabajo sin guardar si se empezó una cotización que aún no se generó.
  const sucio = !resultado && Boolean(origen || clienteNombre.trim());
  useEffect(() => { onDirtyChange?.(sucio); }, [sucio, onDirtyChange]);

  const origenes = useMemo(() => unique(items.map((i) => i.origen)).sort(), [items]);

  const porOrigen = useMemo(() => items.filter((i) => i.origen === origen), [items, origen]);
  const destinos = useMemo(() => unique(porOrigen.map((i) => i.destino)).sort(), [porOrigen]);

  const porDestino = useMemo(() => porOrigen.filter((i) => i.destino === destino), [porOrigen, destino]);
  const tiposImportacion = useMemo(() => unique(porDestino.map((i) => i.tipo_importacion)), [porDestino]);

  const porImportacion = useMemo(
    () => porDestino.filter((i) => i.tipo_importacion === tipoImportacion),
    [porDestino, tipoImportacion]
  );
  const tiposItem = useMemo(() => unique(porImportacion.map((i) => i.tipo)), [porImportacion]);

  const necesitaCantidad = tipoItem === "carga_aerea" || tipoItem === "lcl";
  const cantidadValida = !necesitaCantidad || Number(cantidad) > 0;

  const filasComparativas = useMemo(() => {
    if (!tipoItem) return [];
    const cant = Number(cantidad) || 0;
    return porImportacion
      .filter((i) => i.tipo === tipoItem)
      .map((item) => ({ item, costoTotal: calcularCostoTotal(item, cant), vigenciaHasta: vigenciaHasta(item) }));
  }, [porImportacion, tipoItem, cantidad]);

  const filaSeleccionada = filasComparativas.find((f) => f.item.id === itemSeleccionadoId) ?? null;
  const itemSeleccionado = filaSeleccionada?.item ?? null;

  // Estimación para la vista previa; el backend sigue siendo la fuente de verdad del cálculo.
  const margenNumero = Number(valorMargen) || 0;
  const margenEstimado = filaSeleccionada
    ? tipoMargen.startsWith("porcentaje") ? filaSeleccionada.costoTotal * (margenNumero / 100) : margenNumero
    : 0;
  const precioEstimado = filaSeleccionada ? filaSeleccionada.costoTotal + margenEstimado : 0;
  const tasaNumero = Number(tasaCambio) || 0;

  // Paso actual = primer paso incompleto (cada paso exige los anteriores).
  const completos = [
    Boolean(destino),
    Boolean(tipoImportacion && tipoItem && cantidadValida),
    Boolean(itemSeleccionado),
    Boolean(clienteNombre.trim() && valorMargen !== "" && margenNumero >= 0 && (moneda === "USD" || tasaNumero > 0)),
  ];
  let pasoActual = 0;
  while (pasoActual < completos.length && completos[pasoActual]) pasoActual++;

  // Resets en cascada cuando cambia una selección previa.
  const onOrigen = (v) => { setOrigen(v); setDestino(""); setTipoImportacion(""); setTipoItem(""); setItemSeleccionadoId(null); setResultado(null); };
  const onDestino = (v) => { setDestino(v); setTipoImportacion(""); setTipoItem(""); setItemSeleccionadoId(null); setResultado(null); };
  const onTipoImportacion = (v) => { setTipoImportacion(v); setTipoItem(""); setItemSeleccionadoId(null); setResultado(null); };
  const onTipoItem = (v) => { setTipoItem(v); setItemSeleccionadoId(null); setResultado(null); };

  const onGenerar = async (e) => {
    e.preventDefault();
    if (enCurso.current) return; // evita generar dos cotizaciones con un doble clic
    setError(null);
    if (!validar()) return;
    enCurso.current = true;
    setEnviando(true);
    try {
      const cot = await api.crearCotizacion({
        item_id: itemSeleccionadoId,
        cantidad: Number(cantidad) || 1,
        cliente_nombre: clienteNombre,
        moneda,
        tasa_cambio: moneda === "COP" ? Number(tasaCambio) : null,
        tipo_margen: tipoMargen,
        valor_margen: Number(valorMargen),
      });
      setResultado(cot);
    } catch (err) {
      setError(err.message);
      aplicarErroresServidor(err.campos);
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  };

  // Nueva cotización: vuelve al paso 1 con todo limpio, incluido el cliente.
  const nuevaCotizacion = () => {
    setResultado(null);
    setOrigen(""); setDestino(""); setTipoImportacion(""); setTipoItem(""); setCantidad("1"); setItemSeleccionadoId(null);
    setClienteNombre(""); setMoneda("USD"); setTasaCambio(config ? String(config.tasa_cambio_usd_cop) : "");
    setTipoMargen(MARGEN_INICIAL.tipo); setValorMargen(MARGEN_INICIAL.valor);
    setError(null);
    limpiar();
    enfocarInicio.current = true;
  };

  useEffect(() => {
    if (resultado) resultadoRef.current?.focus();
    else if (enfocarInicio.current) {
      enfocarInicio.current = false;
      document.getElementById("wizard-origen")?.focus();
    }
  }, [resultado]);

  if (resultado) {
    const ci = resultado.items[0];
    const factor = resultado.moneda === "COP" ? resultado.tasa_cambio : 1;
    return (
      <div className="page">
        <div className="card result-card">
          <div className="result-head">
            <span className="result-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <h2 tabIndex={-1} ref={resultadoRef}>Cotización generada</h2>
          </div>
          <div className="result-box" role="status">
            <p className="result-number"><strong>{resultado.consecutivo}</strong></p>
            <dl className="result-details">
              <div><dt>Cliente</dt><dd>{resultado.cliente_nombre}</dd></div>
              <div><dt>Precio final</dt><dd className="result-price">{formatMoneda(ci.precio_final * factor, resultado.moneda)}</dd></div>
            </dl>
            <p className="muted">Vigente hasta {formatFecha(resultado.vigencia_hasta)}</p>
          </div>
          <div className="wizard-actions">
            <a className="button-primary" href={api.descargarPdfUrl(resultado.id)} target="_blank" rel="noreferrer">
              Descargar PDF
            </a>
            <button type="button" className="secondary" onClick={nuevaCotizacion}>
              Nueva cotización
            </button>
          </div>
        </div>
      </div>
    );
  }

  const listo = !cargando && items.length > 0;
  const estadoSel = filaSeleccionada ? estadoVigencia(filaSeleccionada.vigenciaHasta) : null;
  const incotermsServicio = itemSeleccionado
    ? unique(filasComparativas.filter((f) => f.item.descripcion === itemSeleccionado.descripcion).map((f) => f.item.incoterm ?? "sin dato"))
    : [];

  return (
    <div className="page">
      <header className="page-header">
        <h2>Wizard de cotización</h2>
        <p className="page-subtitle">Elige la ruta y el tipo de servicio para comparar las ofertas de los proveedores.</p>
      </header>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {cargando && <p className="empty-state">Cargando tarifas…</p>}
      {!cargando && !error && items.length === 0 && (
        <p className="empty-state">Aún no hay tarifas cargadas. Pide al Cargador que registre empresas e ítems de costo.</p>
      )}

      {listo && <Stepper pasos={PASOS} actual={pasoActual} onIr={irASeccion} />}

      <form className="card wizard-form" hidden={!listo} onSubmit={(e) => e.preventDefault()}>
        <StepSection id="ruta" n={1} titulo="Ruta" descripcion="Origen y destino de la carga.">
          <div className="steps">
            <Field label={<><span className="sr-only">1. </span>Origen</>}>
              <select id="wizard-origen" value={origen} onChange={(e) => onOrigen(e.target.value)}>
                <option value="" disabled>Seleccionar…</option>
                {origenes.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>

            {origen && (
              <Field label={<><span className="sr-only">2. </span>Destino</>}>
                <select value={destino} onChange={(e) => onDestino(e.target.value)}>
                  <option value="" disabled>Seleccionar…</option>
                  {destinos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            )}
          </div>
        </StepSection>

        {destino && (
          <StepSection id="servicio" n={2} titulo="Servicio" descripcion="Solo se ofrecen las combinaciones con tarifas cargadas.">
            <div className="steps">
              <Field label={<><span className="sr-only">3. </span>Tipo de mercancía</>}>
                <select value={tipoImportacion} onChange={(e) => onTipoImportacion(e.target.value)}>
                  <option value="" disabled>Seleccionar…</option>
                  {tiposImportacion.map((t) => <option key={t} value={t}>{tipoImportacionLabel(t)}</option>)}
                </select>
              </Field>

              {tipoImportacion && (
                <Field label={<><span className="sr-only">4. </span>Tipo de ítem</>}>
                  <select value={tipoItem} onChange={(e) => onTipoItem(e.target.value)}>
                    <option value="" disabled>Seleccionar…</option>
                    {tiposItem.map((t) => <option key={t} value={t}>{tipoItemLabel(t)}</option>)}
                  </select>
                </Field>
              )}

              {tipoItem && necesitaCantidad && (
                <Field
                  label={<><span className="sr-only">5. </span>{tipoItem === "carga_aerea" ? "Peso (kg)" : "Volumen (CBM) / W-M"}</>}
                  error={cantidadValida ? null : "Ingresa una cantidad mayor que 0 para ver las ofertas."}
                  help={tipoItem === "carga_aerea" ? "Peso cobrable de la carga." : "Volumen o peso/medida cobrable."}
                >
                  <input type="number" inputMode="decimal" min="0.01" step="0.01" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                </Field>
              )}
            </div>
          </StepSection>
        )}
      </form>

      {listo && tipoItem && cantidadValida && (
        <section className="card card-flush wizard-step wizard-step-table" id="paso-comparar">
          <div className="wizard-step-head card-header">
            <span className="step-index" aria-hidden="true">3</span>
            <div>
              <h3 id="paso-comparar-titulo" tabIndex={-1}>Cuadro comparativo</h3>
              <p className="wizard-step-desc">Selecciona la oferta que vas a cotizar. Los precios se comparan dentro de cada servicio.</p>
            </div>
          </div>
          <div className="card-body-flush">
            <ComparisonTable filas={filasComparativas} seleccionadoId={itemSeleccionadoId} onSeleccionar={setItemSeleccionadoId} />
          </div>
        </section>
      )}

      {listo && itemSeleccionado && (
        <form ref={formRef} className="card wizard-form" onSubmit={onGenerar} onChange={onCambio} noValidate>
          <StepSection id="margen" n={4} titulo="Margen y datos de la cotización" descripcion="Datos del cliente y margen sobre el costo del proveedor.">
            <div className="inline-form">
              <Field label="Cliente final" error={errores.cliente_nombre} help="Aparece en el PDF que recibe el cliente.">
                <input name="cliente_nombre" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} required autoComplete="organization" />
              </Field>
              <Field label="Moneda de la cotización">
                <select name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="COP">COP</option>
                </select>
              </Field>
              {moneda === "COP" && (
                <Field label="Tasa de cambio (COP/USD)" error={errores.tasa_cambio} help={`Global: ${config?.tasa_cambio_usd_cop ?? "—"}`}>
                  <input name="tasa_cambio" type="number" inputMode="decimal" step="0.01" min="0.01" value={tasaCambio} onChange={(e) => setTasaCambio(e.target.value)} required />
                </Field>
              )}
            </div>
            <MarginSelector
              tipoMargen={tipoMargen}
              valorMargen={valorMargen}
              onChangeTipo={setTipoMargen}
              onChangeValor={setValorMargen}
              error={errores.valor_margen}
            />
            <div aria-live="polite">
              {valorMargen !== "" && margenNumero === 0 && (
                <p className="inline-warning">El margen es 0: la cotización se emitirá al costo del proveedor.</p>
              )}
            </div>
            <div className="preview" aria-live="polite">
              <span>Costo {formatUsd(filaSeleccionada.costoTotal)}</span>
              <span>+ Margen {formatUsd(margenEstimado)}</span>
              <span className="final">Precio final estimado {formatUsd(precioEstimado)}</span>
              {moneda === "COP" && tasaNumero > 0 && (
                <span className="cop">≈ {formatCop(precioEstimado * tasaNumero)}</span>
              )}
            </div>
          </StepSection>

          <StepSection id="generar" n={5} titulo="Revisar y generar" descripcion="Verifica los datos antes de emitir la cotización y su PDF.">
            <div className="summary-panel">
              {estadoSel?.estado === "vencida" && (
                <div className="warning-banner" role="alert">
                  Esta tarifa venció el {formatFecha(filaSeleccionada.vigenciaHasta)}. Confirma el precio con el proveedor antes de cotizar.
                </div>
              )}
              {itemSeleccionado.incoterm == null && (
                <div className="warning-banner">La oferta no indica Incoterm: confirma con el proveedor qué cubre el precio.</div>
              )}
              {itemSeleccionado.incoterm != null && incotermsServicio.length > 1 && (
                <div className="warning-banner">
                  Otras ofertas de este servicio cubren Incoterms distintos ({incotermsServicio.join(", ")}). Verifica que {itemSeleccionado.incoterm} es lo que necesita el cliente.
                </div>
              )}
              <dl className="summary-list">
                <div><dt>Cliente</dt><dd>{clienteNombre.trim() || <span className="muted">Sin indicar</span>}</dd></div>
                <div><dt>Ruta</dt><dd>{itemSeleccionado.origen} → {itemSeleccionado.destino}</dd></div>
                <div>
                  <dt>Servicio</dt>
                  <dd>
                    {itemSeleccionado.descripcion}
                    <span className="cell-meta">
                      {tipoItemLabel(itemSeleccionado.tipo)} · {tipoImportacionLabel(itemSeleccionado.tipo_importacion)}
                      {necesitaCantidad && ` · ${cantidad} ${unidadCantidad(tipoItem)}`}
                    </span>
                  </dd>
                </div>
                <div><dt>Proveedor</dt><dd>{itemSeleccionado.empresa.nombre}</dd></div>
                <div>
                  <dt>Incoterm</dt>
                  <dd>
                    {itemSeleccionado.incoterm ?? <span className="muted">Sin dato</span>}
                    <span className="cell-meta">Tránsito {formatTransito(itemSeleccionado.transito_dias).toLowerCase()} · Salidas {frecuenciaLabel(itemSeleccionado.frecuencia).toLowerCase()}</span>
                  </dd>
                </div>
                <div>
                  <dt>Vigencia</dt>
                  <dd>
                    Hasta {formatFecha(filaSeleccionada.vigenciaHasta)}{" "}
                    {estadoSel.estado === "vencida" && <span className="chip danger">Vencida</span>}
                    {estadoSel.estado === "por_vencer" && <span className="chip warn">{textoPorVencer(estadoSel.dias)}</span>}
                  </dd>
                </div>
                <div><dt>Costo</dt><dd className="num">{formatUsd(filaSeleccionada.costoTotal)}</dd></div>
                <div><dt>Margen</dt><dd className="num">{formatUsd(margenEstimado)} <span className="cell-meta">{describirMargen(tipoMargen, valorMargen || 0)}</span></dd></div>
                <div className="summary-total"><dt>Precio final</dt><dd className="num">{formatUsd(precioEstimado)}</dd></div>
                <div><dt>Moneda</dt><dd>{moneda === "COP" ? `COP · tasa ${tasaNumero > 0 ? tasaNumero.toLocaleString("en-US") : "—"} COP/USD` : "USD"}</dd></div>
                {moneda === "COP" && (
                  <div><dt>≈ COP</dt><dd className="num">{tasaNumero > 0 ? formatCop(precioEstimado * tasaNumero) : "—"}</dd></div>
                )}
              </dl>
              <p className="summary-note">Montos estimados; el valor final lo calcula el sistema al generar la cotización.</p>
            </div>
            <div className="wizard-actions">
              <button className="primary button-lg" type="submit" disabled={enviando}>
                {enviando ? "Generando…" : "Generar cotización y PDF"}
              </button>
            </div>
          </StepSection>
        </form>
      )}
    </div>
  );
}
