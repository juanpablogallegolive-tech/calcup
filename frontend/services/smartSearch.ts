
import Fuse, { IFuseOptions } from 'fuse.js';
import { Producto } from '../types/types';
import { productosApi, aprendizajesApi } from './api';

// ==================== CONFIGURACIÓN ====================

const FUSE_OPTIONS: IFuseOptions<ProductoBuscable> = {
  keys: [
    { name: 'nombre', weight: 1.0 },
    { name: 'nombreNormalizado', weight: 0.95 },  // Subido para priorizar normalizado
    { name: 'nombreExpandido', weight: 0.85 },
  ],
  threshold: 0.35,          // Más estricto (era 0.4)
  distance: 150,            // Reducido (era 200)
  minMatchCharLength: 2,    // Mínimo 2 caracteres para considerar
  includeScore: true,       // Incluir score en resultados
  shouldSort: true,         // Ordenar por relevancia
  findAllMatches: true,     // Buscar en todo el string, no solo al inicio
  ignoreLocation: true,     // No penalizar por posición en el string
  useExtendedSearch: true,  // Habilitar búsqueda extendida
  isCaseSensitive: false,   // Explícitamente insensible a mayúsculas
};

// ==================== SINÓNIMOS Y NORMALIZACIONES ====================

const SINONIMOS: Record<string, string[]> = {
  // Materiales
  'pvc': ['plastico', 'vinyl', 'vinilo'],
  'galv': ['galvanizado', 'hg', 'hierro galvanizado'],
  'galvanizado': ['galv', 'hg'],
  'inox': ['inoxidable', 'acero inoxidable', 'ss'],
  'acero': ['ac', 'steel'],
  'bronce': ['bro', 'cafe', 'café', 'bronze'],
  'cobre': ['cob', 'copper'],
  'aluminio': ['alu', 'aluminum'],
  'hierro': ['fe', 'fierro', 'hro'],
  'laton': ['brass', 'amarillo'],
  'zinc': ['zn', 'galva'],
  'cromo': ['cromado', 'chrome'],
  'acrilico': ['acrylic', 'pmma'],
  'polietileno': ['pe', 'hdpe', 'ldpe'],
  'polipropileno': ['pp'],
  'madera': ['mad', 'wood'],
  
  // Productos - Tubería y accesorios
  'tubo': ['tuberia', 'tb', 'tbo', 'pipe'],
  'tuberia': ['tubo', 'tb'],
  'valvula': ['val', 'valv', 'valve'],
  'griferia': ['llave', 'mezclador', 'canilla', 'grifo'],
  'codo': ['cod', 'elbow', 'curva'],
  'tee': ['te', 't'],
  'reduccion': ['red', 'reductor', 'reducer'],
  'union': ['uni', 'acople', 'coupling'],
  'niple': ['nip', 'nipple'],
  'tapon': ['tap', 'plug', 'cap'],
  'sifon': ['trampa', 'trap'],
  'llave paso': ['registro', 'valvula paso', 'stopcock'],
  
  // Productos - Tornillería
  'tornillo': ['torn', 'screw', 'bolt'],
  'tuerca': ['tuer', 'nut'],
  'arandela': ['aran', 'washer'],
  'clavo': ['clav', 'nail'],
  'perno': ['pern', 'bolt'],
  'hex': ['hexagonal', 'hexagono'],
  'allen': ['bristol', 'hexagonal interno'],
  'phillips': ['estrella', 'cruz', 'ph'],
  'plano': ['ranura', 'slot', 'flat', 'av', 'avellanado'],
  'autorroscante': ['autoperforante', 'drywall', 'punta broca'],
  
  // Productos - Herramientas
  'martillo': ['mazo', 'combo', 'hammer'],
  'destornillador': ['desarmador', 'atornillador', 'screwdriver'],
  'llave': ['espaner', 'spanner', 'wrench'],
  'alicate': ['pinza', 'tenaza', 'pliers'],
  'taladro': ['rotomartillo', 'percutor', 'drill', 'perforadora'],
  'sierra': ['serrucho', 'caladora', 'saw'],
  'nivel': ['nivelador', 'level'],
  'metro': ['cinta metrica', 'flexo', 'huincha'],
  'flexometro': ['metro', 'cinta', 'wincha', 'flex'],
  
  // Productos - Electricidad
  'cable': ['alambre', 'conductor', 'wire', 'hilo'],
  'enchufe': ['toma', 'tomacorriente', 'outlet'],
  'interruptor': ['switch', 'apagador', 'suiche'],
  'bombillo': ['bombilla', 'foco', 'bulb', 'led'],
  'breaker': ['breker', 'tacos', 'taco', 'interruptor termico'],
  'canaleta': ['ducto', 'canal'],
  
  // Productos - Plomería
  'sanitario': ['inodoro', 'taza', 'toilet', 'wc'],
  'lavamanos': ['lavabo', 'sink'],
  'ducha': ['regadera', 'shower'],
  'tanque': ['cisterna', 'tank'],
  
  // Productos - Varios
  'quemado': ['negro', 'amarre', 'recocido'],
  'pega': ['pegante', 'pegamento', 'cola', 'adhesivo', 'silicona'],
  'goma': ['pegante', 'pegamento', 'cola', 'adhesivo', 'silicona'],
  'capacito': ['capacitor', 'condensador', 'cap', 'arranque'],
  'cap': ['capacitor', 'condensador', 'arranque'],
  'muro': ['concreto', 'cemento', 'pared'],
  'tapizar': ['tapiceria', 'tapisar'],
  'tapisar': ['tapiceria', 'tapizar'],
  'corruga': ['corrugado', 'corrugada'],
  'cor': ['corte'],
  'incol': ['incolma'],
  'incolma': ['incol'],
  'premium': ['premiun'],
  'premiun': ['premium'],
  'abrazadera': ['abr', 'clamp'],
  'manguera': ['mang', 'hose'],
  'flexible': ['flex', 'flexo'],
  'rodachin': ['rueda', 'rodaja', 'rodachina', 'garrucha', 'ruedita'],
  'colbon': ['pegante', 'cola', 'adhesivo', 'pega'],
  'afix': ['adesivo', 'adhesivo', 'pegante'],
  'tapa oidos': ['tapon oidos', 'protector auditivo', 'tapones'],
  'broca': ['mecha', 'bit'],
  'disco': ['rueda', 'wheel'],
  'lija': ['abrasivo', 'sandpaper'],
  'cinta': ['tape', 'masking'],
  
  // Medidas y unidades
  'media': ['1/2', '0.5'],
  'cuarto': ['1/4', '0.25'],
  'pulgada': ['"', 'pulg', 'inch'],
  'pulgadas': ['pul', 'pulg'],
  'mm': ['milimetro', 'milimetros'],
  'cm': ['centimetro', 'centimetros'],
  'mt': ['metro', 'metros', 'm', 'mts'],
  'kg': ['kilo', 'kilos', 'kilogramo'],
  'lb': ['libra', 'libras'],
  'gal': ['galon', 'galones'],
  'lt': ['litro', 'litros', 'l'],
  'oz': ['onza', 'onzas'],
  'mts': ['metros', 'm'],
  'pcs': ['und', 'unidades', 'pz', 'piezas'],
  'c/u': ['cada uno', 'unidad'],
  'pza': ['pieza', 'pz', 'pcs'],
  'cja': ['caja', 'box'],
  'bto': ['bulto', 'bolsa'],
  'rollo': ['rll', 'rl'],
  
  // Colores
  'blanco': ['bco', 'white'],
  'negro': ['ngo', 'black'],
  'rojo': ['rjo', 'red'],
  'azul': ['azl', 'blue'],
  'verde': ['vde', 'green'],
  'amarillo': ['ama', 'yellow'],
  'gris': ['grey', 'gray'],
  'dorado': ['oro', 'dorada', 'gold'],
  'oro': ['dorado', 'dorada', 'gold'],
  'plateado': ['plata', 'plateada', 'silver'],
  'plata': ['plateado', 'plateada', 'silver'],
  'transparente': ['cristal', 'clear'],
  
  // Marcas comunes (variaciones de escritura)
  'uduke': ['uduque', 'udukwe'],
  'discoveri': ['discovery', 'discoberi'],
  'total': ['totals'],
  'dewalt': ['de walt'],
  'black decker': ['blackdecker', 'b&d'],
};

