import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api.js";
import EmpresasPage from "../pages/cargador/EmpresasPage.jsx";

vi.mock("../api.js");

beforeEach(() => {
  api.listarEmpresas.mockResolvedValue([{ id: 1, nombre: "Maersk", tipo: "naviera" }]);
});

describe("EmpresasPage", () => {
  it("lista las empresas", async () => {
    render(<EmpresasPage />);
    expect(await screen.findByText("Maersk")).toBeInTheDocument();
  });

  it("crea una empresa con el tipo elegido, limpia el campo y recarga", async () => {
    api.crearEmpresa.mockResolvedValue({});
    render(<EmpresasPage />);
    await screen.findByText("Maersk");
    await userEvent.type(screen.getByLabelText("Nombre"), "DHL");
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "agente");
    await userEvent.click(screen.getByRole("button", { name: "Agregar empresa" }));
    expect(api.crearEmpresa).toHaveBeenCalledWith({ nombre: "DHL", tipo: "agente" });
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
    expect(api.listarEmpresas).toHaveBeenCalledTimes(2);
  });

  it("muestra el error del backend al crear", async () => {
    api.crearEmpresa.mockRejectedValue(new Error("falló"));
    render(<EmpresasPage />);
    await userEvent.type(screen.getByLabelText("Nombre"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Agregar empresa" }));
    expect(await screen.findByText("falló")).toBeInTheDocument();
  });

  it("elimina y recarga; muestra el error si falla", async () => {
    api.eliminarEmpresa.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("no se pudo"));
    render(<EmpresasPage />);
    await screen.findByText("Maersk");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(api.eliminarEmpresa).toHaveBeenCalledWith(1);
    expect(api.listarEmpresas).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(await screen.findByText("no se pudo")).toBeInTheDocument();
  });

  it("muestra el error si falla la carga inicial", async () => {
    api.listarEmpresas.mockRejectedValue(new Error("sin conexión"));
    render(<EmpresasPage />);
    expect(await screen.findByText("sin conexión")).toBeInTheDocument();
  });
});
