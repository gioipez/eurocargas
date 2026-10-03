import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api.js";
import ConfigPage from "../pages/cargador/ConfigPage.jsx";

vi.mock("../api.js");

beforeEach(() => {
  api.obtenerConfig.mockResolvedValue({ tasa_cambio_usd_cop: 4000 });
});

describe("ConfigPage", () => {
  it("carga la tasa actual", async () => {
    render(<ConfigPage />);
    expect(await screen.findByDisplayValue("4000")).toBeInTheDocument();
  });

  it("guarda la tasa como número y confirma", async () => {
    api.actualizarConfig.mockResolvedValue({});
    render(<ConfigPage />);
    const input = await screen.findByLabelText(/Tasa de cambio/);
    await userEvent.clear(input);
    await userEvent.type(input, "4250.5");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(api.actualizarConfig).toHaveBeenCalledWith({ tasa_cambio_usd_cop: 4250.5 });
    expect(await screen.findByText("Tasa de cambio actualizada.")).toBeInTheDocument();
  });

  it("muestra el error y no confirma si falla", async () => {
    api.actualizarConfig.mockRejectedValue(new Error("tasa inválida"));
    render(<ConfigPage />);
    await screen.findByDisplayValue("4000");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("tasa inválida")).toBeInTheDocument();
    expect(screen.queryByText("Tasa de cambio actualizada.")).not.toBeInTheDocument();
  });

  it("muestra el error si falla la carga inicial", async () => {
    api.obtenerConfig.mockRejectedValue(new Error("sin conexión"));
    render(<ConfigPage />);
    expect(await screen.findByText("sin conexión")).toBeInTheDocument();
  });
});