// Crear mapa inverso de sinónimos
const SINONIMOS_INVERSO: Record<string, string> = {};
for (const [canonical, alts] of Object.entries(SINONIMOS)) {
  for (const alt of alts) {
    const firstWord = alt.split(' ')[0];
    if (!SINONIMOS_INVERSO[firstWord]) {
      SINONIMOS_INVERSO[firstWord] = canonical;
    }
  }
}

// Sinónimos aprendidos dinámicamente en el cliente
let SINONIMOS_DINAMICOS: Record<string, string[]> = {};

/**
 * Analiza los aprendizajes cargados y extrae sinónimos dinámicos en el cliente.
 */
export function extraerSinonimosDinamicosCliente(aprendizajes: AprendizajeLocal[]) {
  const mapa: Record<string, string[]> = {};
  const coocCounts: Record<string, number> = {};
  const awCounts: Record<string, number> = {};

  const stopwords = new Set(['de', 'la', 'el', 'en', 'con', 'para', 'por', 'un', 'una', 'los', 'las', 'y', 'o', 'a', 'x']);

  for (const apr of aprendizajes) {
    const corrNorm = normalizar(apr.nombre_producto);
    const corrWords = corrNorm.split(' ').filter(w => w.length > 1);

    for (const alias of apr.aliases_normalizados) {
      const aliasWords = alias.split(' ').filter(w => w.length > 1);

      const corrWordsClean = corrWords.filter(w => !stopwords.has(w));
      const aliasWordsClean = aliasWords.filter(w => !stopwords.has(w));

      // Identificar palabras que coinciden exactamente o son casi idénticas (>0.85 Levenshtein)
      const unmatchedAlias: string[] = [];
      let unmatchedCorr = [...corrWordsClean];

      for (const aw of aliasWordsClean) {
        let matchFound = false;
        for (let i = 0; i < unmatchedCorr.length; i++) {
          const cw = unmatchedCorr[i];
          if (aw === cw || levenshteinSimilarity(aw, cw) > 0.85) {
            unmatchedCorr.splice(i, 1);
            matchFound = true;
            break;
          }
        }
        if (!matchFound) {
          unmatchedAlias.push(aw);
        }
      }

      // Emparejar por prefijo
      const pairedAlias = new Set<string>();
      const pairedCorr = new Set<string>();

      for (const aw of unmatchedAlias) {
        let bestCw = '';
        let bestScore = 0;
        for (const cw of unmatchedCorr) {
          if (pairedCorr.has(cw)) continue;

          const isPrefix = (cw.startsWith(aw) || aw.startsWith(cw)) && Math.min(aw.length, cw.length) >= 3;
          const score = isPrefix ? 0.9 : levenshteinSimilarity(aw, cw);

          if (score > bestScore && score >= 0.5) {
            bestScore = score;
            bestCw = cw;
          }
        }

        if (bestCw) {
          pairedAlias.add(aw);
          pairedCorr.add(bestCw);
          for (const [w1, w2] of [[aw, bestCw], [bestCw, aw]]) {
            if (!mapa[w1]) mapa[w1] = [];
            if (!mapa[w1].includes(w2)) mapa[w1].push(w2);
          }
        }
      }

      // Filtrar emparejados
      const remainingAlias = unmatchedAlias.filter(w => !pairedAlias.has(w));
      const remainingCorr = unmatchedCorr.filter(w => !pairedCorr.has(w));

      // Si queda 1 y 1
      if (remainingAlias.length === 1 && remainingCorr.length === 1) {
        const w1 = remainingAlias[0];
        const w2 = remainingCorr[0];
        for (const [x, y] of [[w1, w2], [w2, w1]]) {
          if (!mapa[x]) mapa[x] = [];
          if (!mapa[x].includes(y)) mapa[x].push(y);
        }
      } else if (remainingAlias.length > 0 && remainingCorr.length > 0) {
        // Co-ocurrencias
        for (const aw of remainingAlias) {
          awCounts[aw] = (awCounts[aw] || 0) + 1;
          for (const cw of remainingCorr) {
            const pairKey = `${aw}|||${cw}`;
            coocCounts[pairKey] = (coocCounts[pairKey] || 0) + 1;
          }
        }
      }
    }
  }

  // Procesar co-ocurrencias
  for (const [pairKey, count] of Object.entries(coocCounts)) {
    if (count >= 2) {
      const [aw, cw] = pairKey.split('|||');
      const prob = count / awCounts[aw];
      if (prob >= 0.4) {
        for (const [x, y] of [[aw, cw], [cw, aw]]) {
          if (!mapa[x]) mapa[x] = [];
          if (!mapa[x].includes(y)) mapa[x].push(y);
        }
      }
    }
  }

  SINONIMOS_DINAMICOS = mapa;

  // Reconstruir SINONIMOS_INVERSO dinámico
  for (const [canonical, alts] of Object.entries(SINONIMOS_DINAMICOS)) {
    for (const alt of alts) {
      const firstWord = alt.split(' ')[0];
      if (!SINONIMOS_INVERSO[firstWord]) {
        SINONIMOS_INVERSO[firstWord] = canonical;
      }
    }
  }

  console.log(`[SmartSearch Client] Se extrajeron ${Object.keys(SINONIMOS_DINAMICOS).length} sinónimos dinámicos en el cliente.`);
}

