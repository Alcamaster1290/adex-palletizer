import streamlit as st
import pandas as pd
import plotly.express as px
from io import BytesIO

st.set_page_config(page_title="Comercio Perú - Chile 2025", layout="wide")
st.title("📊 Dashboard Comercio Perú - Chile 2025")

# -------------------------
# Cargar datos
# -------------------------
@st.cache_data
def cargar_datos(path="peru_chile_2025_limpio.xlsx"):
    df = pd.read_excel(path, parse_dates=["Fecha"])
    # Normalizar nombres de columnas por si hay espacios/trailing
    df.columns = df.columns.str.strip()
    return df

df = cargar_datos()

# -------------------------
# Sidebar - filtros
# -------------------------
st.sidebar.header("Filtros")

# Helper: obtener opciones seguras (si columna no existe, devolver lista vacía)
def opciones(col):
    if col in df.columns:
        return sorted(df[col].dropna().unique())
    return []

# Aduana
aduanas_opts = opciones("Aduana")
aduanas = st.sidebar.multiselect("Aduana", options=aduanas_opts, default=aduanas_opts)

# Puerto de destino
puertos_opts = opciones("Puerto de destino")
puertos = st.sidebar.multiselect("Puerto destino", options=puertos_opts, default=puertos_opts)

# Via
vias_opts = opciones("Via")
vias = st.sidebar.multiselect("Via", options=vias_opts, default=vias_opts)

# Rango de fechas (ignorando NaT)
fechas_validas = df["Fecha"].dropna() if "Fecha" in df.columns else pd.Series(dtype="datetime64[ns]")
if not fechas_validas.empty:
    fecha_min = fechas_validas.min().date()
    fecha_max = fechas_validas.max().date()
else:
    fecha_min = fecha_max = pd.Timestamp.today().date()

# Fecha por defecto iniciando en 2025-01-01 (si existe en rango)
fecha_default_inicio = pd.Timestamp("2025-01-01").date()
if fecha_default_inicio < fecha_min:
    fecha_default_inicio = fecha_min

fecha_inicio, fecha_fin = st.sidebar.date_input(
    "Rango de Fechas",
    value=[fecha_default_inicio, fecha_max],
    min_value=fecha_min,
    max_value=fecha_max
)

# Convertir a Timestamp para comparar con df['Fecha']
fecha_inicio = pd.Timestamp(fecha_inicio)
fecha_fin = pd.Timestamp(fecha_fin)

# -------------------------
# Aplicar filtros
# -------------------------
df_filtrado = df.copy()

# Filtrar Aduana
if aduanas:
    df_filtrado = df_filtrado[df_filtrado["Aduana"].isin(aduanas)]

# Filtrar Puerto destino
if puertos:
    df_filtrado = df_filtrado[df_filtrado["Puerto de destino"].isin(puertos)]

# Filtrar Via
if vias:
    df_filtrado = df_filtrado[df_filtrado["Via"].isin(vias)]

# Filtrar rango de fechas (asegurando no NaT)
df_filtrado = df_filtrado[df_filtrado["Fecha"].notna()]
df_filtrado = df_filtrado[(df_filtrado["Fecha"] >= fecha_inicio) & (df_filtrado["Fecha"] <= fecha_fin)]

# -------------------------
# Métricas principales
# -------------------------
total_fob = df_filtrado["U$ FOB Tot"].sum() if "U$ FOB Tot" in df_filtrado.columns else 0
total_kg = df_filtrado["Kg Bruto"].sum() if "Kg Bruto" in df_filtrado.columns else 0
total_qty1 = df_filtrado["Qty 1"].sum() if "Qty 1" in df_filtrado.columns else 0

col1, col2, col3 = st.columns(3)
col1.metric("U$ FOB Total", f"{total_fob:,.2f}")
col2.metric("Peso Bruto Total (Kg)", f"{total_kg:,.2f}")
col3.metric("Cantidad Total (Und 1)", f"{total_qty1:,.0f}")

# -------------------------
# Gráficos temporales / por aduana
# -------------------------
st.subheader("Evolución del valor FOB por Fecha")
if not df_filtrado.empty and "U$ FOB Tot" in df_filtrado.columns:
    serie_fob = df_filtrado.groupby("Fecha", as_index=False)["U$ FOB Tot"].sum()
    fig_fob = px.line(serie_fob, x="Fecha", y="U$ FOB Tot", title="Valor FOB por Fecha", markers=True)
    st.plotly_chart(fig_fob, use_container_width=True)
else:
    st.info("No hay datos para mostrar la evolución del FOB con los filtros aplicados.")

st.subheader("Peso Bruto por Aduana")
if not df_filtrado.empty and "Kg Bruto" in df_filtrado.columns:
    peso_aduana = df_filtrado.groupby("Aduana", as_index=False)["Kg Bruto"].sum().sort_values("Kg Bruto", ascending=False)
    fig_peso = px.bar(peso_aduana, x="Aduana", y="Kg Bruto", title="Peso Bruto Total por Aduana", text_auto=".2s")
    st.plotly_chart(fig_peso, use_container_width=True)
else:
    st.info("No hay datos para mostrar peso por aduana con los filtros aplicados.")

# -------------------------
# Top 10 Exportador / Importador por Kg Neto y U$ FOB
# -------------------------
st.subheader("Top 10 - Exportador / Importador")

