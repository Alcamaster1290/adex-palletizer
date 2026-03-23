import pandas as pd
import numpy as np
import time
from io import BytesIO

def benchmark_original(df, cols_float):
    df_test = df.copy()
    start_time = time.time()
    for col in cols_float:
        if col in df_test.columns:
            df_test[col] = pd.to_numeric(df_test[col], errors="coerce")
    end_time = time.time()
    return end_time - start_time

def benchmark_optimized(df, cols_float):
    df_test = df.copy()
    start_time = time.time()
    existing_cols = [col for col in cols_float if col in df_test.columns]
    if existing_cols:
        df_test[existing_cols] = df_test[existing_cols].apply(pd.to_numeric, errors="coerce")
    end_time = time.time()
    return end_time - start_time

# Load data once
ruta_excel = "peru_chile_2025.xlsx"
columnas = [
    "Partida Aduanera", "Descripcion de la Partida Aduanera", "Aduana", "DUA / DAM", "Fecha",
    "Cod. Tributario", "Exportador", "Importador", "Kg Bruto", "Kg Neto",
    "Qty 1", "Und 1", "Qty 2", "Und 2", "U$ FOB Tot", "U$ FOB Und 1", "U$ FOB Und 2",
    "Pais de Destino", "Puerto de destino", "Último Puerto Embarque", "Via", "Agente Portuario",
    "Agente de Aduana", "Descripcion Comercial", "Descripcion1", "Descripcion2", "Descripcion3",
    "Descripcion4", "Descripcion5", "Naviera", "Agente Carga(Origen)", "Agente Carga(Destino)", "Canal"
]
df = pd.read_excel(ruta_excel, header=0, names=columnas, dtype=str, engine="openpyxl")
df = df.replace(["N/A", "NA", "-", ""], np.nan)

cols_float = ["Kg Bruto", "Kg Neto", "Qty 1", "Qty 2", "U$ FOB Tot", "U$ FOB Und 1", "U$ FOB Und 2"]

# Warm up
benchmark_original(df, cols_float)
benchmark_optimized(df, cols_float)

n_runs = 10
orig_times = [benchmark_original(df, cols_float) for _ in range(n_runs)]
opt_times = [benchmark_optimized(df, cols_float) for _ in range(n_runs)]

print(f"Original average time: {sum(orig_times)/n_runs:.4f}s")
print(f"Optimized average time: {sum(opt_times)/n_runs:.4f}s")
