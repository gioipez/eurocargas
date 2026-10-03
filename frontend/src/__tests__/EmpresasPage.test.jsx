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
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(api.eliminarEmpresa).toHaveBeenCalledWith(1);
    expect(api.listarEmpresas).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Empresa eliminada.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("no se pudo")).toBeInTheDocument();
  });

  it("muestra el error si falla la carga inicial", async () => {
    api.listarEmpresas.mockRejectedValue(new Error("sin conexión"));
    render(<EmpresasPage />);
    expect(await screen.findByText("sin conexión")).toBeInTheDocument();
  });
});

describe("EmpresasPage — UX", () => {
  it("pide confirmación y avisa que se eliminan también los ítems; Cancelar no elimina", async () => {
    render(<EmpresasPage />);
    await screen.findByText("Maersk");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByText(/Se eliminarán también sus ítems/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(api.eliminarEmpresa).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });

  it("confirma la creación con un aviso", async () => {
    api.crearEmpresa.mockResolvedValue({});
    render(<EmpresasPage />);
    await userEvent.type(screen.getByLabelText("Nombre"), "DHL");
    await userEvent.click(screen.getByRole("button", { name: "Agregar empresa" }));
    expect(await screen.findByRole("status")).toHaveTextContent('Empresa "DHL" agregada.');
  });

  it("sin empresas muestra el estado vacío", async () => {
    api.listarEmpresas.mockResolvedValue([]);
    render(<EmpresasPage />);
    expect(await screen.findByText("Aún no hay empresas registradas.")).toBeInTheDocument();
  });

  it("los errores se anuncian con role=alert", async () => {
    api.listarEmpresas.mockRejectedValue(new Error("sin conexión"));
    render(<EmpresasPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("sin conexión");
  });
});
