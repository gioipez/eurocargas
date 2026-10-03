import { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";
import ComparisonTable from "../../components/ComparisonTable.jsx";
import MarginSelector from "../../components/MarginSelector.jsx";

const TIPO_ITEM_LABEL = {
  contenedor_maritimo: "Contenedor marítimo (FCL)",
  carga_aerea: "Carga aérea",
  lcl: "LCL / Fragmento",
};

function unique(arr) {
  return [...new Set(arr)];
}

function calcularCostoTotal(item, cantidad) {
  const cantidadEfectiva = item.unidad_tarifa === "por_contenedor" ? 1 : cantidad;
  const base = item.costo_base * cantidadEfectiva;
  return base + base * item.impuestos_pct;
}

function vigenciaHasta(item) {
  const fecha = new Date(item.fecha_creacion);
  fecha.setDate(fecha.getDate() + item.vigencia_dias);
  return fecha.toISOString().slice(0, 10);
}

export default function WizardPage() {
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tipoImportacion, setTipoImportacion] = useState("");
  const [tipoItem, setTipoItem] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [itemSeleccionadoId, setItemSeleccionadoId] = useState(null);

  const [clienteNombre, setClienteNombre] = useState("");
  const [moneda, setMoneda] = useState("USD");
  const [tasaCambio, setTasaCambio] = useState("");
  const [tipoMargen, setTipoMargen] = useState("porcentaje_total");
  const [valorMargen, setValorMargen] = useState("10");

  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.listarItems().then(setItems).catch((e) => setError(e.message));
    api.obtenerConfig().then((c) => {
      setConfig(c);
      setTasaCambio(String(c.tasa_cambio_usd_cop));
    }).catch((e) => setError(e.message));
  }, []);

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

  const filasComparativas = useMemo(() => {
    if (!tipoItem) return [];
    const cant = Number(cantidad) || 0;
    return porImportacion
      .filter((i) => i.tipo === tipoItem)
      .map((item) => ({ item, costoTotal: calcularCostoTotal(item, cant), vigenciaHasta: vigenciaHasta(item) }));
  }, [porImportacion, tipoItem, cantidad]);

  const itemSeleccionado = filasComparativas.find((f) => f.item.id === itemSeleccionadoId)?.item ?? null;

  // Resets en cascada cuando cambia una selección previa.
  const onOrigen = (v) => { setOrigen(v); setDestino(""); setTipoImportacion(""); setTipoItem(""); setItemSeleccionadoId(null); setResultado(null); };
  const onDestino = (v) => { setDestino(v); setTipoImportacion(""); setTipoItem(""); setItemSeleccionadoId(null); setResultado(null); };
  const onTipoImportacion = (v) => { setTipoImportacion(v); setTipoItem(""); setItemSeleccionadoId(null); setResultado(null); };
  const onTipoItem = (v) => { setTipoItem(v); setItemSeleccionadoId(null); setResultado(null); };

  const onGenerar = async (e) => {
    e.preventDefault();
    setError(null);
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
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    const ci = resultado.items[0];
    const factor = resultado.moneda === "COP" ? resultado.tasa_cambio : 1;
    const simbolo = resultado.moneda === "COP" ? "COP $" : "$";
    return (
      <div className="card">
        <h2>Cotización generada</h2>
        <div className="result-box">
          <p><strong>{resultado.consecutivo}</strong> — cliente: {resultado.cliente_nombre}</p>
          <p>Precio final: <strong>{simbolo}{(ci.precio_final * factor).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></p>
          <p className="muted">Vigente hasta {resultado.vigencia_hasta.slice(0, 10)}</p>
        </div>
        <div style={{ marginTop: 16 }}>
          <a className="primary" style={{ textDecoration: "none", padding: "8px 16px", borderRadius: 4 }}
             href={api.descargarPdfUrl(resultado.id)} target="_blank" rel="noreferrer">
            Descargar PDF
          </a>
          <button className="secondary" style={{ marginLeft: 8 }} onClick={() => { setResultado(null); setItemSeleccionadoId(null); }}>
            Nueva cotización
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Wizard de cotización</h2>
      {error && <div className="error-banner">{error}</div>}

      <form className="inline-form">
        <label>
          1. Origen
          <select value={origen} onChange={(e) => onOrigen(e.target.value)}>
            <option value="" disabled>Seleccionar...</option>
            {origenes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>

        {origen && (
          <label>
            2. Destino
            <select value={destino} onChange={(e) => onDestino(e.target.value)}>
              <option value="" disabled>Seleccionar...</option>
              {destinos.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}

        {destino && (
          <label>
            3. Tipo de mercancía
            <select value={tipoImportacion} onChange={(e) => onTipoImportacion(e.target.value)}>
              <option value="" disabled>Seleccionar...</option>
              {tiposImportacion.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}

        {tipoImportacion && (
          <label>
            4. Tipo de ítem
            <select value={tipoItem} onChange={(e) => onTipoItem(e.target.value)}>
              <option value="" disabled>Seleccionar...</option>
              {tiposItem.map((t) => <option key={t} value={t}>{TIPO_ITEM_LABEL[t]}</option>)}
            </select>
          </label>
        )}

        {tipoItem && necesitaCantidad && (
          <label>
            5. {tipoItem === "carga_aerea" ? "Peso (kg)" : "Volumen (CBM) / W-M"}
            <input type="number" min="0.01" step="0.01" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </label>
        )}
      </form>

      {tipoItem && (Number(cantidad) > 0 || !necesitaCantidad) && (
        <>
          <h3>Cuadro comparativo</h3>
          <ComparisonTable filas={filasComparativas} seleccionadoId={itemSeleccionadoId} onSeleccionar={setItemSeleccionadoId} />
        </>
      )}

      {itemSeleccionado && (
        <form onSubmit={onGenerar}>
          <h3>Margen y datos de la cotización</h3>
          <div className="inline-form">
            <label>
              Cliente final
              <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} required />
            </label>
            <label>
              Moneda de la cotización
              <select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                <option value="USD">USD</option>
                <option value="COP">COP</option>
              </select>
            </label>
            {moneda === "COP" && (
              <label>
                Tasa de cambio (COP/USD)
                <input type="number" step="0.01" min="0.01" value={tasaCambio} onChange={(e) => setTasaCambio(e.target.value)} />
                <span className="muted">Global: {config?.tasa_cambio_usd_cop}</span>
              </label>
            )}
          </div>
          <MarginSelector tipoMargen={tipoMargen} valorMargen={valorMargen} onChangeTipo={setTipoMargen} onChangeValor={setValorMargen} />
          <button className="primary" type="submit" disabled={enviando} style={{ marginTop: 12 }}>
            {enviando ? "Generando..." : "Generar cotización y PDF"}
          </button>
        </form>
      )}
    </div>
  );
}
