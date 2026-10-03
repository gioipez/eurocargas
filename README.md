# Eurocargas — Cotizador de importaciones/exportaciones (POC)

POC de un wizard de cotización para una empresa de logística. Dos roles sin autenticación real:

- **Cargador**: registra empresas proveedoras (navieras, aerolíneas, agentes) y sus ítems de costo
  (contenedores FCL, carga aérea, LCL), y la tasa de cambio global.
- **Comercial**: recorre un wizard (origen → destino → tipo de mercancía → tipo de ítem →
  cantidad si aplica) para ver un cuadro comparativo de empresas, seleccionar una, aplicar un
  margen y generar un PDF de cotización con consecutivo único.

## Cómo levantar el proyecto

Requiere Docker y Docker Compose.

```bash
docker compose up --build
```

- Frontend: http://localhost:3000 (este es el puerto para exponer con ngrok)
- Backend (API, solo para depuración local): http://localhost:8000/api/health

El frontend nunca llama directamente a `localhost:8000` desde el navegador — nginx en el
contenedor de frontend hace de reverse proxy de `/api/*` hacia el backend por la red interna
de Docker. Esto es necesario para que la demo funcione detrás de ngrok: solo el puerto 3000
necesita salir a internet.

## Cómo cargar los datos semilla

La base de datos es un archivo SQLite en `backend/data/eurocargas.db` (se crea solo al
levantar el backend). Para poblarla con 5 empresas ficticias y sus ítems de ejemplo:

```bash
docker compose exec backend python -m app.seed
```

El script es idempotente: si ya hay empresas cargadas, no hace nada. Para reiniciar desde cero:

```bash
docker compose down
rm -f backend/data/eurocargas.db
docker compose up --build
docker compose exec backend python -m app.seed
```

## Notas de alcance (POC, no producción)

- Sin autenticación: el rol se elige con un botón en el frontend, no hay usuarios reales.
- Recargos (BAF/CAF/THC, etc.): son porcentajes sobre el costo base. Un ítem puede traerlos
  desglosados (`recargos`); en ese caso `impuestos_pct` se calcula como su suma y es el valor que
  usa el cálculo de costos. Los ítems antiguos conservan el porcentaje consolidado.
- Tránsito, frecuencia de salidas e Incoterm son obligatorios en ítems nuevos. Los ítems creados
  antes de estos campos quedan en "Sin dato" (no se inventan valores).
- Origen/destino se eligen de un catálogo de puertos (pestaña "Puertos"). La API rechaza (422)
  puertos fuera del catálogo y normaliza mayúsculas/espacios.
- Los ítems se pueden editar (`PUT /api/items/{id}`, reemplazo completo). `fecha_creacion` no
  cambia: la vigencia se ajusta con `vigencia_dias`. Cada cotización guarda su propio snapshot
  (empresa, descripción, ruta, Incoterm, tránsito, frecuencia), así que editar un ítem no altera
  cotizaciones ya emitidas ni su PDF.
- Las columnas nuevas de `items` y `cotizacion_items` se agregan solas al arrancar el backend (`app/migrations.py`,
  idempotente, sin Alembic). Es aditiva: no borra ni reescribe datos existentes.
- Cada cotización guarda un solo ítem seleccionado (una empresa). El modelo (`CotizacionItem`)
  ya soporta múltiples ítems por cotización para una futura extensión a "paquetes" de servicios.
- CORS abierto (`allow_origins=["*"]`) en el backend — aceptable para una demo interna, no para
  producción.
- La tarifa de contenedores (FCL) es plana por contenedor. La tarifa de LCL y de carga aérea es
  por unidad (CBM/W-M y kg respectivamente) y se multiplica por la cantidad que el comercial
  ingresa en el wizard — así es como se cotiza en la industria real.

## Tests

Backend (pytest, con cobertura):

```bash
docker compose run --rm --no-deps -v "$PWD/backend:/app" backend sh -c \
  "pip install -q -r requirements-dev.txt && python -m pytest -q --cov=app --cov-report=term-missing"
```

Frontend (Vitest + Testing Library). Con Node instalado: `cd frontend && npm install && npm test`
(`npm run test:coverage` para cobertura). Sin Node, vía Docker (el volumen evita dejar un
`node_modules` de Linux en tu carpeta):

```bash
docker run --rm -v "$PWD/frontend:/w" -v eurocargas_fe_nm:/w/node_modules -w /w node:20-slim \
  sh -c "npm install --no-audit --no-fund && npm run test:coverage"
```

Las versiones de las dependencias de test están fijadas porque el proyecto no tiene lockfile.

## Estructura

```
backend/    FastAPI + SQLAlchemy + SQLite + WeasyPrint (PDF)
frontend/   React + Vite, servido por nginx (con proxy /api -> backend)
```
