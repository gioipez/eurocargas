import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MarginSelector from "../components/MarginSelector.jsx";

const setup = (tipo) => {
  const props = { tipoMargen: tipo, valorMargen: "10", onChangeTipo: vi.fn(), onChangeValor: vi.fn() };
  render(<MarginSelector {...props} />);
  return props;
};

describe("MarginSelector", () => {
  it("rotula el valor en % para márgenes porcentuales", () => {
    setup("porcentaje_item");
    expect(screen.getByLabelText("Valor (%)")).toHaveValue(10);
  });

  it("rotula el valor en USD para montos fijos", () => {
    setup("monto_fijo_total");
    expect(screen.getByLabelText("Valor (USD)")).toBeInTheDocument();
  });

  it("notifica el cambio de tipo y de valor", async () => {
    const props = setup("porcentaje_total");
    await userEvent.selectOptions(screen.getByLabelText("Tipo de margen"), "monto_fijo_item");
    expect(props.onChangeTipo).toHaveBeenCalledWith("monto_fijo_item");
    await userEvent.type(screen.getByLabelText(/Valor/), "5");
    expect(props.onChangeValor).toHaveBeenCalled();
  });
});
