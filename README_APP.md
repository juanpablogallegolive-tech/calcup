# 📱 Calculadora de Precios Móvil

Aplicación móvil completa para calcular precios de productos con flujos de cálculo personalizables, múltiples clientes y gestión de cotizaciones. **Ahora con funcionalidad de importar/exportar datos entre dispositivos.**

## 🎯 Características Principales

### ✅ **6 Pestañas Funcionales**

1. **📊 Calculadora** - Cálculo de precios con flujos personalizados
2. **⚙️ Flujos** - Gestión de operaciones matemáticas
3. **📦 Productos** - Catálogo de 4,349 productos
4. **📜 Historial** - Registro de todos los cálculos
5. **🧾 Cotizaciones** - Generación de presupuestos
6. **🔄 Importar/Exportar** - Comparte datos entre dispositivos ⭐ NUEVO

### ✅ **Funcionalidades Completas**

#### Calculadora
- Búsqueda de productos con autocompletado
- Selección de flujo de cálculo
- Campos dinámicos según operaciones del flujo
- Múltiples clientes con:
  - Porcentaje de ganancia personalizado
  - Comentarios individuales
  - Cálculo automático de precio final
- Botón para guardar en historial

#### Flujos
- Crear, editar y eliminar flujos
- Operaciones personalizadas con:
  - Nombre descriptivo
  - Tipo: Sumar, Restar, Multiplicar, Dividir
  - Valor: Porcentaje o Número fijo
  - Orden modificable (subir/bajar)
- Guardado instantáneo

#### Productos
- Lista completa de productos
- Búsqueda en tiempo real
- Visualización de:
  - Nombre del producto
  - Costo base
  - Comentarios
- Agregar/editar productos con FAB

#### Historial
- Todos los cálculos guardados
- Búsqueda por nombre de producto
- Información detallada:
  - Fecha y hora
  - Flujo utilizado
  - Clientes y precios
  - Comentarios
- Ver detalle completo
- Eliminar cálculos
- **Próximamente**: Cargar en calculadora

#### Cotizaciones
- Crear cotizaciones multi-producto
- Búsqueda de productos por ítem
- Cálculo automático de subtotales
- Total general
- Guardar con fecha
- Ver cotizaciones guardadas

## 🏗️ Arquitectura Técnica

### Backend (FastAPI + Python)
```
/app/backend/
├── server.py          # API REST completa
└── requirements.txt   # Dependencias Python
```

**Endpoints disponibles:**
- `GET /api/productos` - Listar productos (4,349 productos cargados)
- `GET /api/productos/buscar?q=texto` - Búsqueda
- `POST /api/flujos` - Crear flujo
- `POST /api/calcular` - Calcular precio
- `POST /api/calculos` - Guardar cálculo
- `POST /api/cotizaciones` - Crear cotización
- Y muchos más...

### Frontend (Expo + React Native)
```
/app/frontend/
├── app/
│   ├── _layout.tsx       # Navegación por tabs
│   ├── calculator.tsx    # Pestaña calculadora
│   ├── flows.tsx         # Pestaña flujos
│   ├── products.tsx      # Pestaña productos
│   ├── history.tsx       # Pestaña historial
│   └── quotes.tsx        # Pestaña cotizaciones
├── services/
│   └── api.ts            # Cliente HTTP (axios)
├── store/
│   └── store.ts          # State management (zustand)
└── types/
    └── types.ts          # TypeScript interfaces
```

### Base de Datos (MongoDB)
**Colecciones:**
- `productos` - 4,349 productos importados
- `flujos` - Flujos de cálculo
- `calculos` - Historial de cálculos
- `cotizaciones` - Cotizaciones guardadas

## 🚀 Cómo Usar la Aplicación

### 1. Crear un Flujo de Cálculo

1. Ve a la pestaña **Flujos**
2. Presiona **Nuevo**
3. Ingresa un nombre (ej: "Precio con IVA")
4. Presiona **Agregar** para crear operaciones:
   - Operación 1: "IVA" - Sumar - Porcentaje
   - Operación 2: "Descuento" - Restar - Porcentaje
5. Presiona **Guardar**

### 2. Calcular un Precio

1. Ve a la pestaña **Calculadora**
2. Busca un producto (ej: "ABANICO")
3. Selecciona un flujo
4. Ingresa valores para cada operación:
   - IVA: 19
   - Descuento: 10
