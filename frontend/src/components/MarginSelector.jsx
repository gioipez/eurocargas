const TIPOS_MARGEN = [
  { value: "monto_fijo_total", label: "Monto fijo sobre el costo total (USD)" },
  { value: "monto_fijo_item", label: "Monto fijo por ítem (USD)" },
  { value: "porcentaje_total", label: "Porcentaje sobre el costo total (%)" },
  { value: "porcentaje_item", label: "Porcentaje por ítem (%)" },
];

export default function MarginSelector({ tipoMargen, valorMargen, onChangeTipo, onChangeValor }) {
  const esPorcentaje = tipoMargen.startsWith("porcentaje");

  return (
    <div className="inline-form">
      <label>
        Tipo de margen
        <select value={tipoMargen} onChange={(e) => onChangeTipo(e.target.value)}>
          {TIPOS_MARGEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label>
        Valor ({esPorcentaje ? "%" : "USD"})
        <input
          type="number"
          step="0.01"
          min="0"
          value={valorMargen}
          onChange={(e) => onChangeValor(e.target.value)}
        />
      </label>
    </div>
  );
}
