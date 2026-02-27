import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
from io import BytesIO
from difflib import get_close_matches

st.set_page_config(page_title="Comercio Exterior by AlvaroCC", layout="wide")
st.title("📊 Dashboard Comercio Exterior")

# -------------------------
# Cargar y limpiar datos
# -------------------------
@st.cache_data
def limpiar_datos(file):
    columnas = [
        "Partida Aduanera", "Descripcion de la Partida Aduanera", "Aduana", "DUA / DAM", "Fecha",
        "Cod. Tributario", "Exportador", "Importador", "Kg Bruto", "Kg Neto",
        "Qty 1", "Und 1", "Qty 2", "Und 2", "U$ FOB Tot", "U$ FOB Und 1", "U$ FOB Und 2",
        "Pais de Destino", "Puerto de destino", "Último Puerto Embarque", "Via", "Agente Portuario",
        "Agente de Aduana", "Descripcion Comercial", "Descripcion1", "Descripcion2", "Descripcion3",
        "Descripcion4", "Descripcion5", "Naviera", "Agente Carga(Origen)", "Agente Carga(Destino)", "Canal"
    ]
    # Leer Excel con nombres de columnas fijos (si faltan columnas, pandas alinea por nombre)
    df = pd.read_excel(file, header=0, names=columnas, dtype=str, engine="openpyxl")
    df = df.replace(["N/A", "NA", "-", ""], np.nan)

    # Normalizaciones básicas
    df["Partida Aduanera"] = df["Partida Aduanera"].astype(str).str.strip()
    df["Cod. Tributario"] = df["Cod. Tributario"].astype(str).str.strip()

    # Columnas numéricas
    cols_float = ["Kg Bruto", "Kg Neto", "Qty 1", "Qty 2", "U$ FOB Tot", "U$ FOB Und 1", "U$ FOB Und 2"]
    for col in cols_float:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Fecha
    if "Fecha" in df.columns:
        df["Fecha"] = pd.to_datetime(df["Fecha"], errors="coerce")

    return df

uploaded_file = st.file_uploader("📂 Sube un archivo Excel", type=["xlsx"])
if uploaded_file is None:
    st.warning("Sube un archivo Excel para comenzar.")
    st.stop()

df = limpiar_datos(uploaded_file)

# -------------------------
# Sidebar - Filtros
# -------------------------
st.sidebar.header("Filtros")

def opciones(col):
    if col in df.columns:
        return sorted(df[col].dropna().unique())
    return []

aduanas_opts = opciones("Aduana")
aduanas = st.sidebar.multiselect("Aduana", options=aduanas_opts, default=aduanas_opts)

puertos_opts = opciones("Puerto de destino")
puertos = st.sidebar.multiselect("Puerto destino", options=puertos_opts, default=puertos_opts)

vias_opts = opciones("Via")
vias = st.sidebar.multiselect("Via", options=vias_opts, default=vias_opts)

fechas_validas = df["Fecha"].dropna() if "Fecha" in df.columns else pd.Series(dtype="datetime64[ns]")
if not fechas_validas.empty:
    fecha_min = fechas_validas.min().date()
    fecha_max = fechas_validas.max().date()
else:
    hoy = pd.Timestamp.today().date()
    fecha_min = hoy
    fecha_max = hoy

fecha_inicio, fecha_fin = st.sidebar.date_input(
    "Rango de Fechas",
    value=[fecha_min, fecha_max],
    min_value=fecha_min,
    max_value=fecha_max
)
fecha_inicio = pd.Timestamp(fecha_inicio)
fecha_fin = pd.Timestamp(fecha_fin)

# -------------------------
# Aplicar filtros
# -------------------------
df_filtrado = df.copy()

if aduanas:
    df_filtrado = df_filtrado[df_filtrado["Aduana"].isin(aduanas)]
if puertos:
    df_filtrado = df_filtrado[df_filtrado["Puerto de destino"].isin(puertos)]
if vias:
    df_filtrado = df_filtrado[df_filtrado["Via"].isin(vias)]

# Asegurar que trabajamos solo con filas con fecha válida
df_filtrado = df_filtrado[df_filtrado["Fecha"].notna()]
df_filtrado = df_filtrado[(df_filtrado["Fecha"] >= fecha_inicio) & (df_filtrado["Fecha"] <= fecha_fin)]

# -------------------------
# Métricas generales
# -------------------------
total_fob = df_filtrado["U$ FOB Tot"].sum(min_count=1) or 0.0
total_kg = df_filtrado["Kg Bruto"].sum(min_count=1) or 0.0
total_qty1 = df_filtrado["Qty 1"].sum(min_count=1) or 0.0

col1, col2, col3 = st.columns(3)
col1.metric("U$ FOB Total", f"{total_fob:,.2f}")
col2.metric("Peso Bruto Total (Kg)", f"{total_kg:,.2f}")
col3.metric("Cantidad Total (Und 1)", f"{total_qty1:,.0f}")

# -------------------------
# Búsqueda y selección de partidas similares
# -------------------------
st.subheader("🔍 Buscar Partidas Aduaneras Similares")

codigo_busqueda = st.text_input("Ingrese Partida Aduanera (solo números)", "")

# Botón para buscar similares y guardar en session_state
if st.button("Buscar Similares"):
    if codigo_busqueda.strip() != "":
        todas_partidas = df["Partida Aduanera"].dropna().unique().tolist()
        similares = get_close_matches(codigo_busqueda.strip(), todas_partidas, n=10, cutoff=0.5)
        st.session_state["similares"] = similares
        st.session_state["codigo_busqueda"] = codigo_busqueda.strip()
    else:
        st.warning("Ingrese un código para buscar.")

