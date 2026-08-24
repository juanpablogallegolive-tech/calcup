from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import os
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB - CORREGIDO: Lee DB_NAME del environment
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
DB_NAME = os.getenv("DB_NAME", "calculadora_precios")
db = client[DB_NAME]

# Colecciones
productos_col = db["productos"]
flujos_col = db["flujos"]
calculos_col = db["calculos"]
cotizaciones_col = db["cotizaciones"]
aprendizajes_col = db["aprendizajes"]  # Para aprendizaje de IA

# ==================== MODELS ====================

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        return {"type": "string"}

class Operacion(BaseModel):
    nombre: str
    tipo_operacion: str
    tipo_valor: str
    orden: int

class Flujo(BaseModel):
    nombre: str
    operaciones: List[Operacion] = []
    fecha_creacion: Optional[datetime] = None

class FlujoResponse(Flujo):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class Producto(BaseModel):
    nombre: str
    costo: float = 0           # Costo del producto
    precio_venta: float = 0    # Precio de venta al público
    cantidad: Optional[str] = ""  # Cantidad en stock
    flujo_id: Optional[str] = None
    comentarios: Optional[str] = ""
    fecha_creacion: Optional[datetime] = None

class ProductoResponse(Producto):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class Cliente(BaseModel):
    nombre: str
    porcentaje_ganancia: float
    comentario: Optional[str] = ""
    precio_final: float

class Calculo(BaseModel):
    nombre_producto: str
    producto_id: Optional[str] = None
    flujo_nombre: str
    flujo_id: Optional[str] = None
    valores_operaciones: Dict[str, float] = {}
    clientes: List[Cliente] = []
    costo_base: float
    precio_calculado: Optional[float] = None  # Precio después del flujo, antes de ganancia
    fecha: Optional[datetime] = None

class CalculoResponse(Calculo):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class ItemCotizacion(BaseModel):
    cantidad: int
    producto_id: str
    nombre_producto: str
    precio_unitario: float
    subtotal: float

class Cotizacion(BaseModel):
    nombre_cliente: Optional[str] = ""
    items: List[ItemCotizacion] = []
    total: float
    fecha: Optional[datetime] = None

class CotizacionResponse(Cotizacion):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True

class CalcularPrecioRequest(BaseModel):
    costo_base: float
    flujo_id: str
    valores_operaciones: Dict[str, float]
    clientes: List[Dict[str, Any]]

# ==================== HELPERS ====================

# Colores para búsqueda inteligente (usado en buscar_productos)
COLORES = {'blanco', 'negro', 'rojo', 'azul', 'verde', 'amarillo', 'gris', 'dorado', 'plateado', 'bronce', 'cafe', 'naranja', 'morado', 'rosa', 'transparente'}

# Sinónimos básicos para búsqueda (versión simplificada al inicio)
SINONIMOS_BASICO = {
    'torn': 'tornillo', 'tubo': 'tuberia', 'val': 'valvula', 'llav': 'llave',
    'pvc': 'plastico', 'galv': 'galvanizado', 'inox': 'inoxidable', 'alu': 'aluminio',
    'bco': 'blanco', 'ngo': 'negro', 'rjo': 'rojo', 'azl': 'azul', 'vde': 'verde',
}
SINONIMOS_INVERSO = SINONIMOS_BASICO.copy()

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

def aplicar_operacion(precio_base: float, operacion: dict, valor: float) -> float:
    tipo_op = operacion["tipo_operacion"]
    tipo_val = operacion["tipo_valor"]
    
    if tipo_val == "Porcentaje":
        if tipo_op == "Sumar":
            return precio_base + (precio_base * valor / 100)
        elif tipo_op == "Restar":
            return precio_base - (precio_base * valor / 100)
        elif tipo_op == "Multiplicar":
            return precio_base * (valor / 100)
        elif tipo_op == "Dividir":
            return precio_base / (valor / 100) if valor != 0 else precio_base
    else:
        if tipo_op == "Sumar":
            return precio_base + valor
        elif tipo_op == "Restar":
            return precio_base - valor
        elif tipo_op == "Multiplicar":
            return precio_base * valor
        elif tipo_op == "Dividir":
            return precio_base / valor if valor != 0 else precio_base
    
    return precio_base

# ==================== ENDPOINTS PRODUCTOS ====================

@app.get("/api/productos")
def get_productos(skip: int = 0, limit: int = 0):
    query = productos_col.find().skip(skip)
    if limit > 0:
        query = query.limit(limit)
    productos = list(query)
    return [serialize_doc(p) for p in productos]

@app.get("/api/productos/count")
def count_productos():
    total = productos_col.count_documents({})
    return {"total": total}

@app.get("/api/productos/buscar")
def buscar_productos(q: str, limit: int = 200):
    """Búsqueda simple de productos por nombre - regex case insensitive"""
    if not q or len(q.strip()) == 0:
        return []
    
    # Búsqueda simple con regex
    regex = {"$regex": q, "$options": "i"}
    productos = list(productos_col.find({"nombre": regex}).limit(limit))
    return [serialize_doc(p) for p in productos]

@app.get("/api/productos/{producto_id}")
def get_producto(producto_id: str):
    producto = productos_col.find_one({"_id": ObjectId(producto_id)})
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return serialize_doc(producto)

@app.post("/api/productos")
def crear_producto(producto: Producto):
    producto_dict = producto.model_dump()
    producto_dict["fecha_creacion"] = datetime.now()
    result = productos_col.insert_one(producto_dict)
    producto_dict["_id"] = str(result.inserted_id)
    return serialize_doc(producto_dict)

