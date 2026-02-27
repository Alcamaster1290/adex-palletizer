import pandas as pd
import numpy as np

# Ruta al archivo Excel
ruta_excel = "peru_chile_2025.xlsx"

# Columnas con los nombres exactos (en el mismo orden que en el Excel)
columnas = [
    "Partida Aduanera", "Descripcion de la Partida Aduanera", "Aduana", "DUA / DAM", "Fecha",
    "Cod. Tributario", "Exportador", "Importador", "Kg Bruto", "Kg Neto",
    "Qty 1", "Und 1", "Qty 2", "Und 2", "U$ FOB Tot", "U$ FOB Und 1", "U$ FOB Und 2",
    "Pais de Destino", "Puerto de destino", "Último Puerto Embarque", "Via", "Agente Portuario",
    "Agente de Aduana", "Descripcion Comercial", "Descripcion1", "Descripcion2", "Descripcion3",
    "Descripcion4", "Descripcion5", "Naviera", "Agente Carga(Origen)", "Agente Carga(Destino)", "Canal"
]

# Leer Excel
df = pd.read_excel(ruta_excel, header=0, names=columnas, dtype=str, engine="openpyxl")


# Reemplazar valores N/A por NaN
df = df.replace(["N/A", "NA", "-", ""], np.nan)

# Conversión de tipos
df["Partida Aduanera"] = df["Partida Aduanera"].astype(str).str.strip()
df["Cod. Tributario"] = df["Cod. Tributario"].astype(str).str.strip()

# Valores numéricos (flotantes o enteros según convenga)
cols_float = ["Kg Bruto", "Kg Neto", "Qty 1", "Qty 2", "U$ FOB Tot", "U$ FOB Und 1", "U$ FOB Und 2"]
for col in cols_float:
    df[col] = pd.to_numeric(df[col], errors="coerce")

# Guardar DataFrame limpio
df.to_excel("peru_chile_2025_limpio.xlsx", index=False)

print("Archivo limpio guardado como peru_chile_2025_limpio.xlsx")
print(df.info())
print(df.head())