// ==================== FUNCIONES DE NORMALIZACIÓN ====================

/**
 * Quita acentos y caracteres especiales
 */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Corrige errores típicos de OCR (caracteres confundidos)
 */
function corregirErroresOCR(texto: string): string {
  let res = texto;
  
  // Caracteres confundidos por OCR
  const reemplazosOCR: [RegExp, string][] = [
    [/\bO(\d)/g, '0$1'],        // O seguido de número → 0
    [/(\d)O\b/g, '$10'],        // número seguido de O → 0
    [/\bl(\d)/gi, '1$1'],       // l minúscula seguido de número → 1
    [/(\d)l\b/gi, '$11'],       // número seguido de l → 1
    [/\bI(\d)/g, '1$1'],        // I mayúscula seguido de número → 1
    [/(\d)I\b/g, '$11'],        // número seguido de I → 1
    [/\bS(\d)/g, '5$1'],        // S seguido de número → 5
    [/(\d)S\b/g, '$15'],        // número seguido de S → 5
    [/\bB(\d)/g, '8$1'],        // B seguido de número → 8
    [/(\d)B\b/g, '$18'],        // número seguido de B → 8
    [/rn/g, 'm'],               // rn → m (común en fuentes sans-serif)
    [/vv/g, 'w'],               // vv → w
    [/\bcI\b/gi, 'cl'],         // cI → cl
    [/\bpIa/gi, 'pla'],         // pIa → pla
    [/\btorn\s*i\s*llo/gi, 'tornillo'], // torn i llo → tornillo
    [/\btuber\s*i\s*a/gi, 'tuberia'],   // tuber i a → tuberia
  ];
  
  for (const [regex, reemplazo] of reemplazosOCR) {
    res = res.replace(regex, reemplazo);
  }
  
  return res;
}

/**
 * Normaliza unidades de medida a formato canónico
 */
