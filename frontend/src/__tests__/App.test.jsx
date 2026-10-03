import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api.js";
import App from "../App.jsx";
import { puertos } from "../test/fixtures.js";

vi.mock("../api.js");

beforeEach(() => {
  api.listarEmpresas.mockResolvedValue([]);
  api.listarItems.mockResolvedValue([]);
  api.listarPuertos.mockResolvedValue(puertos);
  api.obtenerConfig.mockResolvedValue({ tasa_cambio_usd_cop: 4000 });
});

describe("App", () => {
  it("empieza en el selector de rol", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /Soy Cargador/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Soy Comercial/ })).toBeInTheDocument();
  });

  it("Comercial abre el wizard y 'Cambiar rol' vuelve al selector", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Soy Comercial/ }));
    expect(await screen.findByText("Wizard de cotización")).toBeInTheDocument();
    expect(screen.getByText(/Cotizador \(Comercial\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar rol" }));
    expect(screen.getByRole("button", { name: /Soy Cargador/ })).toBeInTheDocument();
  });

  it("Cargador navega por todas las pestañas", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Soy Cargador/ }));
    expect(await screen.findByRole("heading", { name: "Empresas proveedoras" })).toBeInTheDocument();

    const pestañas = [
      ["Puertos", "Puertos y aeropuertos"],
      ["Ítems / Tarifas", "Ítems de costo"],
      ["Configuración", "Configuración global"],
      ["Empresas", "Empresas proveedoras"],
    ];
    for (const [pestaña, titulo] of pestañas) {
      await userEvent.click(screen.getByRole("button", { name: pestaña }));
      expect(await screen.findByRole("heading", { name: titulo })).toBeInTheDocument();
    }
  });
});