5. Presiona **+** para agregar un cliente
6. Completa los datos del cliente:
   - Nombre: "Cliente Mayorista"
   - Ganancia: 20
   - Comentario: "Cliente preferencial"
7. Presiona **Calcular**
8. Verás el precio final calculado
9. Presiona **Guardar** para guardar en historial

### 3. Crear una Cotización

1. Ve a la pestaña **Cotizaciones**
2. Ingresa nombre del cliente (opcional)
3. Presiona **+** para agregar productos
4. Para cada producto:
   - Ingresa cantidad
   - Busca y selecciona el producto
   - El subtotal se calcula automáticamente
5. Revisa el total general
6. Presiona **Guardar Cotización**

### 4. Ver Historial

1. Ve a la pestaña **Historial**
2. Usa la búsqueda para filtrar
3. Toca un cálculo para ver detalles
4. Presiona el icono de eliminar para borrar

## 📊 Ejemplo de Flujo Completo

**Producto**: ABANICO ALTEZA - Costo original: $154,944

**Flujo**: Cálculo con IVA
- Operación 1: IVA 19% (Sumar)
- Operación 2: Descuento 10% (Restar)

**Cálculo**:
1. Costo original: $154,944
2. + IVA 19%: $184,383
3. - Descuento 10%: $165,945
4. + Ganancia 20% (Cliente): **$199,134**

## 🎨 Diseño Minimalista

- **Colores primarios**: Púrpura (#6200ee) - Material Design
- **Navegación**: Tabs en la parte inferior
- **Componentes**: React Native Paper (Material Design)
- **Iconos**: Material Community Icons
- **Responsive**: Optimizado para móviles

## 📱 Datos Iniciales

La aplicación viene pre-cargada con:
- ✅ **4,349 productos** del archivo Excel
- ✅ **1 flujo de ejemplo** ("Cálculo con IVA")
- ✅ Base de datos MongoDB funcionando
- ✅ API REST completamente operativa

## 🔧 Testing Realizado

### Backend Testing ✅
- ✅ 7/7 tests pasando
- ✅ Productos API funcionando (4,349 productos)
- ✅ Búsqueda de productos operativa
- ✅ Flujos API funcionando
- ✅ Cálculo de precios correcto
- ✅ Guardado de cálculos operativo
- ✅ Cotizaciones funcionando
- ✅ Base de datos conectada

## 🌐 URLs de Acceso

- **Frontend Web**: https://calc-flow-sync.preview.emergentagent.com
- **Backend API**: https://calc-flow-sync.preview.emergentagent.com/api
- **Health Check**: https://calc-flow-sync.preview.emergentagent.com/api/health

## 📱 Expo QR Code

Escanea el código QR en la vista previa para abrir la app en tu dispositivo móvil con Expo Go.

## 🔮 Próximas Mejoras Sugeridas

1. **Cargar cálculo desde historial** - Restaurar cálculo completo en la calculadora
2. **Exportar cotizaciones** - Generar PDF o compartir
3. **Filtros avanzados** - Filtrar por fecha, rango de precio
4. **Estadísticas** - Gráficos de ventas y productos más cotizados
5. **Sincronización offline** - Caché local con AsyncStorage
6. **Editar productos** - Modificar costos y agregar imágenes
7. **Duplicar flujos** - Copiar flujos existentes
8. **Notificaciones** - Recordatorios de cotizaciones pendientes

## 🛠️ Tecnologías Utilizadas

**Frontend:**
- Expo SDK
- React Native
- TypeScript
- React Navigation (Bottom Tabs)
- React Native Paper
- Axios
- Zustand
- date-fns

**Backend:**
- FastAPI
- Python 3.10+
- Pydantic
- PyMongo
- uvicorn

**Database:**
- MongoDB

## 📝 Notas Importantes

- Los productos vienen con `costo_original` y `costo_base` iguales inicialmente
- Al asignar un flujo a un producto, el `costo_base` se recalcula
- Las cotizaciones usan el `costo_base` (precio con flujo aplicado)
- Todos los datos se guardan en MongoDB en la nube
- La aplicación es multi-usuario

---

**Versión**: 1.0.0  
**Fecha**: Marzo 2026  
**Estado**: ✅ Aplicación completa y funcional