function normalizarUnidades(texto: string): string {
  let res = texto;
  
  const unidades: [RegExp, string][] = [
    // Longitud
    [/\b(\d+)\s*milimetros?\b/gi, '$1mm'],
    [/\b(\d+)\s*centimetros?\b/gi, '$1cm'],
    [/\b(\d+)\s*metros?\b/gi, '$1mt'],
    [/\b(\d+)\s*mts\b/gi, '$1mt'],
    [/\b(\d+)\s*pulgadas?\b/gi, '$1pulg'],
    [/\b(\d+)\s*pulg\b/gi, '$1pulg'],
    [/\b(\d+)\s*["″]\s*/g, '$1pulg'],
    [/\b(\d+)\s*pies?\b/gi, '$1ft'],
    [/\b(\d+)\s*ft\b/gi, '$1ft'],
    
    // Peso
    [/\b(\d+)\s*kilogramos?\b/gi, '$1kg'],
    [/\b(\d+)\s*kilos?\b/gi, '$1kg'],
    [/\b(\d+)\s*gramos?\b/gi, '$1g'],
    [/\b(\d+)\s*libras?\b/gi, '$1lb'],
    [/\b(\d+)\s*onzas?\b/gi, '$1oz'],
    
    // Volumen
    [/\b(\d+)\s*litros?\b/gi, '$1lt'],
    [/\b(\d+)\s*mililitros?\b/gi, '$1ml'],
    [/\b(\d+)\s*galones?\b/gi, '$1gal'],
    [/\b(\d+)\s*cc\b/gi, '$1ml'],
    
    // Electricidad
    [/\b(\d+)\s*voltios?\b/gi, '$1v'],
    [/\b(\d+)\s*volts?\b/gi, '$1v'],
    [/\b(\d+)\s*amperios?\b/gi, '$1a'],
    [/\b(\d+)\s*amps?\b/gi, '$1a'],
    [/\b(\d+)\s*watts?\b/gi, '$1w'],
    [/\b(\d+)\s*vatios?\b/gi, '$1w'],
    
    // AWG (calibre de cables)
    [/\b(\d+)\s*awg\b/gi, '$1awg'],
    [/\bcalibre\s*(\d+)\b/gi, '$1awg'],
  ];
  
  for (const [regex, reemplazo] of unidades) {
    res = res.replace(regex, reemplazo);
  }
  
  return res;
}

/**
 * Normaliza fracciones escritas o mal espaciadas
 */
function normalizarMedidas(texto: string): string {
  let res = texto;
  
  // Rescatar símbolo de pulgada antes de que se limpie por regex
  res = res.replace(/"/g, ' pulgada ');

  // Convertir "1 4", "1-4", "1_4" a "1/4" etc para denominadores comunes
  res = res.replace(/\b(\d+)[\s\-_]+(2|3|4|8|16|32|64)\b/g, '$1/$2');
  
  // "1 y 1/2" -> "1 1/2"
  res = res.replace(/\b(\d+)\s+y\s+(\d+\/\d+)\b/g, '$1 $2');

  const reemplazos: Record<string, string> = {
    'un tercio': '1/3', '1 tercio': '1/3', 'tercio': '1/3',
    'dos tercios': '2/3', '2 tercios': '2/3',
    'un cuarto': '1/4', '1 cuarto': '1/4', 'cuarto': '1/4',
    'tres cuartos': '3/4', '3 cuartos': '3/4',
    'un medio': '1/2', '1 medio': '1/2', 'medio': '1/2', 'media': '1/2', 'mitad': '1/2',
    'un octavo': '1/8', '1 octavo': '1/8', 'octavo': '1/8',
    'tres octavos': '3/8', '3 octavos': '3/8',
    'cinco octavos': '5/8', '5 octavos': '5/8',
    'siete octavos': '7/8', '7 octavos': '7/8',
    'un dieciseisavo': '1/16', '1 dieciseisavo': '1/16', 'dieciseisavo': '1/16',
    'tres dieciseisavos': '3/16', '3 dieciseisavos': '3/16',
    'cinco dieciseisavos': '5/16', '5 dieciseisavos': '5/16',
    'siete dieciseisavos': '7/16', '7 dieciseisavos': '7/16',
    'nueve dieciseisavos': '9/16', '9 dieciseisavos': '9/16',
    'once dieciseisavos': '11/16', '11 dieciseisavos': '11/16',
    'trece dieciseisavos': '13/16', '13 dieciseisavos': '13/16',
    'quince dieciseisavos': '15/16', '15 dieciseisavos': '15/16',
    'un treinta y dosavo': '1/32', '1 treinta y dosavo': '1/32', 'treinta y dosavo': '1/32',
  };

  for (const [key, value] of Object.entries(reemplazos)) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    res = res.replace(regex, value);
  }

  res = res.replace(/\b0\.125\b/g, '1/8');
  res = res.replace(/\b0\.25\b/g, '1/4');
  res = res.replace(/\b0\.375\b/g, '3/8');
  res = res.replace(/\b0\.50?\b/g, '1/2');
  res = res.replace(/\b0\.625\b/g, '5/8');
  res = res.replace(/\b0\.75\b/g, '3/4');
  res = res.replace(/\b0\.875\b/g, '7/8');

  return res;
}

/**
 * Normaliza texto para búsqueda
 */
function normalizar(texto: string): string {
  if (!texto) return '';
  let norm = removeAccents(texto).toLowerCase().trim();
  
  // Aplicar correcciones OCR antes de todo
  norm = corregirErroresOCR(norm);
  
  // Normalizar medidas y fracciones
  norm = normalizarMedidas(norm);
  
  // Normalizar unidades
  norm = normalizarUnidades(norm);
  
  // Limpiar caracteres especiales
  norm = norm.replace(/[^a-z0-9\s/.\-]/g, ' ');
  norm = norm.replace(/\s+/g, ' ').trim();
  return norm;
}

/**
 * Expande sinónimos y abreviaciones en el texto
 */
function expandirSinonimos(texto: string): string {
  const palabras = texto.split(' ');
  const expandidas: string[] = [];
  
  let tieneColor = false;
  const COLORES = ['blanco', 'negro', 'rojo', 'azul', 'verde', 'amarillo', 'gris', 'dorado', 'plateado', 'bronce', 'cafe', 'naranja', 'morado', 'rosa', 'transparente'];
  
  for (const p of palabras) {
    expandidas.push(p);
    
    if (COLORES.includes(p) || (SINONIMOS_INVERSO[p] && COLORES.includes(SINONIMOS_INVERSO[p]))) {
      tieneColor = true;
    }

    // Agregar la forma canónica si existe
    if (SINONIMOS_INVERSO[p]) {
      expandidas.push(SINONIMOS_INVERSO[p]);
    }
    // Agregar sinónimos directos
    if (SINONIMOS[p]) {
      expandidas.push(...SINONIMOS[p].filter(s => !s.includes(' ')));
    }
    // Agregar sinónimos dinámicos
    if (SINONIMOS_DINAMICOS[p]) {
      expandidas.push(...SINONIMOS_DINAMICOS[p].filter(s => !s.includes(' ')));
    }
  }
  
  // Si el texto de búsqueda contiene un color, agregamos los comodines genéricos
  // Esto permite que buscar "manguera azul" encuentre "manguera colores varios"
  if (tieneColor) {
    expandidas.push('varios', 'surtido', 'multicolor', 'colores');
  }
  
  return [...new Set(expandidas)].join(' ');
}

// ==================== PRODUCTO EXTENDIDO PARA BÚSQUEDA ====================

interface ProductoBuscable extends Producto {
  nombreNormalizado: string;
  nombreExpandido: string;
}

// ==================== TIPO APRENDIZAJE (CACHÉ LOCAL) ====================

interface AprendizajeLocal {
  nombre_normalizado: string;
  aliases_normalizados: string[];
  producto_id: string;
  nombre_producto: string;
}

// ==================== CLASE PRINCIPAL ====================

class SmartSearchEngine {
  private fuse: Fuse<ProductoBuscable> | null = null;
  private productos: ProductoBuscable[] = [];
  private lastUpdate: number = 0;
  private isLoading: boolean = false;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutos de caché

  // Caché de aprendizajes para enriquecer búsquedas locales
  private aprendizajes: AprendizajeLocal[] = [];
  private aprendizajesLastUpdate: number = 0;
  private APRENDIZAJES_TTL = 10 * 60 * 1000; // 10 minutos

  /**
   * Carga o actualiza el índice de productos
   */
  async inicializar(forceRefresh: boolean = false): Promise<void> {
    const now = Date.now();
    
    // Si la caché es reciente y no se fuerza, no recargar
    if (!forceRefresh && this.fuse && (now - this.lastUpdate) < this.CACHE_TTL) {
      return;
    }
    
    // Evitar cargas simultáneas
    if (this.isLoading) return;
    this.isLoading = true;
    
    try {
      const response = await productosApi.getAll();
      const productosRaw: Producto[] = response.data;
      
      // Enriquecer cada producto con campos normalizados
      this.productos = productosRaw.map(p => ({
        ...p,
        nombreNormalizado: normalizar(p.nombre),
        nombreExpandido: expandirSinonimos(normalizar(p.nombre)),
      }));
      
      // Crear índice Fuse.js
      this.fuse = new Fuse(this.productos, FUSE_OPTIONS);
      this.lastUpdate = now;
      
      console.log(`[SmartSearch] Índice creado: ${this.productos.length} productos`);

      // Cargar aprendizajes en paralelo (no bloquea si falla)
      this.cargarAprendizajes().catch(e => 
        console.warn('[SmartSearch] No se pudieron cargar aprendizajes:', e)
      );
    } catch (error) {
      console.error('[SmartSearch] Error cargando productos:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Carga aprendizajes del backend para usar en búsquedas locales
   */
  private async cargarAprendizajes(): Promise<void> {
    const now = Date.now();
    if ((now - this.aprendizajesLastUpdate) < this.APRENDIZAJES_TTL && this.aprendizajes.length > 0) {
      return;
    }
    try {
      const response = await aprendizajesApi.getAll();
      this.aprendizajes = response.data.map(a => ({
        nombre_normalizado: a.nombre_normalizado,
        aliases_normalizados: a.aliases_normalizados || [],
        producto_id: a.producto_id,
        nombre_producto: a.nombre_producto,
      }));
      
      // Extraer sinónimos dinámicos en el cliente
      extraerSinonimosDinamicosCliente(this.aprendizajes);
      
      this.aprendizajesLastUpdate = now;
      console.log(`[SmartSearch] ${this.aprendizajes.length} aprendizajes cargados`);
    } catch (error) {
      console.warn('[SmartSearch] Error cargando aprendizajes:', error);
    }
  }

  /**
   * Busca en aprendizajes locales si hay un match para la query
   * Retorna el producto aprendido si lo encuentra, null si no
   */
  private buscarEnAprendizajes(queryNorm: string): Producto | null {
    if (this.aprendizajes.length === 0) return null;

    for (const apr of this.aprendizajes) {
      // Match exacto por nombre normalizado
      if (apr.nombre_normalizado === queryNorm) {
        return this.productos.find(p => p._id === apr.producto_id) || null;
      }
      // Match por aliases
      if (apr.aliases_normalizados.includes(queryNorm)) {
        return this.productos.find(p => p._id === apr.producto_id) || null;
      }
    }

    // Match por alta similitud (>0.85) usando Levenshtein + N-gramas
    let mejorApr: AprendizajeLocal | null = null;
    let mejorScore = 0;
    
    for (const apr of this.aprendizajes) {
      // Comparar con nombre principal
      const simLev = levenshteinSimilarity(queryNorm, apr.nombre_normalizado);
      const simNGram = similitudNGramas(queryNorm, apr.nombre_normalizado, 3);
      let score = Math.max(simLev, simNGram);
      
      // Comparar con aliases
      for (const alias of apr.aliases_normalizados) {
        const aliasSimLev = levenshteinSimilarity(queryNorm, alias);
        const aliasSimNGram = similitudNGramas(queryNorm, alias, 3);
        score = Math.max(score, aliasSimLev, aliasSimNGram);
      }
      
      if (score > mejorScore && score > 0.85) {
        mejorScore = score;
        mejorApr = apr;
      }
    }
    
    if (mejorApr) {
      return this.productos.find(p => p._id === mejorApr!.producto_id) || null;
    }

    return null;
  }

  /**
   * Registra un aprendizaje local inmediatamente (sin esperar al backend)
   * Para que búsquedas subsiguientes ya lo usen sin recargar
   */
  registrarAprendizajeLocal(nombreOriginal: string, productoId: string, nombreProducto: string): void {
    const nombreNorm = normalizar(nombreOriginal);
    
    // Buscar si ya existe para este producto
    const existente = this.aprendizajes.find(a => a.producto_id === productoId);
    if (existente) {
      if (!existente.aliases_normalizados.includes(nombreNorm)) {
        existente.aliases_normalizados.push(nombreNorm);
      }
    } else {
      this.aprendizajes.push({
        nombre_normalizado: nombreNorm,
        aliases_normalizados: [nombreNorm],
        producto_id: productoId,
        nombre_producto: nombreProducto,
      });
    }
    console.log(`[SmartSearch] Aprendizaje local registrado: "${nombreOriginal}" → "${nombreProducto}"`);
    
    // Extraer sinónimos dinámicos en el cliente inmediatamente
    extraerSinonimosDinamicosCliente(this.aprendizajes);
  }

  /**
   * Búsqueda inteligente de productos
   * @param query - Texto de búsqueda del usuario
   * @param limit - Máximo de resultados (default 20)
   * @returns Array de productos ordenados por relevancia
   */
  async buscar(query: string, limit: number = 20): Promise<Producto[]> {
    // Asegurar que el índice esté listo
    await this.inicializar();
    
    if (!this.fuse || !query || query.trim().length === 0) {
      return [];
    }
    
    // Normalizar y expandir la búsqueda
    const queryNorm = normalizar(query);
    const queryExpandido = expandirSinonimos(queryNorm);
    
    // Estrategia de búsqueda multi-paso para máxima cobertura
    const resultadosMap = new Map<string, { producto: Producto; score: number }>();
    
    // Paso 0: Consultar aprendizajes locales (prioridad máxima)
    const productoAprendido = this.buscarEnAprendizajes(queryNorm);
    if (productoAprendido) {
      resultadosMap.set(productoAprendido._id, { 
        producto: productoAprendido, 
        score: 0 // Score 0 = máxima prioridad en Fuse.js (menor es mejor)
      });
    }
    
    // Paso 1: Búsqueda directa con query original
    const directResults = this.fuse.search(queryNorm, { limit: limit * 2 });
    for (const r of directResults) {
      if (!resultadosMap.has(r.item._id)) {
        resultadosMap.set(r.item._id, { producto: r.item, score: r.score || 1 });
      }
    }
    
    // Paso 2: Búsqueda con sinónimos expandidos
    if (queryExpandido !== queryNorm) {
      const extendedResults = this.fuse.search(queryExpandido, { limit: limit * 2 });
      for (const r of extendedResults) {
        const existing = resultadosMap.get(r.item._id);
        const newScore = (r.score || 1) * 1.1; // Ligera penalización por ser vía sinónimo
        if (!existing || newScore < existing.score) {
          resultadosMap.set(r.item._id, { producto: r.item, score: newScore });
        }
      }
    }
    
    // Paso 3: Deep Semantic Scanner (IA de Contención Profunda)
    // Escaneamos TODO el catálogo evadiendo los límites de Fuse.js para queries de múltiples palabras.
    const palabrasQuery = queryNorm.split(' ').filter(p => p.length > 1 || /^\d+$/.test(p));
    
    if (palabrasQuery.length > 1) {
      for (let i = 0; i < this.productos.length; i++) {
        // Evitar bloqueo del UI thread en React Native
        if (i > 0 && i % 500 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        const prod = this.productos[i];
        const nombreNormProd = prod.nombreNormalizado;
        const nombreExpProd = prod.nombreExpandido || nombreNormProd;
        const partesProd = nombreExpProd.split(' ');
        
        let coincidencias = 0;
        let coincidenciaExacta = true;

        for (const p of palabrasQuery) {
          // Obtener expansiones (sinónimos y typos conocidos)
          let terminos = [p];
          if (SINONIMOS[p]) {
            terminos = terminos.concat(SINONIMOS[p]);
          }

          let match = false;
          for (const t of terminos) {
            // 1. Substring directo (ej. '10' en '10mm')
            if (nombreExpProd.includes(t)) {
              match = true; 
              break;
            }
            // 2. Raíz Léxica para palabras largas (Stemming agresivo)
            if (t.length >= 5) {
              const raiz = t.substring(0, 4);
              if (partesProd.some(np => np.startsWith(raiz))) {
                 match = true; 
                 break;
              }
            }
            // 3. Typo Tolerance Fuerte (Levenshtein) - SOLO SI SON CORTAS (Optimizacion CPU)
            if (t.length > 2) {
              const bestWord = findBestWordMatch(t, nombreExpProd);
              if (levenshteinSimilarity(t, bestWord) > 0.75) {
                match = true; 
                break;
              }
            }
          }

          if (match) {
            coincidencias++;
          } else {
            coincidenciaExacta = false;
          }
        }

        if (coincidencias > 0) {
          const ratio = coincidencias / palabrasQuery.length;
          const existing = resultadosMap.get(prod._id);
          
          // TIEBREAKER: Priorizar nombres de producto más cortos que contengan la búsqueda
          const tiebreaker = (coincidencias / Math.max(coincidencias, partesProd.length)) * 0.01;
          
          if (coincidenciaExacta) {
             // BONIFICACIÓN SUPREMA: Todas las palabras coinciden
             const baseScore = 0.05 - tiebreaker;
             if (existing) existing.score = Math.min(existing.score, baseScore);
             else resultadosMap.set(prod._id, { producto: prod, score: baseScore });
          } else if (ratio >= 0.6) {
             // Mayoría de palabras coinciden (ej. 2 de 3, 3 de 4)
             const fallbackScore = 0.2 - tiebreaker;
             if (existing) existing.score = Math.min(existing.score, fallbackScore);
             else resultadosMap.set(prod._id, { producto: prod, score: fallbackScore });
          }
        }
      }
    }
    
    // Paso 4: Análisis semántico de "Sujeto Principal" (El objeto principal de la búsqueda)
    // Extraemos la primera palabra que no sea un número, medida, marca o stopword
    const stopwords = new Set(['de', 'la', 'el', 'en', 'con', 'para', 'por', 'un', 'una', 'los', 'las', 'y', 'o', 'a', 'x', 'mm', 'cm', 'pul', 'pulg', 'pulgada', 'pulgadas', 'mt', 'mts', 'metro', 'metros', 'oz', 'pcs', 'ml', 'mili', 'mililitros']);
    const marcasConocidas = new Set(['total', 'incolma', 'colbon', 'dewalt', 'makita', 'bosch', 'stanley', 'truper', 'pretul', 'pintuco', 'sapolin', 'corona', 'pavco', 'gerfor', 'sika', 'loctite', 'abro', 'bellota', 'herragro', 'socoda', 'yale', 'schlage', 'imsa', 'centelsa', 'argos', 'cemex', '3m', 'gato', 'afix', 'mp', 'performax', 'codelca', 'indu', 'induma', 'gavilan', 'vera', 'tools', 'uduke', 'johnny', 'johnnys']);
    
    const palabrasSujeto = queryNorm.split(' ').filter(p => 
      (p.length > 2 || /^\d+$/.test(p)) && 
      !stopwords.has(p) && 
      !marcasConocidas.has(p) &&
      !/^\d/.test(p)
    );
    
    const sujetoPrincipal = palabrasSujeto.length > 0 ? palabrasSujeto[0] : null;
    let expansionesSujeto: string[] = [];
    if (sujetoPrincipal) {
      expansionesSujeto = expandirSinonimos(sujetoPrincipal).split(' ');
    }

    const resultadosArray = Array.from(resultadosMap.values());
    
    for (const r of resultadosArray) {
      if (sujetoPrincipal && r.score > 0 && r.score >= 0.1) { // Excluir score < 0.1 (aprendidos y exactos de Deep Scanner)
        const nombreExp = (r.producto as any).nombreExpandido || r.producto.nombre;
        const palabrasProd = nombreExp.split(' ');
        
        let sujetoEncontrado = false;
        for (const exp of expansionesSujeto) {
          if (nombreExp.includes(exp)) {
            sujetoEncontrado = true;
            break;
          }
          for (const pp of palabrasProd) {
            // Permitir variaciones con la misma raíz léxica (mínimo 4 letras iguales para palabras de 5+)
            if (exp.length >= 5 && pp.length >= 5 && pp.startsWith(exp.substring(0, 4))) {
              sujetoEncontrado = true;
              break;
            }
            if (levenshteinSimilarity(exp, pp) > 0.8) {
              sujetoEncontrado = true;
              break;
            }
          }
          if (sujetoEncontrado) break;
        }
        
        if (!sujetoEncontrado) {
          // Penalización masiva si el producto no contiene el objeto principal de la búsqueda
          r.score += 0.6; 
        } else {
          // Bonificación si sí lo contiene
          r.score = Math.max(0.01, r.score - 0.15);
        }
      }
    }

    // Ordenar por score (menor = mejor en Fuse.js) y limitar
    const resultados = resultadosArray
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
      .map(r => r.producto);
    
    return resultados;
  }

  /**
   * Match inteligente para el LectorTexto
   * Busca el mejor producto para cada nombre dado
   */
  async matchMultiple(nombres: string[]): Promise<Array<{
    nombre_original: string;
    producto_sugerido: Producto | null;
    score: number;
    sospechoso: boolean;
  }>> {
    await this.inicializar();
    
    if (!this.fuse) {
      return nombres.map(n => ({
        nombre_original: n,
        producto_sugerido: null,
        score: 0,
        sospechoso: true,
      }));
    }
    
    return nombres.map(nombre => {
      const queryNorm = normalizar(nombre);
      const results = this.fuse!.search(queryNorm, { limit: 1 });
      
      if (results.length === 0) {
        return {
          nombre_original: nombre,
          producto_sugerido: null,
          score: 0,
          sospechoso: true,
        };
      }
      
      const best = results[0];
      const score = 1 - (best.score || 1); // Invertir: Fuse da 0=mejor, nosotros 1=mejor
      
      return {
        nombre_original: nombre,
        producto_sugerido: best.item,
        score: Math.round(score * 1000) / 1000,
        sospechoso: score < 0.6,
      };
    });
  }

  /**
   * Invalida la caché para forzar recarga
   */
  invalidarCache(): void {
    this.lastUpdate = 0;
    this.aprendizajesLastUpdate = 0;
    this.fuse = null;
    this.productos = [];
    this.aprendizajes = [];
  }

  /**
   * Fuerza recarga de aprendizajes del backend
   */
  async recargarAprendizajes(): Promise<void> {
    this.aprendizajesLastUpdate = 0;
    await this.cargarAprendizajes();
  }

  /**
   * Retorna cantidad de aprendizajes en caché
   */
  get totalAprendizajes(): number {
    return this.aprendizajes.length;
  }

  /**
   * Retorna si el motor está listo
   */
  get isReady(): boolean {
    return this.fuse !== null;
  }

  /**
   * Retorna cantidad de productos indexados
   */
  get totalProductos(): number {
    return this.productos.length;
  }
}

// ==================== UTILIDADES ====================

/**
 * Calcula similitud Levenshtein entre dos strings (0-1) usando arrays 1D tipados
 * MUCHÍSIMO más rápido y amigable con el Garbage Collector de JS.
 */
function levenshteinSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  
  if (s1.length < s2.length) {
    const temp = s1;
    s1 = s2;
    s2 = temp;
  }
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  let previousRow = new Uint16Array(len2 + 1);
  let currentRow = new Uint16Array(len2 + 1);
  
  for (let j = 0; j <= len2; j++) {
    previousRow[j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    currentRow[0] = i;
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        currentRow[j - 1] + 1,
        previousRow[j] + 1,
        previousRow[j - 1] + cost
      );
    }
    const temp = previousRow;
    previousRow = currentRow;
    currentRow = temp;
  }
  
  const dist = previousRow[len2];
  return 1 - dist / Math.max(len1, len2);
}

/**
 * Genera n-gramas de un texto para matching parcial
 */
function generarNGramas(texto: string, n: number = 3): Set<string> {
  const ngrams = new Set<string>();
  const palabras = texto.split(' ');
  
  for (const palabra of palabras) {
    if (palabra.length >= n) {
      for (let i = 0; i <= palabra.length - n; i++) {
        ngrams.add(palabra.substring(i, i + n));
      }
    } else if (palabra.length > 0) {
      ngrams.add(palabra);
    }
  }
  
  return ngrams;
}

/**
 * Calcula similitud por n-gramas (Coeficiente de Jaccard)
 */
function similitudNGramas(texto1: string, texto2: string, n: number = 3): number {
  const ng1 = generarNGramas(texto1, n);
  const ng2 = generarNGramas(texto2, n);
  
  if (ng1.size === 0 || ng2.size === 0) return 0;
  
  let interseccion = 0;
  for (const ng of ng1) {
    if (ng2.has(ng)) interseccion++;
  }
  
  const union = ng1.size + ng2.size - interseccion;
  return interseccion / union;
}

/**
 * Encuentra la mejor coincidencia de una palabra en un texto
 * Omitiendo comparaciones inútiles para evitar cuellos de botella CPU
 */
function findBestWordMatch(word: string, text: string): string {
  const words = text.split(' ');
  let bestMatch = '';
  let bestScore = 0;
  
  for (const w of words) {
    // OPTIMIZACIÓN CRÍTICA: No calcular Levenshtein si la diferencia de longitud es mayor a 2
    if (Math.abs(w.length - word.length) > 2) continue;
    
    const score = levenshteinSimilarity(word, w);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = w;
      if (score === 1) break; // Si es perfecto, no seguir buscando
    }
  }
  
  return bestMatch;
}

// ==================== SINGLETON ====================

/**
 * Instancia singleton del motor de búsqueda
 * Uso:
 *   import { smartSearch } from './smartSearch';
 *   const resultados = await smartSearch.buscar('tornillo galvanizado 1/4');
 */
export const smartSearch = new SmartSearchEngine();

// ==================== FUNCIONES DE COMPATIBILIDAD (LEGACY) ====================

/**
 * @deprecated Usa smartSearch.buscar() directamente
 * Función de compatibilidad para código existente
 */
export async function busquedaInteligente(
  query: string, 
  limit: number = 20
): Promise<Producto[]> {
  return await smartSearch.buscar(query, limit);
}

/**
 * @deprecated Usa smartSearch.inicializar() directamente
 * Inicializa el índice de búsqueda (opcional, se hace automáticamente)
 */
export async function inicializarIndice(forceRefresh: boolean = false): Promise<void> {
  await smartSearch.inicializar(forceRefresh);
}

/**
 * @deprecated Usa smartSearch.totalProductos
 * Obtiene los productos en caché
 */
export function obtenerProductosCache(): Producto[] {
  return smartSearch['productos'] || [];
}

/**
 * @deprecated Usa smartSearch.invalidarCache()
 * Limpia el índice de búsqueda
 */
export function limpiarIndice(): void {
  smartSearch.invalidarCache();
}

/**
 * @deprecated Usa smartSearch.isReady
 * Verifica si el índice está inicializado
 */
export function indiceInicializado(): boolean {
  return smartSearch.isReady;
}

export default SmartSearchEngine;