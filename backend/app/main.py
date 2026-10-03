from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import migrations, models
from .database import Base, engine
from .routers import config, cotizaciones, empresas, items, puertos

Base.metadata.create_all(bind=engine)
migrations.run(engine)

app = FastAPI(title="Eurocargas - Cotizador (POC)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(empresas.router)
app.include_router(puertos.router)
app.include_router(items.router)
app.include_router(config.router)
app.include_router(cotizaciones.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