@app.put("/api/productos/{producto_id}")
def actualizar_producto(producto_id: str, producto: Producto):
    result = productos_col.update_one(
        {"_id": ObjectId(producto_id)},
        {"$set": producto.model_dump(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto actualizado"}

@app.delete("/api/productos/{producto_id}")
def eliminar_producto(producto_id: str):
    result = productos_col.delete_one({"_id": ObjectId(producto_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"message": "Producto eliminado"}

# ==================== ENDPOINTS FLUJOS ====================

@app.get("/api/flujos")
def get_flujos():
    flujos = list(flujos_col.find())
    return [serialize_doc(f) for f in flujos]

@app.get("/api/flujos/{flujo_id}")
def get_flujo(flujo_id: str):
    flujo = flujos_col.find_one({"_id": ObjectId(flujo_id)})
    if not flujo:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    return serialize_doc(flujo)

@app.post("/api/flujos")
def crear_flujo(flujo: Flujo):
    flujo_dict = flujo.model_dump()
    flujo_dict["fecha_creacion"] = datetime.now()
    result = flujos_col.insert_one(flujo_dict)
    flujo_dict["_id"] = str(result.inserted_id)
    return serialize_doc(flujo_dict)

@app.put("/api/flujos/{flujo_id}")
def actualizar_flujo(flujo_id: str, flujo: Flujo):
    result = flujos_col.update_one(
        {"_id": ObjectId(flujo_id)},
        {"$set": flujo.model_dump(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    return {"message": "Flujo actualizado"}

@app.delete("/api/flujos/{flujo_id}")
def eliminar_flujo(flujo_id: str):
    result = flujos_col.delete_one({"_id": ObjectId(flujo_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    return {"message": "Flujo eliminado"}

# ==================== ENDPOINTS CÁLCULOS ====================

@app.get("/api/calculos")
def get_calculos(skip: int = 0, limit: int = 50, 
                 nombre: Optional[str] = None,
                 fecha_desde: Optional[str] = None,
                 fecha_hasta: Optional[str] = None):
    query = {}
    
    if nombre:
        query["nombre_producto"] = {"$regex": nombre, "$options": "i"}
    
    if fecha_desde or fecha_hasta:
        query["fecha"] = {}
        if fecha_desde:
            query["fecha"]["$gte"] = datetime.fromisoformat(fecha_desde)
        if fecha_hasta:
            query["fecha"]["$lte"] = datetime.fromisoformat(fecha_hasta)
    
    calculos = list(calculos_col.find(query).sort("fecha", -1).skip(skip).limit(limit))
    return [serialize_doc(c) for c in calculos]

@app.get("/api/calculos/{calculo_id}")
def get_calculo(calculo_id: str):
    calculo = calculos_col.find_one({"_id": ObjectId(calculo_id)})
    if not calculo:
        raise HTTPException(status_code=404, detail="Cálculo no encontrado")
    return serialize_doc(calculo)

@app.post("/api/calculos")
def guardar_calculo(calculo: Calculo):
    calculo_dict = calculo.model_dump()
    calculo_dict["fecha"] = datetime.now()
    
    # Actualizar costo y precio_venta del producto en la base de datos
    if calculo.producto_id:
        try:
            # precio_venta = precio del primer cliente (si existe)
            precio_venta = calculo.clientes[0].precio_final if calculo.clientes else 0
            productos_col.update_one(
                {"_id": ObjectId(calculo.producto_id)},
                {"$set": {
                    "costo": calculo.costo_base,
                    "precio_venta": precio_venta
                }}
            )
        except:
            pass  # Si falla, continuar guardando el cálculo
    
    result = calculos_col.insert_one(calculo_dict)
    calculo_dict["_id"] = str(result.inserted_id)
    return serialize_doc(calculo_dict)

@app.delete("/api/calculos/{calculo_id}")
def eliminar_calculo(calculo_id: str):
    result = calculos_col.delete_one({"_id": ObjectId(calculo_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cálculo no encontrado")
    return {"message": "Cálculo eliminado"}

# ==================== ENDPOINTS COTIZACIONES ====================

@app.get("/api/cotizaciones")
def get_cotizaciones(skip: int = 0, limit: int = 50):
    cotizaciones = list(cotizaciones_col.find().sort("fecha", -1).skip(skip).limit(limit))
    return [serialize_doc(c) for c in cotizaciones]

@app.get("/api/cotizaciones/{cotizacion_id}")
def get_cotizacion(cotizacion_id: str):
    cotizacion = cotizaciones_col.find_one({"_id": ObjectId(cotizacion_id)})
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return serialize_doc(cotizacion)

@app.post("/api/cotizaciones")
def crear_cotizacion(cotizacion: Cotizacion):
    cotizacion_dict = cotizacion.model_dump()
    cotizacion_dict["fecha"] = datetime.now()
    result = cotizaciones_col.insert_one(cotizacion_dict)
    cotizacion_dict["_id"] = str(result.inserted_id)
    return serialize_doc(cotizacion_dict)

@app.put("/api/cotizaciones/{cotizacion_id}")
def actualizar_cotizacion(cotizacion_id: str, cotizacion: Cotizacion):
    result = cotizaciones_col.update_one(
        {"_id": ObjectId(cotizacion_id)},
        {"$set": cotizacion.model_dump(exclude_unset=True)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return {"message": "Cotización actualizada"}

@app.delete("/api/cotizaciones/{cotizacion_id}")
def eliminar_cotizacion(cotizacion_id: str):
    result = cotizaciones_col.delete_one({"_id": ObjectId(cotizacion_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return {"message": "Cotización eliminada"}

# ==================== ENDPOINT CALCULAR ====================

@app.post("/api/calcular")
def calcular_precio(request: CalcularPrecioRequest):
    flujo = flujos_col.find_one({"_id": ObjectId(request.flujo_id)})
    if not flujo:
        raise HTTPException(status_code=404, detail="Flujo no encontrado")
    
    precio_actual = request.costo_base
    operaciones = sorted(flujo.get("operaciones", []), key=lambda x: x["orden"])
    
    for operacion in operaciones:
        nombre_op = operacion["nombre"]
        valor = request.valores_operaciones.get(nombre_op, 0)
        precio_actual = aplicar_operacion(precio_actual, operacion, valor)
    
    resultados = []
    for cliente in request.clientes:
        precio_con_ganancia = precio_actual
        ganancia = cliente.get("porcentaje_ganancia", 0)
        
        if ganancia > 0:
            precio_con_ganancia = precio_actual + (precio_actual * ganancia / 100)
        
        resultados.append({
            "nombre": cliente["nombre"],
            "porcentaje_ganancia": ganancia,
            "comentario": cliente.get("comentario", ""),
            "precio_final": round(precio_con_ganancia, 2)
        })
    
    return {
        "costo_base": request.costo_base,
        "precio_calculado": round(precio_actual, 2),  # Precio después del flujo, antes de ganancia
        "resultados": resultados
    }

# ==================== COMPARACIÓN DE PRODUCTOS ====================

import unicodedata
import re

# ==================== DICCIONARIO DE SINÓNIMOS Y ABREVIACIONES ====================
SINONIMOS = {
    # Materiales
    'pvc': ['plastico', 'vinyl', 'vinilo'],
    'hg': ['hierro galvanizado', 'galvanizado', 'galv'],
    'galv': ['galvanizado', 'hg'],
    'inox': ['inoxidable', 'acero inoxidable', 'ss'],
    'ac': ['acero', 'steel'],
    'bro': ['bronce'],
    'cob': ['cobre', 'copper'],
    'alu': ['aluminio', 'aluminum'],
    'mad': ['madera', 'wood'],
    # Tipos de productos
    'tb': ['tubo', 'tuberia', 'pipe'],
    'tbo': ['tubo', 'tuberia'],
    'tubo': ['tuberia', 'tb', 'pipe'],
    'val': ['valvula', 'valve', 'llave'],
    'valv': ['valvula', 'valve'],
    'llav': ['llave', 'valvula', 'grifo'],
    'codo': ['cod', 'elbow', 'curva'],
    'tee': ['te', 't'],
    'red': ['reduccion', 'reductor', 'reducer'],
    'uni': ['union', 'acople', 'coupling'],
    'nip': ['niple', 'nipple'],
    'tap': ['tapon', 'plug', 'cap'],
    'abr': ['abrazadera', 'clamp'],
    'torn': ['tornillo', 'screw', 'bolt'],
    'taladro': ['perforadora', 'rotomartillo'],
    'quemado': ['negro', 'amarre', 'recocido'],
    'pega': ['pegante', 'pegamento', 'cola', 'adhesivo', 'silicona'],
    'goma': ['pegante', 'pegamento', 'cola', 'adhesivo', 'silicona'],
    'capacito': ['capacitor', 'condensador'],
    'muro': ['concreto', 'cemento', 'pared'],
    'tapizar': ['tapiceria'],
    'corruga': ['corrugado', 'corrugada'],
    'cor': ['corte'],
    'incol': ['incolma'],
    'incolma': ['incol'],
    'premium': ['premiun'],
    'premiun': ['premium'],
    'tuer': ['tuerca', 'nut'],
    'aran': ['arandela', 'washer'],
    'clav': ['clavo', 'nail'],
    'pern': ['perno', 'bolt'],
    'conec': ['conector', 'connector'],
    'mang': ['manguera', 'hose'],
    'flex': ['flexible', 'flexo', 'flexometro'],
    'flexometro': ['metro', 'cinta', 'wincha', 'flex'],
    'alambre': ['cable', 'hilo'],
    'rodachin': ['rueda', 'rodaja', 'rodachina', 'garrucha', 'ruedita'],
    'colbon': ['pegante', 'cola', 'adhesivo', 'pega'],
    'afix': ['adesivo', 'adhesivo', 'pegante'],
    'tapa oidos': ['tapon oidos', 'protector auditivo', 'tapones'],
    'oz': ['onza', 'onzas'],
    'mts': ['metros', 'm'],
    'pcs': ['und', 'unidades', 'pz', 'piezas'],
    'rig': ['rigido', 'rigid'],
    # Medidas escritas
    'media': ['1/2', '0.5'],
    'cuarto': ['1/4', '0.25'],
    'tres octavos': ['3/8'],
    'tres cuartos': ['3/4', '0.75'],
    'pulgada': ['1', '"', 'inch'],
    'pulg': ['pulgada', '"'],
    # Colores
    'bco': ['blanco', 'white'],
    'ngo': ['negro', 'black'],
    'gris': ['grey', 'gray'],
    'rjo': ['rojo', 'red'],
    'azl': ['azul', 'blue'],
    'vde': ['verde', 'green'],
    'ama': ['amarillo', 'yellow'],
    'dorado': ['oro', 'dorada', 'gold'],
    'oro': ['dorado', 'dorada', 'gold'],
    'plateado': ['plata', 'plateada', 'silver'],
    'plata': ['plateado', 'plateada', 'silver'],
    'bronce': ['cafe', 'café', 'bronze'],
}

# Crear diccionario inverso para búsqueda rápida
SINONIMOS_INVERSO = {}
for palabra, sinonimos in SINONIMOS.items():
    SINONIMOS_INVERSO[palabra] = palabra
    for sin in sinonimos:
        SINONIMOS_INVERSO[sin.split()[0]] = palabra  # Solo primera palabra

def normalizar_medidas(texto: str) -> str:
    """Normaliza medidas escritas y formatos alternativos a fracciones estándar"""
    # Rescatar símbolo de pulgada antes de que se limpie por regex
    texto = texto.replace('"', ' pulgada ')
    texto = texto.replace("''", ' pulgada ')
    
    # Fracciones separadas por espacio o guion (ej. 1 4 -> 1/4)
    texto = re.sub(r'\b(\d+)[\s\-_]+(2|3|4|8|16|32|64)\b', r'\1/\2', texto)
    
    # "1 y 1/2" -> "1 1/2"
    texto = re.sub(r'\b(\d+)\s+y\s+(\d+/\d+)\b', r'\1 \2', texto)
    
    reemplazos = {
        r'\bun tercio\b': '1/3', r'\b1 tercio\b': '1/3', r'\btercio\b': '1/3',
        r'\bdos tercios\b': '2/3', r'\b2 tercios\b': '2/3',
        r'\bun cuarto\b': '1/4', r'\b1 cuarto\b': '1/4', r'\bcuarto\b': '1/4',
        r'\btres cuartos\b': '3/4', r'\b3 cuartos\b': '3/4',
        r'\bun medio\b': '1/2', r'\b1 medio\b': '1/2', r'\bmedio\b': '1/2', r'\bmedia\b': '1/2', r'\bmitad\b': '1/2',
        r'\bun octavo\b': '1/8', r'\b1 octavo\b': '1/8', r'\boctavo\b': '1/8',
        r'\btres octavos\b': '3/8', r'\b3 octavos\b': '3/8',
        r'\bcinco octavos\b': '5/8', r'\b5 octavos\b': '5/8',
        r'\bsiete octavos\b': '7/8', r'\b7 octavos\b': '7/8',
        r'\bun dieciseisavo\b': '1/16', r'\b1 dieciseisavo\b': '1/16', r'\bdieciseisavo\b': '1/16',
        r'\btres dieciseisavos\b': '3/16', r'\b3 dieciseisavos\b': '3/16',
        r'\bcinco dieciseisavos\b': '5/16', r'\b5 dieciseisavos\b': '5/16',
        r'\bsiete dieciseisavos\b': '7/16', r'\b7 dieciseisavos\b': '7/16',
        r'\bnueve dieciseisavos\b': '9/16', r'\b9 dieciseisavos\b': '9/16',
        r'\bonce dieciseisavos\b': '11/16', r'\b11 dieciseisavos\b': '11/16',
        r'\btrece dieciseisavos\b': '13/16', r'\b13 dieciseisavos\b': '13/16',
        r'\bquince dieciseisavos\b': '15/16', r'\b15 dieciseisavos\b': '15/16',
        r'\bun treinta y dosavo\b': '1/32', r'\b1 treinta y dosavo\b': '1/32', r'\btreinta y dosavo\b': '1/32',
        r'\b0\.125\b': '1/8', r'\b0\.25\b': '1/4', r'\b0\.375\b': '3/8', r'\b0\.50?\b': '1/2',
        r'\b0\.625\b': '5/8', r'\b0\.75\b': '3/4', r'\b0\.875\b': '7/8'
    }
    
    for patron, reemplazo in reemplazos.items():
        texto = re.sub(patron, reemplazo, texto)
        
    return texto

def normalizar_texto(texto: str) -> str:
    """Normaliza texto: quita acentos, minúsculas, limpia caracteres especiales"""
    if not texto:
        return ""
    texto = unicodedata.normalize('NFD', texto)
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    texto = texto.lower().strip()
    
    texto = normalizar_medidas(texto)
    
    texto = re.sub(r'[^a-z0-9\s/x\-\.]', ' ', texto)
    texto = re.sub(r'\s+', ' ', texto)
    return texto.strip()

def expandir_sinonimos(texto: str) -> str:
    """Expande abreviaciones y normaliza sinónimos a términos estándar"""
    palabras = texto.split()
    expandidas = []
    for p in palabras:
        if p in SINONIMOS_INVERSO:
            expandidas.append(SINONIMOS_INVERSO[p])
        else:
            expandidas.append(p)
    return ' '.join(expandidas)

def generar_ngramas(texto: str, n: int = 2) -> set:
    """Genera n-gramas de un texto para fuzzy matching"""
    texto = texto.replace(' ', '')
    if len(texto) < n:
        return {texto}
    return {texto[i:i+n] for i in range(len(texto) - n + 1)}

def similitud_ngramas(s1: str, s2: str, n: int = 2) -> float:
    """Calcula similitud usando n-gramas (más tolerante a errores)"""
    ng1 = generar_ngramas(s1, n)
    ng2 = generar_ngramas(s2, n)
    if not ng1 or not ng2:
        return 0.0
    interseccion = len(ng1 & ng2)
    union = len(ng1 | ng2)
    return interseccion / union if union > 0 else 0.0

def extraer_medidas(texto: str) -> set:
    """Extrae medidas del texto (1/4, 3/8, M8, 10mm, etc.)"""
    medidas = set()
    texto_lower = texto.lower()
    # Fracciones: 1/4, 3/8, 1/2, etc.
    fracciones = re.findall(r'\d+/\d+', texto)
    medidas.update(fracciones)
    # Convertir palabras a fracciones
    if 'media' in texto_lower or 'medio' in texto_lower:
        medidas.add('1/2')
    if 'cuarto' in texto_lower:
        medidas.add('1/4')
    if 'tres cuartos' in texto_lower:
        medidas.add('3/4')
    if 'tres octavos' in texto_lower:
        medidas.add('3/8')
    # Métricas: M8, M10, etc.
    metricas = re.findall(r'm\d+', texto_lower)
    medidas.update(metricas)
    # Milímetros: 10mm, 25mm
    mm = re.findall(r'\d+\s*mm', texto_lower)
    medidas.update([m.replace(' ', '') for m in mm])
    # Pulgadas: 2", 1", 2 pulgadas
    pulgadas = re.findall(r'\d+["\']', texto)
    medidas.update(pulgadas)
    pulgadas_texto = re.findall(r'(\d+)\s*pulg', texto_lower)
    medidas.update(pulgadas_texto)
    # Números solos que pueden ser medidas
    numeros = re.findall(r'\b\d+\b', texto)
    medidas.update(numeros)
    return medidas

def extraer_palabras_clave(texto: str) -> set:
    """Extrae palabras clave importantes del texto"""
    texto_norm = normalizar_texto(texto)
    texto_expandido = expandir_sinonimos(texto_norm)
    palabras = set(texto_expandido.split())
    stopwords = {'de', 'la', 'el', 'en', 'con', 'para', 'por', 'un', 'una', 'los', 'las', 'y', 'o', 'a', 'x'}
    palabras = {p for p in palabras if len(p) > 1 and p not in stopwords}
    return palabras

def levenshtein_distance(s1: str, s2: str) -> int:
    """Calcula la distancia de Levenshtein entre dos strings"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]

def similitud_levenshtein(s1: str, s2: str) -> float:
    """Calcula similitud basada en Levenshtein (0-1)"""
    if not s1 or not s2:
        return 0.0
    dist = levenshtein_distance(s1, s2)
    max_len = max(len(s1), len(s2))
    return 1 - (dist / max_len)

def buscar_palabra_en_texto(palabra: str, texto: str) -> float:
    """Busca una palabra en el texto, retorna mejor score de similitud"""
    if palabra in texto:
        return 1.0
    
    palabras_texto = texto.split()
    mejor_score = 0
    
    for p in palabras_texto:
        # Similitud exacta de substring
        if palabra in p or p in palabra:
            score = min(len(palabra), len(p)) / max(len(palabra), len(p))
            mejor_score = max(mejor_score, score * 0.95)
        
        # Similitud Levenshtein para errores de escritura (uduke/uduque, etc)
        if len(palabra) > 2 and len(p) > 2:
            lev_score = similitud_levenshtein(palabra, p)
            if lev_score > 0.65:  # Más tolerante
                mejor_score = max(mejor_score, lev_score * 0.9)
    
    return mejor_score

# MARCAS - MUY IMPORTANTES (deben coincidir)
MARCAS = {
    'total', 'uduke', 'uduque', 'udukwe', 'dewalt', 'bosch', 'makita', 'stanley', 
    'truper', 'discoveri', 'discovery', 'vharbor', 'induma', 'pretul', 'surtek',
    'black', 'decker', 'milwaukee', 'ridgid', 'craftsman', 'hilti', 'metabo'
}

# Palabras importantes (tipos de productos)
PALABRAS_IMPORTANTES = {
    # Herramientas eléctricas
    'pulidora', 'lijadora', 'sierra', 'taladro', 'atornillador', 'esmeril',
    'amoladora', 'cortadora', 'fresadora', 'cepilladora', 'router', 'dremel', 'minipulidora',
    # Herramientas manuales  
    'martillo', 'destornillador', 'llave', 'alicate', 'pinza', 'tenaza', 'tijera', 'serrucho', 'escuadra', 'nivel', 'flexometro',
    # Tipos específicos
    'orbital', 'inalambrica', 'inalambrico', 'electrica', 'electrico', 'telescopica', 'impacto', 'expansion',
    # Productos varios
    'aerosol', 'pistola', 'fumigadora', 'compresor', 'soldador', 'tornillo', 'clavo', 'perno', 'tuerca', 'lamina',
    # Medidas y unidades
    'pulgadas', 'pulgada', 'pul', 'mm', 'kg', 'litros', 'litro'
}

# Colores y características distintivas
PALABRAS_DISTINTIVAS = {
    'negro', 'blanco', 'rojo', 'azul', 'verde', 'amarillo', 'gris', 'cromado', 'dorado', 'plateado',
    'brillante', 'mate', 'grande', 'pequeño', 'mediano', 'grueso', 'delgado', 'pequeña', 'gruesa', 'delgada',
    'industrial', 'profesional', 'manual', 'encauchetada', 'encauchetado', 'plana', 'plano'
}

# Unidades y medidas numéricas que son críticas
UNIDADES_CRITICAS = {'w', 'v', 'mm', 'kg', 'pul', 'pulgadas', 'pulgada', 'litros', 'nm'}

# Variaciones comunes de marcas/palabras
VARIACIONES_MARCA = {
    'uduke': ['uduque', 'udukwe', 'uduqe'],
    'uduque': ['uduke', 'udukwe'],
    'total': ['totals'],
    'discoveri': ['discovery', 'discoberi'],
    'pulgadas': ['pul', 'pulgada', 'pulg'],
    'pulgada': ['pul', 'pulgadas', 'pulg'],
    'pul': ['pulgadas', 'pulgada'],
    'electrica': ['eletrica', 'electrico', 'eletrico'],
    'inalambrica': ['inalambrico', 'inalamb'],
    'caladora': ['caladorea'],
    'expansion': ['espancion', 'expansión'],
    # Fracciones importantes
    '3/8': ['3 octavos', 'tres octavos', '3octavos'],
    '1/4': ['1 cuarto', 'un cuarto', 'cuarto', '1cuarto'],
    '1/2': ['media', 'medio', '1 media'],
    '3/4': ['3 cuartos', 'tres cuartos', '3cuartos'],
    '1/8': ['1 octavo', 'un octavo', 'octavo'],
    # Tipos de cabeza
    'plana': ['av', 'avellanado', 'avellanada', 'plano'],
    'cabeza': ['cab', 'c'],
    'ph': ['phillips', 'philips'],
}

# Convertir fracciones a palabras para búsqueda
def expandir_fracciones(texto: str) -> str:
    """Expande fracciones numéricas a palabras"""
    texto = texto.replace('3/8', ' 3 octavos ')
    texto = texto.replace('1/4', ' 1 cuarto ')
    texto = texto.replace('1/2', ' media ')
    texto = texto.replace('3/4', ' 3 cuartos ')
    texto = texto.replace('1/8', ' 1 octavo ')
    texto = texto.replace('5/8', ' 5 octavos ')
    texto = texto.replace('7/8', ' 7 octavos ')
    return texto

def normalizar_marca(palabra: str) -> str:
    """Normaliza variaciones de marcas a una forma estándar"""
    for estandar, variaciones in VARIACIONES_MARCA.items():
        if palabra == estandar or palabra in variaciones:
            return estandar
    return palabra

# Sinónimos aprendidos dinámicamente a partir de las correcciones del usuario
SINONIMOS_DINAMICOS = {}

def extraer_sinonimos_dinamicos():
    """
    Analiza todos los aprendizajes/correcciones del usuario guardados en la base de datos
    y extrae sinónimos a nivel de palabra utilizando alineación de prefijos, similitud fuzzy,
    y aprendizaje estadístico de co-ocurrencias para múltiples términos no coincidentes.
    """
    global SINONIMOS_DINAMICOS, SINONIMOS_INVERSO
    mapa = {}
    cooc_counts = {}  # (aw, cw) -> count
    aw_counts = {}    # aw -> count
    
    try:
        # Cargar todos los aprendizajes guardados en MongoDB
        aprendizajes = list(aprendizajes_col.find({}))
        
        for apr in aprendizajes:
            corr_norm = normalizar_texto(apr.get("nombre_producto", ""))
            corr_words = [w for w in corr_norm.split() if len(w) > 1]
            
            # Revisar cada alias ingresado por el usuario
            for alias in apr.get("aliases_normalizados", []):
                alias_words = [w for w in alias.split() if len(w) > 1]
                
                # Ignorar conectores comunes
                stopwords = {'de', 'la', 'el', 'en', 'con', 'para', 'por', 'un', 'una', 'los', 'las', 'y', 'o', 'a', 'x'}
                corr_words_clean = [w for w in corr_words if w not in stopwords]
                alias_words_clean = [w for w in alias_words if w not in stopwords]
                
                # Identificar palabras que coinciden exactamente o son casi idénticas (>0.85 Levenshtein)
                unmatched_alias = []
                unmatched_corr = list(corr_words_clean)
                
                for aw in alias_words_clean:
                    match_found = False
                    for cw in list(unmatched_corr):
                        if aw == cw or similitud_levenshtein(aw, cw) > 0.85:
                            unmatched_corr.remove(cw)
                            match_found = True
                            break
                    if not match_found:
                        unmatched_alias.append(aw)
                
                # 1. Emparejamiento por prefijo (abreviaciones claras como "torn" -> "tornillo")
                paired_alias = set()
                paired_corr = set()
                
                for aw in unmatched_alias:
                    best_cw = None
                    best_score = 0.0
                    for cw in unmatched_corr:
                        if cw in paired_corr:
                            continue
                        # Verificar si uno es prefijo del otro
                        is_prefix = False
                        if (cw.startswith(aw) or aw.startswith(cw)) and len(min(aw, cw)) >= 3:
                            is_prefix = True
                            
                        score = 0.9 if is_prefix else similitud_levenshtein(aw, cw)
                        if score > best_score and score >= 0.5:
                            best_score = score
                            best_cw = cw
                    
                    if best_cw:
                        paired_alias.add(aw)
                        paired_corr.add(best_cw)
                        # Registrar sinónimo directo en ambas direcciones
                        for w1, w2 in [(aw, best_cw), (best_cw, aw)]:
                            if w1 not in mapa:
                                mapa[w1] = []
                            if w2 not in mapa[w1]:
                                mapa[w1].append(w2)
                
                # Remover los emparejados por prefijo/similitud
                remaining_alias = [w for w in unmatched_alias if w not in paired_alias]
                remaining_corr = [w for w in unmatched_corr if w not in paired_corr]
                
                # 2. Si queda exactamente 1 palabra en cada lado, se emparejan directamente (ej: "dorado" -> "oro")
                if len(remaining_alias) == 1 and len(remaining_corr) == 1:
                    w1, w2 = remaining_alias[0], remaining_corr[0]
                    for x, y in [(w1, w2), (w2, w1)]:
                        if x not in mapa:
                            mapa[x] = []
                        if y not in mapa[x]:
                            mapa[x].append(y)
                
                # 3. Si quedan múltiples, acumular co-ocurrencias para aprendizaje estadístico
                elif len(remaining_alias) > 0 and len(remaining_corr) > 0:
                    for aw in remaining_alias:
                        aw_counts[aw] = aw_counts.get(aw, 0) + 1
                        for cw in remaining_corr:
                            pair = (aw, cw)
                            cooc_counts[pair] = cooc_counts.get(pair, 0) + 1
        
        # 4. Procesar co-ocurrencias estadísticas
        for (aw, cw), count in cooc_counts.items():
            # Umbral: co-ocurren al menos 2 veces
            if count >= 2:
                prob = count / aw_counts[aw]
                # Si representa al menos el 40% de las apariciones de aw, es un match confiable!
                if prob >= 0.4:
                    for x, y in [(aw, cw), (cw, aw)]:
                        if x not in mapa:
                            mapa[x] = []
                        if y not in mapa[x]:
                            mapa[x].append(y)
                            
        SINONIMOS_DINAMICOS = mapa
        
        # Reconstruir index inverso incorporando los estáticos + dinámicos
        SINONIMOS_INVERSO.clear()
        for palabra, sinonimos in SINONIMOS.items():
            SINONIMOS_INVERSO[palabra] = palabra
            for sin in sinonimos:
                SINONIMOS_INVERSO[sin.split()[0]] = palabra
                
        # Incorporar dinámicos al índice inverso de búsqueda
        for canonical, alts in SINONIMOS_DINAMICOS.items():
            for alt in alts:
                first_word = alt.split()[0]
                if first_word not in SINONIMOS_INVERSO:
                    SINONIMOS_INVERSO[first_word] = canonical
                    
        print(f"🧠 [IA de Aprendizaje] Se cargaron {len(mapa)} relaciones de sinónimos dinámicos a partir de {len(aprendizajes)} correcciones.")
    except Exception as e:
        print(f"❌ Error extrayendo sinónimos dinámicos: {e}")

def son_sinonimos(p1: str, p2: str) -> bool:
    """Verifica si dos palabras son sinónimos (ya sean predefinidos o aprendidos)"""
    p1_norm = normalizar_marca(p1)
    p2_norm = normalizar_marca(p2)
    
    if p1_norm == p2_norm:
        return True
        
    # Equivalencia semántica: Colores específicos <-> "varios" / "surtido"
    COLORES = {'blanco', 'negro', 'rojo', 'azul', 'verde', 'amarillo', 'gris', 'dorado', 'plateado', 'bronce', 'cafe', 'naranja', 'morado', 'rosa', 'transparente'}
    VARIOS = {'varios', 'surtido', 'surtidos', 'multicolor'}
    
    es_color1 = p1_norm in COLORES or (p1_norm in SINONIMOS_INVERSO and SINONIMOS_INVERSO[p1_norm] in COLORES)
    es_color2 = p2_norm in COLORES or (p2_norm in SINONIMOS_INVERSO and SINONIMOS_INVERSO[p2_norm] in COLORES)
    
    if (es_color1 and p2_norm in VARIOS) or (es_color2 and p1_norm in VARIOS):
        return True

    # Caso 1: Sinónimos estáticos predefinidos
    if p1_norm in SINONIMOS and p2_norm in SINONIMOS[p1_norm]:
        return True
    if p2_norm in SINONIMOS and p1_norm in SINONIMOS[p2_norm]:
        return True
        
    # Caso 2: Sinónimos dinámicos aprendidos del usuario
    if p1_norm in SINONIMOS_DINAMICOS and p2_norm in SINONIMOS_DINAMICOS[p1_norm]:
        return True
    if p2_norm in SINONIMOS_DINAMICOS and p1_norm in SINONIMOS_DINAMICOS[p2_norm]:
        return True
        
    # Caso 3: Ambas palabras corresponden a la misma forma canónica
    canon1 = SINONIMOS_INVERSO.get(p1_norm)
    canon2 = SINONIMOS_INVERSO.get(p2_norm)
    if canon1 and canon2 and canon1 == canon2:
        return True
        
    return False

def palabras_similares(p1: str, p2: str) -> float:
    """Compara dos palabras considerando variaciones de marca y sinónimos"""
    # Normalizar ambas
    p1_norm = normalizar_marca(p1)
    p2_norm = normalizar_marca(p2)
    
    if p1_norm == p2_norm:
        return 1.0
    if p1 == p2:
        return 1.0
        
    # Verificar si son sinónimos registrados
    if son_sinonimos(p1, p2):
        return 0.95
        
    if p1 in p2:
        return 0.9
    if p2 in p1:
        return 0.85
    
    # Levenshtein
    if len(p1) > 2 and len(p2) > 2:
        return similitud_levenshtein(p1, p2)
    return 0.0

def calcular_similitud(busqueda: str, producto_db: str) -> float:
    """
    Calcula similitud avanzada entre texto de búsqueda y producto en DB.
    Prioriza marcas, tipos de productos y características distintivas.
    Retorna score de 0 a 1.
    """
    busq_norm = normalizar_texto(busqueda)
    prod_norm = normalizar_texto(producto_db)
    
    if not busq_norm or not prod_norm:
        return 0.0
    
    if busq_norm == prod_norm:
        return 1.0
    
    # Separar en palabras
    palabras_busq = busq_norm.split()
    palabras_prod = prod_norm.split()
    
    # Quitar stopwords
    stopwords = {'de', 'la', 'el', 'en', 'con', 'para', 'por', 'un', 'una', 'los', 'las', 'y', 'o', 'a', 'x', 'ref', 'incluye'}
    palabras_busq = [p for p in palabras_busq if p not in stopwords and len(p) > 1]
    palabras_prod = [p for p in palabras_prod if p not in stopwords and len(p) > 1]
    
    if not palabras_busq:
        return 0.0
    
    # Calcular coincidencias por categoría
    coincidencias_importantes = 0
    coincidencias_distintivas = 0
    coincidencias_normales = 0
    
    total_importantes = 0
    total_distintivas = 0
    total_normales = 0
    
    for palabra in palabras_busq:
        palabra_norm = normalizar_marca(palabra)
        es_importante = any(palabras_similares(palabra_norm, imp) > 0.75 for imp in PALABRAS_IMPORTANTES)
        es_distintiva = any(palabras_similares(palabra_norm, dist) > 0.75 for dist in PALABRAS_DISTINTIVAS)
        
        # Buscar mejor match en producto
        mejor_score = 0.0
        for p_prod in palabras_prod:
            p_prod_norm = normalizar_marca(p_prod)
            
            # Usar la nueva función de comparación
            score = palabras_similares(palabra_norm, p_prod_norm)
            mejor_score = max(mejor_score, score)
            
            # También comparar originales si son diferentes
            if palabra != palabra_norm or p_prod != p_prod_norm:
                score2 = palabras_similares(palabra, p_prod)
                mejor_score = max(mejor_score, score2)
        
        # Clasificar según tipo de palabra
        if es_importante:
            total_importantes += 1
            if mejor_score > 0.6:
                coincidencias_importantes += mejor_score
        elif es_distintiva:
            total_distintivas += 1
            if mejor_score > 0.6:
                coincidencias_distintivas += mejor_score
        else:
            total_normales += 1
            if mejor_score > 0.5:
                coincidencias_normales += mejor_score
    
    # Calcular score ponderado
    # Importantes: 40%, Distintivas: 35%, Normales: 25%
    score = 0.0
    peso_total = 0.0
    
    if total_importantes > 0:
        score += (coincidencias_importantes / total_importantes) * 0.40
        peso_total += 0.40
    
    if total_distintivas > 0:
        score += (coincidencias_distintivas / total_distintivas) * 0.35
        peso_total += 0.35
    
    if total_normales > 0:
        score += (coincidencias_normales / total_normales) * 0.25
        peso_total += 0.25
    
    # Normalizar si no hay peso total
    if peso_total > 0:
        score = score / peso_total
    else:
        # Fallback: calcular promedio simple
        total_palabras = len(palabras_busq)
        coincidencias_total = coincidencias_importantes + coincidencias_distintivas + coincidencias_normales
        score = coincidencias_total / total_palabras if total_palabras > 0 else 0
    
    # Penalizar si falta palabra distintiva (color, tamaño)
    if total_distintivas > 0 and coincidencias_distintivas == 0:
        score *= 0.6  # Penalización fuerte
    
    return min(1.0, max(0.0, score))
    
class MatchRequest(BaseModel):
    nombres: list[str]

class AprendizajeRequest(BaseModel):
    nombre_original: str
    producto_id_correcto: str
    nombre_producto_correcto: str

def buscar_aprendizaje(nombre_buscar: str) -> dict | None:
    """Busca si hay un aprendizaje previo para este nombre"""
    nombre_norm = normalizar_texto(nombre_buscar)
    nombre_expandido = expandir_sinonimos(nombre_norm)
    
    # 1. Buscar coincidencia exacta normalizada
    aprendizaje = aprendizajes_col.find_one({"nombre_normalizado": nombre_norm})
    if aprendizaje:
        return aprendizaje
    
    # 2. Buscar en lista de alias del producto
    aprendizaje = aprendizajes_col.find_one({"aliases_normalizados": nombre_norm})
    if aprendizaje:
        return aprendizaje
    
    # 3. Buscar coincidencia por similitud alta (> 0.85) usando n-gramas
    aprendizajes = list(aprendizajes_col.find({}).sort("veces_corregido", -1).limit(200))
    mejor_apr = None
    mejor_score = 0
    
    for apr in aprendizajes:
        # Comparar con nombre principal
        score1 = similitud_ngramas(nombre_expandido, apr.get("nombre_normalizado", ""))
        score2 = similitud_levenshtein(nombre_norm, apr.get("nombre_normalizado", ""))
        score = max(score1, score2)
        
        # Comparar con aliases
        for alias in apr.get("aliases_normalizados", []):
            s1 = similitud_ngramas(nombre_expandido, alias)
            s2 = similitud_levenshtein(nombre_norm, alias)
            score = max(score, s1, s2)
        
        if score > mejor_score and score > 0.85:
            mejor_score = score
            mejor_apr = apr
    
    return mejor_apr

@app.post("/api/aprender")
def guardar_aprendizaje(request: AprendizajeRequest):
    """Guarda una corrección para aprendizaje futuro - permite múltiples aliases por producto"""
    nombre_norm = normalizar_texto(request.nombre_original)
    
    # Buscar si ya existe aprendizaje para ESTE PRODUCTO
    existente_producto = aprendizajes_col.find_one({"producto_id": request.producto_id_correcto})
    
    response_data = {}
    if existente_producto:
        # Agregar este nombre como nuevo alias si no existe
        aliases = existente_producto.get("aliases", [])
        aliases_norm = existente_producto.get("aliases_normalizados", [])
        
        if request.nombre_original not in aliases:
            aliases.append(request.nombre_original)
        if nombre_norm not in aliases_norm:
            aliases_norm.append(nombre_norm)
        
        aprendizajes_col.update_one(
            {"_id": existente_producto["_id"]},
            {
                "$set": {
                    "aliases": aliases,
                    "aliases_normalizados": aliases_norm,
                    "ultima_actualizacion": datetime.now()
                },
                "$inc": {"veces_corregido": 1}
            }
        )
        response_data = {
            "message": "Alias agregado al aprendizaje existente",
            "nombre": request.nombre_original,
            "total_aliases": len(aliases)
        }
    else:
        # Buscar si ya existe este nombre exacto
        existente_nombre = aprendizajes_col.find_one({"nombre_normalizado": nombre_norm})
        
        if existente_nombre:
            # Actualizar a nuevo producto
            aprendizajes_col.update_one(
                {"_id": existente_nombre["_id"]},
                {
                    "$set": {
                        "producto_id": request.producto_id_correcto,
                        "nombre_producto": request.nombre_producto_correcto,
                        "ultima_actualizacion": datetime.now()
                    },
                    "$inc": {"veces_corregido": 1}
                }
            )
        else:
            # Crear nuevo aprendizaje
            aprendizajes_col.insert_one({
                "nombre_original": request.nombre_original,
                "nombre_normalizado": nombre_norm,
                "aliases": [request.nombre_original],
                "aliases_normalizados": [nombre_norm],
                "producto_id": request.producto_id_correcto,
                "nombre_producto": request.nombre_producto_correcto,
                "veces_corregido": 1,
                "fecha_creacion": datetime.now(),
                "ultima_actualizacion": datetime.now()
            })
        response_data = {"message": "Aprendizaje guardado", "nombre": request.nombre_original}
    
    # Extraer sinónimos dinámicos en caliente tras la actualización
    extraer_sinonimos_dinamicos()
    return response_data

@app.get("/api/aprendizajes")
def obtener_aprendizajes():
    """Obtiene todos los aprendizajes guardados (máximo 500 para evitar timeout)"""
    aprendizajes = list(aprendizajes_col.find({}).sort("veces_corregido", -1).limit(500))
    return [serialize_doc(a) for a in aprendizajes]

@app.delete("/api/aprendizajes/{id}")
def eliminar_aprendizaje(id: str):
    """Elimina un aprendizaje"""
    aprendizajes_col.delete_one({"_id": ObjectId(id)})
    return {"message": "Aprendizaje eliminado"}

@app.post("/api/match-productos")
def match_productos(request: MatchRequest):
    """
    Busca productos similares para múltiples nombres.
    - Soporta cualquier cantidad de productos en una sola solicitud.
    - Usa similitud robusta combinando Levenshtein + n-gramas + coincidencia por tokens.
    - Reduce costo computacional con índice invertido para evitar comparar contra TODO el catálogo.
    """
    try:
        nombres_entrada = request.nombres or []
        if len(nombres_entrada) == 0:
            return []

        # Cargar catálogo una sola vez
        productos = list(productos_col.find({}, {"nombre": 1, "costo": 1, "precio_venta": 1}))
        if not productos:
            return [{
                "nombre_original": nombre,
                "producto_sugerido": None,
                "score": 0,
                "sospechoso": True,
                "aprendido": False
            } for nombre in nombres_entrada]

        stopwords = {'de', 'la', 'el', 'en', 'con', 'para', 'por', 'un', 'una', 'los', 'las', 'y', 'o', 'a', 'x'}

        # ========== PREPROCESAMIENTO + ÍNDICE INVERTIDO ==========
        productos_preprocesados = []
        indice_tokens = defaultdict(set)  # token -> set(idx)

        for idx, prod in enumerate(productos):
            nombre_original = prod.get("nombre", "")
            if not nombre_original:
                continue

            nombre_expandido = expandir_fracciones(nombre_original)
            nombre_norm = normalizar_texto(nombre_expandido)
            if not nombre_norm:
                continue

            tokens = [normalizar_marca(t) for t in nombre_norm.split() if len(t) > 1 and t not in stopwords]
            if not tokens:
                continue

            token_set = set(tokens)
            marca_producto = next((t for t in tokens if t in MARCAS), None)
            medidas_producto = extraer_medidas(nombre_norm)

            productos_preprocesados.append({
                "original": prod,
                "nombre_norm": nombre_norm,
                "tokens": tokens,
                "token_set": token_set,
                "marca": marca_producto,
                "medidas": medidas_producto,
            })

            for token in token_set:
                indice_tokens[token].add(len(productos_preprocesados) - 1)

        if not productos_preprocesados:
            return [{
                "nombre_original": nombre,
                "producto_sugerido": None,
                "score": 0,
                "sospechoso": True,
                "aprendido": False
            } for nombre in nombres_entrada]

        vocab_tokens = list(indice_tokens.keys())

        def token_similarity(tq: str, tp: str) -> float:
            """Similitud de token robusta y tolerante a errores de OCR/escritura."""
            if tq == tp:
                return 1.0

            if tq in tp or tp in tq:
                base = min(len(tq), len(tp)) / max(len(tq), len(tp))
                return min(0.98, max(0.84, base))

            # Prefijos/sufijos parecidos: útil para abreviaciones y errores al final
            pref = os.path.commonprefix([tq, tp])
            pref_ratio = len(pref) / max(1, min(len(tq), len(tp)))

            lev = 0.0
            ngr = 0.0
            if len(tq) > 2 and len(tp) > 2:
                lev = similitud_levenshtein(tq, tp)
                ngr = similitud_ngramas(tq, tp, 2)

            # Combinación híbrida para más flexibilidad
            return max(lev, ngr, pref_ratio * 0.9)

        def buscar_tokens_parecidos(token_query: str, max_resultados: int = 60) -> list[str]:
            """Encuentra tokens similares del vocabulario para tolerar typos/OCR."""
            cercanos = []
            # Umbral dinámico: más estricto con tokens cortos, más flexible con largos
            if len(token_query) <= 3:
                umbral = 0.82
            elif len(token_query) <= 5:
                umbral = 0.74
            else:
                umbral = 0.68

            for tk in vocab_tokens:
                if abs(len(tk) - len(token_query)) > 4:
                    continue
                sim = token_similarity(token_query, tk)
                if sim >= umbral:
                    cercanos.append((tk, sim))

            cercanos.sort(key=lambda x: x[1], reverse=True)
            return [t for t, _ in cercanos[:max_resultados]]

        def puntuar(query_norm: str, query_tokens: list[str], query_token_set: set[str],
                    marca_buscada: str | None, medidas_query: set[str], p_data: dict) -> float:
            tokens_prod = p_data["tokens"]
            token_set_prod = p_data["token_set"]
            nombre_prod_norm = p_data["nombre_norm"]

            if not query_tokens or not tokens_prod:
                return 0.0

            # 1) Similitud por tokens (promedio de mejores coincidencias)
            total = 0.0
            criticas_total = 0
            criticas_match = 0

            for tq in query_tokens:
                mejor = 0.0
                for tp in token_set_prod:
                    sim = palabras_similares(tq, tp)
                    if sim > mejor:
                        mejor = sim
                    if mejor >= 0.995:
                        break
                total += mejor

                es_critica = (
                    tq.isdigit() or
                    tq in PALABRAS_IMPORTANTES or
                    tq in UNIDADES_CRITICAS or
                    tq in MARCAS or
                    any(c.isdigit() for c in tq)
                )
                if es_critica:
                    criticas_total += 1
                    if mejor >= 0.72:
                        criticas_match += 1

            token_score = total / len(query_tokens)

            # 2) Similitud global del string (Levenshtein + n-gramas)
            lev = similitud_levenshtein(query_norm, nombre_prod_norm)
            ngr = similitud_ngramas(query_norm, nombre_prod_norm, 2)
            global_score = max(lev, ngr)

            # 3) Coincidencia de medidas/números
            medidas_prod = p_data["medidas"]
            if medidas_query:
                inter = len(medidas_query & medidas_prod)
                medidas_score = inter / max(1, len(medidas_query))
            else:
                medidas_score = 1.0

            score = (token_score * 0.54) + (global_score * 0.34) + (medidas_score * 0.12)

            # Penalización por pocas palabras críticas coincidentes
            if criticas_total > 0:
                ratio_crit = criticas_match / criticas_total
                if ratio_crit < 0.45:
                    score *= 0.72
                elif ratio_crit < 0.75:
                    score *= 0.88

            # Marca: impacto moderado para no romper matching cuando hay typos en marca
            marca_producto = p_data["marca"]
            if marca_buscada:
                if marca_producto:
                    misma_marca = (
                        marca_buscada == marca_producto or
                        marca_producto in VARIACIONES_MARCA.get(marca_buscada, []) or
                        marca_buscada in VARIACIONES_MARCA.get(marca_producto, []) or
                        token_similarity(marca_buscada, marca_producto) >= 0.74
                    )
                    if misma_marca:
                        score = min(1.0, score + 0.08)
                    else:
                        score *= 0.65
                else:
                    score *= 0.82

            # Preferir productos más compactos en empates
            score -= min(0.03, len(tokens_prod) * 0.002)
            return max(0.0, min(1.0, score))

        resultados = []

        # ========== MATCH POR CADA PRODUCTO SOLICITADO ==========
        for nombre_buscar in nombres_entrada:
            nombre_original = nombre_buscar or ""
            nombre_limpio = nombre_original.strip()

            if not nombre_limpio:
                resultados.append({
                    "nombre_original": nombre_original,
                    "producto_sugerido": None,
                    "score": 0,
                    "sospechoso": True,
                    "aprendido": False
                })
                continue

            mejor_match = None
            mejor_score = 0.0
            segundo_score = 0.0
            aprendido = False

            # 1) Priorizar aprendizaje previo
            try:
                aprendizaje = buscar_aprendizaje(nombre_limpio)
                if aprendizaje:
                    producto_aprendido = productos_col.find_one({"_id": ObjectId(aprendizaje["producto_id"])})
                    if producto_aprendido:
                        mejor_match = producto_aprendido
                        mejor_score = 1.0
                        aprendido = True
            except Exception as e:
                print(f"Error buscando aprendizaje para '{nombre_limpio}': {e}")

            if not aprendido:
                # 2) Preprocesar query
                query_expand = expandir_fracciones(nombre_limpio)
                query_norm = normalizar_texto(query_expand)
                query_tokens_raw = [normalizar_marca(t) for t in query_norm.split() if len(t) > 1 and t not in stopwords]

                if not query_tokens_raw:
                    resultados.append({
                        "nombre_original": nombre_original,
                        "producto_sugerido": None,
                        "score": 0,
                        "sospechoso": True,
                        "aprendido": False
                    })
                    continue

                # Quitar duplicados conservando orden
                query_tokens = list(dict.fromkeys(query_tokens_raw))
                query_token_set = set(query_tokens)

                marca_buscada = next((t for t in query_tokens if t in MARCAS), None)
                medidas_query = extraer_medidas(query_norm)

                # 3) Generar candidatos por índice invertido
                candidatos = set()

                candidatos_exactos = set()
                candidatos_fuzzy = set()

                for tk in query_tokens:
                    if tk in indice_tokens:
                        candidatos_exactos.update(indice_tokens[tk])

                    # Sumar vecinos fuzzy para tolerar errores de digitación/OCR
                    # (solo en tokens de longitud suficiente para evitar ruido/costo innecesario)
                    if len(tk) >= 3:
                        for similar in buscar_tokens_parecidos(tk):
                            candidatos_fuzzy.update(indice_tokens.get(similar, set()))

                candidatos = candidatos_exactos | candidatos_fuzzy

                # Último fallback: recorrer todo el catálogo preprocesado
                if not candidatos:
                    candidatos = set(range(len(productos_preprocesados)))

                # Control de rendimiento: cap dinámico de candidatos por query
                # Si la entrada es larga permitimos más candidatos para mejorar recall
                cap_candidatos = 1800 if len(query_tokens) >= 4 else 1400
                if len(candidatos) > cap_candidatos:
                    # Priorizar candidatos por intersección exacta y fuzzy
                    candidatos_ordenados = sorted(
                        candidatos,
                        key=lambda i: (
                            len(query_token_set & productos_preprocesados[i]["token_set"]),
                            i in candidatos_exactos,
                        ),
                        reverse=True
                    )
                    candidatos = set(candidatos_ordenados[:cap_candidatos])

                # 4) Puntuar candidatos
                for idx_prod in candidatos:
                    p_data = productos_preprocesados[idx_prod]
                    score = puntuar(query_norm, query_tokens, query_token_set, marca_buscada, medidas_query, p_data)

                    if score > mejor_score:
                        segundo_score = mejor_score
                        mejor_score = score
                        mejor_match = p_data["original"]
                    elif score > segundo_score:
                        segundo_score = score

            # 5) Clasificar confianza
            if aprendido:
                sospechoso = False
            elif mejor_match is None or mejor_score < 0.46:
                sospechoso = True
            elif mejor_score < 0.60:
                sospechoso = True
            else:
                gap = mejor_score - segundo_score
                sospechoso = gap < 0.04 and mejor_score < 0.84

            resultados.append({
                "nombre_original": nombre_original,
                "producto_sugerido": serialize_doc(mejor_match) if mejor_match else None,
                "score": round(mejor_score, 3),
                "sospechoso": sospechoso,
                "aprendido": aprendido
            })

        return resultados

    except Exception as e:
        print(f"Error en match_productos: {e}")
        return [{
            "nombre_original": nombre,
            "producto_sugerido": None,
            "score": 0,
            "sospechoso": True,
            "aprendido": False
        } for nombre in (request.nombres or [])]

class BorrarMultiplesRequest(BaseModel):
    ids: List[str]

@app.delete("/api/productos")
def eliminar_todos_los_productos():
    """Elimina todos los productos del catálogo"""
    try:
        result = productos_col.delete_many({})
        return {
            "status": "success",
            "cantidad_eliminada": result.deleted_count,
            "message": f"Se eliminaron {result.deleted_count} productos correctamente."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar productos: {str(e)}")

@app.post("/api/productos/eliminar-multiples")
def eliminar_multiples_productos(request: BorrarMultiplesRequest):
    """Elimina múltiples productos basados en una lista de IDs"""
    try:
        object_ids = [ObjectId(id_str) for id_str in request.ids if ObjectId.is_valid(id_str)]
        if not object_ids:
            raise HTTPException(status_code=400, detail="No se proporcionaron IDs válidos")
        
        result = productos_col.delete_many({"_id": {"$in": object_ids}})
        return {
            "status": "success",
            "cantidad_eliminada": result.deleted_count,
            "message": f"Se eliminaron {result.deleted_count} productos correctamente."
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error al eliminar múltiples productos: {str(e)}")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "database": DB_NAME}

# Cargar sinónimos dinámicos al iniciar el servidor
try:
    extraer_sinonimos_dinamicos()
except Exception as e:
    print(f"⚠️ No se pudieron cargar sinónimos dinámicos en el arranque: {e}")

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"🚀 CalcuP Backend iniciando en http://{host}:{port}")
    print(f"📦 Base de datos: {DB_NAME}")
    print(f"🔗 MongoDB: {MONGO_URL[:30]}...")
    uvicorn.run(app, host=host, port=port)