# Mostrar resultados almacenados (si existen)
similares_guardados = st.session_state.get("similares", None)
if similares_guardados:
    st.success(f"Resultados similares a {st.session_state.get('codigo_busqueda','')}:")
    partida_seleccionada = st.selectbox("Elige una partida para ver su evolución", similares_guardados, key="partida_select")
    if partida_seleccionada:
        # Filtrar por partida sobre el df_filtrado (respeta filtros)
        df_partida = df_filtrado[df_filtrado["Partida Aduanera"] == partida_seleccionada]
        if df_partida.empty:
            st.info("No hay registros para la partida seleccionada con los filtros actuales. Prueba ampliando el rango de fechas o quitando filtros.")
        else:
            st.markdown(f"**Partida seleccionada:** {partida_seleccionada} — Registros: {len(df_partida)}")
            # Mostrar tabla resumida
            with st.expander("Ver registros de la partida seleccionada"):
                st.dataframe(df_partida.reset_index(drop=True))

            # Métricas específicas
            fob_partida = df_partida["U$ FOB Tot"].sum(min_count=1) or 0.0
            kg_partida = df_partida["Kg Bruto"].sum(min_count=1) or 0.0
            qty_partida = df_partida["Qty 1"].sum(min_count=1) or 0.0

            c1, c2, c3 = st.columns(3)
            c1.metric("U$ FOB - Partida", f"{fob_partida:,.2f}")
            c2.metric("Kg Bruto - Partida", f"{kg_partida:,.2f}")
            c3.metric("Qty1 - Partida", f"{qty_partida:,.0f}")

            # Gráfico de evolución FOB por fecha (partida)
            serie_fob = df_partida.groupby("Fecha", as_index=False)["U$ FOB Tot"].sum()
            st.subheader(f"📈 Evolución del valor FOB para la partida {partida_seleccionada}")
            st.plotly_chart(px.line(serie_fob, x="Fecha", y="U$ FOB Tot", markers=True, title=f"FOB - {partida_seleccionada}"), use_container_width=True)

            # Gráfico de destinos por Kg
            peso_por_pais = df_partida.groupby("Pais de Destino", as_index=False)["Kg Bruto"].sum().sort_values("Kg Bruto", ascending=False)
            if not peso_por_pais.empty:
                st.subheader("🌍 Destinos por Peso (Kg) - Partida")
                st.plotly_chart(px.bar(peso_por_pais, x="Pais de Destino", y="Kg Bruto", title="Kg por País de Destino"), use_container_width=True)

            # Tabla agregada por Exportador/Importador
            st.subheader("🏷 Top Exportadores / Importadores (Partida)")
            top_exp = df_partida.groupby("Exportador", as_index=False).agg({"U$ FOB Tot":"sum","Kg Bruto":"sum"}).sort_values("U$ FOB Tot", ascending=False).head(10)
            top_imp = df_partida.groupby("Importador", as_index=False).agg({"U$ FOB Tot":"sum","Kg Bruto":"sum"}).sort_values("U$ FOB Tot", ascending=False).head(10)
            col_exp, col_imp = st.columns(2)
            col_exp.dataframe(top_exp.reset_index(drop=True))
            col_imp.dataframe(top_imp.reset_index(drop=True))

            # Oferta de descarga para subset de la partida
            @st.cache_data
            def convertir_excel_bytes(df_input):
                towrite = BytesIO()
                df_input.to_excel(towrite, index=False, engine="openpyxl")
                towrite.seek(0)
                return towrite.read()

            if st.button("📥 Descargar datos de la partida seleccionada"):
                excel_bytes_partida = convertir_excel_bytes(df_partida)
                st.download_button(
                    label="Descargar Excel - Partida",
                    data=excel_bytes_partida,
                    file_name=f"partida_{partida_seleccionada}_filtrada.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )

# -------------------------
# Gráficos generales (respeto filtros)
# -------------------------
st.subheader("📈 Evolución del valor FOB por Fecha (filtros aplicados)")
if not df_filtrado.empty:
    serie_fob_general = df_filtrado.groupby("Fecha", as_index=False)["U$ FOB Tot"].sum()
    st.plotly_chart(px.line(serie_fob_general, x="Fecha", y="U$ FOB Tot", markers=True, title="FOB Total por Fecha"), use_container_width=True)
else:
    st.info("No hay datos con los filtros seleccionados para mostrar gráficos generales.")

st.subheader("⚖ Peso Bruto por Aduana (filtros aplicados)")
if not df_filtrado.empty:
    peso_aduana = df_filtrado.groupby("Aduana", as_index=False)["Kg Bruto"].sum().sort_values("Kg Bruto", ascending=False)
    st.plotly_chart(px.bar(peso_aduana, x="Aduana", y="Kg Bruto", title="Peso por Aduana"), use_container_width=True)

# -------------------------
# Descargar datos filtrados generales
# -------------------------
@st.cache_data
def convertir_excel_bytes_general(df_input):
    towrite = BytesIO()
    df_input.to_excel(towrite, index=False, engine="openpyxl")
    towrite.seek(0)
    return towrite.read()

st.markdown("---")
if st.button("📥 Descargar datos filtrados (general)"):
    excel_bytes = convertir_excel_bytes_general(df_filtrado)
    st.download_button(
        label="Descargar Excel (general)",
        data=excel_bytes,
        file_name="comercio_peru_filtrado.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
