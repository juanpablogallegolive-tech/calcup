# Cambios en analizador de productos (cotizar/escanear)

## 1) Estructura del proyecto revisada

- `backend/server.py`: API FastAPI y lógica principal de matching (`POST /api/match-productos`).
- `frontend/components/LectorTexto.tsx`: lector/escaner de texto que envía múltiples líneas al backend.
- `frontend/services/api.ts`: cliente HTTP con `matchProductos(nombres: string[])`.
- `frontend/services/smartSearch.ts`: búsquedas inteligentes locales para autocompletado/correcciones.

## 2) Problemas identificados en la lógica anterior

1. **Escalabilidad limitada para lotes grandes**
   - La implementación evaluaba cada texto contra casi todo el catálogo completo (comparación anidada), lo que crecía mucho con más productos.
   - Con lotes más grandes podía degradarse el rendimiento y provocar baja calidad o timeout percibido en el flujo de escaneo.

2. **Puntuación frágil en casos reales**
   - Mezclaba variaciones/sinónimos de forma que podía diluir el score final.
   - Penalizaciones y bonificaciones rígidas afectaban matches correctos cuando el texto venía con ruido OCR/escritura manual.

3. **Selección de candidatos poco eficiente**
   - No había filtrado robusto de candidatos antes del scoring detallado.
   - Se gastaba CPU en comparar productos irrelevantes.

## 3) Solución implementada

Se reescribió `match_productos` en `backend/server.py` con un enfoque más robusto y eficiente:

### A. Soporte sólido para múltiples productos

- El endpoint procesa `request.nombres` completo, sin límite práctico de 2 elementos.
- Se manejan entradas vacías por ítem sin romper el lote.

### B. Algoritmo de similitud más robusto

Se usa una combinación ponderada de:

1. **Similitud por tokens** (palabra a palabra):
   - `palabras_similares(...)`
   - Incluye Levenshtein y sinónimos/variaciones ya existentes.

2. **Similitud global de string**:
   - `similitud_levenshtein(...)`
   - `similitud_ngramas(...)` (n-gramas)

3. **Coincidencia de medidas/números**:
   - `extraer_medidas(...)` para reforzar matches en dimensiones/fracciones críticas.

Además:
- Se mantiene aprendizaje previo (`buscar_aprendizaje`) como prioridad con score 1.0.
- Se ajusta confianza (`sospechoso`) usando score absoluto y brecha frente al segundo mejor candidato.

### C. Mejora de rendimiento

- Se agregó **preprocesamiento del catálogo una sola vez por request**.
- Se creó un **índice invertido por token** (`defaultdict(set)`) para reducir drásticamente el espacio de búsqueda.
- Si no hay candidatos directos, se buscan **tokens parecidos** (fuzzy de vocabulario) para tolerar OCR/typos.
- Se limita cantidad máxima de candidatos por query (cap) con priorización por intersección de tokens.

## 4) Archivos modificados

- `backend/server.py`
  - Import nuevo: `from collections import defaultdict`
  - Reescritura completa de `POST /api/match-productos`

## 5) Verificación realizada

- Validación de sintaxis Python:
  - `python3 -m py_compile backend/server.py` ✅

## 6) Resultado esperado

Con estos cambios, el analizador en cotizar/escanear:

- Puede procesar correctamente más de dos productos por lote.
- Mejora la detección de similitudes aunque no haya coincidencia exacta.
- Mantiene mejor rendimiento sobre catálogos grandes (miles de productos).