# Top Exportador
if not df_filtrado.empty and "Exportador" in df_filtrado.columns:
    grp_exp = df_filtrado.groupby("Exportador").agg(
        Kg_Neto_total=pd.NamedAgg(column="Kg Neto", aggfunc="sum"),
        FOB_total=pd.NamedAgg(column="U$ FOB Tot", aggfunc="sum")
    ).fillna(0)
    top10_exp_kg = grp_exp.sort_values("Kg_Neto_total", ascending=False).head(10).reset_index()
    top10_exp_fob = grp_exp.sort_values("FOB_total", ascending=False).head(10).reset_index()

    st.markdown("**Exportador — Top 10 por Kg Neto**")
    fig_exp_kg = px.bar(top10_exp_kg, x="Kg_Neto_total", y="Exportador", orientation="h", title="Top 10 Exportador por Kg Neto")
    st.plotly_chart(fig_exp_kg, use_container_width=True)

    st.markdown("**Exportador — Top 10 por U$ FOB**")
    fig_exp_fob = px.bar(top10_exp_fob, x="FOB_total", y="Exportador", orientation="h", title="Top 10 Exportador por U$ FOB")
    st.plotly_chart(fig_exp_fob, use_container_width=True)
else:
    st.info("No hay datos de 'Exportador' para mostrar Top10.")

# Top Importador
if not df_filtrado.empty and "Importador" in df_filtrado.columns:
    grp_imp = df_filtrado.groupby("Importador").agg(
        Kg_Neto_total=pd.NamedAgg(column="Kg Neto", aggfunc="sum"),
        FOB_total=pd.NamedAgg(column="U$ FOB Tot", aggfunc="sum")
    ).fillna(0)
    top10_imp_kg = grp_imp.sort_values("Kg_Neto_total", ascending=False).head(10).reset_index()
    top10_imp_fob = grp_imp.sort_values("FOB_total", ascending=False).head(10).reset_index()

    st.markdown("**Importador — Top 10 por Kg Neto**")
    fig_imp_kg = px.bar(top10_imp_kg, x="Kg_Neto_total", y="Importador", orientation="h", title="Top 10 Importador por Kg Neto")
    st.plotly_chart(fig_imp_kg, use_container_width=True)

    st.markdown("**Importador — Top 10 por U$ FOB**")
    fig_imp_fob = px.bar(top10_imp_fob, x="FOB_total", y="Importador", orientation="h", title="Top 10 Importador por U$ FOB")
    st.plotly_chart(fig_imp_fob, use_container_width=True)
else:
    st.info("No hay datos de 'Importador' para mostrar Top10.")

# Mostrar tablas de los top10 (opcional)
with st.expander("Ver tablas Top10 (Exportador/Importador)"):
    if not df_filtrado.empty:
        if "Exportador" in df_filtrado.columns:
            st.write("Exportador - Top10 Kg Neto")
            st.dataframe(top10_exp_kg)
            st.write("Exportador - Top10 U$ FOB")
            st.dataframe(top10_exp_fob)
        if "Importador" in df_filtrado.columns:
            st.write("Importador - Top10 Kg Neto")
            st.dataframe(top10_imp_kg)
            st.write("Importador - Top10 U$ FOB")
            st.dataframe(top10_imp_fob)

# -------------------------
# Mapa de calor U$ FOB según 'Puerto de destino' por mes
# -------------------------
st.subheader("Mapa de calor: U$ FOB por Puerto de destino (por mes)")

if not df_filtrado.empty and "Puerto de destino" in df_filtrado.columns and "U$ FOB Tot" in df_filtrado.columns:
    df_heat = df_filtrado.copy()
    # Mes en formato YYYY-MM
    df_heat["Mes"] = df_heat["Fecha"].dt.to_period("M").astype(str)
    pivot = df_heat.pivot_table(index="Puerto de destino", columns="Mes", values="U$ FOB Tot", aggfunc="sum", fill_value=0)
    if pivot.shape[0] == 0 or pivot.shape[1] == 0:
        st.info("No hay suficientes datos para generar el mapa de calor con los filtros aplicados.")
    else:
        # Usar px.imshow para heatmap; asegurar orden de meses
        pivot = pivot.sort_index(axis=1)
        fig_heat = px.imshow(
            pivot.values,
            x=pivot.columns,
            y=pivot.index,
            labels=dict(x="Mes", y="Puerto de destino", color="U$ FOB Tot"),
            aspect="auto",
            title="U$ FOB por Puerto de destino (mes)"
        )
        st.plotly_chart(fig_heat, use_container_width=True)
else:
    st.info("No hay datos de 'Puerto de destino' o 'U$ FOB Tot' para generar el mapa de calor.")

# -------------------------
# Tabla de datos filtrados y descarga
# -------------------------
st.subheader("Datos Filtrados")
st.dataframe(df_filtrado)

@st.cache_data
def convertir_excel_bytes(df_input):
    towrite = BytesIO()
    df_input.to_excel(towrite, index=False, engine="openpyxl")
    towrite.seek(0)
    return towrite.read()

if st.button("📥 Descargar datos filtrados"):
    if df_filtrado.empty:
        st.warning("No hay datos para descargar con los filtros actuales.")
    else:
        excel_bytes = convertir_excel_bytes(df_filtrado)
        st.download_button(
            label="Descargar Excel",
            data=excel_bytes,
            file_name="comercio_peru_chile_filtrado.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
