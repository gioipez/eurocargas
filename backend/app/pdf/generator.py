from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from .. import models

TEMPLATE_DIR = Path(__file__).parent
_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))

TIPO_MARGEN_LABELS = {
    models.TipoMargen.monto_fijo_total: "Monto fijo sobre el costo total",
    models.TipoMargen.monto_fijo_item: "Monto fijo por ítem",
    models.TipoMargen.porcentaje_total: "Porcentaje sobre el costo total",
    models.TipoMargen.porcentaje_item: "Porcentaje por ítem",
}


def render_cotizacion_html(cotizacion: models.Cotizacion) -> str:
    template = _env.get_template("template.html")

    factor = cotizacion.tasa_cambio if cotizacion.moneda == models.Moneda.COP else 1.0
    simbolo = "$" if cotizacion.moneda == models.Moneda.USD else "COP $"
    total = sum(ci.precio_final for ci in cotizacion.items)

    return template.render(
        cotizacion=cotizacion,
        factor=factor,
        simbolo=simbolo,
        total=total,
        tipo_margen_label=TIPO_MARGEN_LABELS[cotizacion.tipo_margen],
    )


def render_cotizacion_pdf(cotizacion: models.Cotizacion) -> bytes:
    return HTML(string=render_cotizacion_html(cotizacion)).write_pdf()
