import axios from 'axios';
import { Producto, Flujo, Calculo, Cotizacion, Cliente } from '../types/types';

// La variable se puede sobrescribir en frontend/.env o en EAS.
// El fallback evita que la app se cierre al abrirse cuando se instala el APK
// sin variables de entorno configuradas.
const BACKEND_URL = (
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://npm-install-g-eas-cli.onrender.com'
).replace(/\/$/, '');

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Productos
export const productosApi = {
  getAll: () => api.get<Producto[]>('/productos'),
  search: (query: string) => api.get<Producto[]>(`/productos/buscar?q=${encodeURIComponent(query)}`),
  getById: (id: string) => api.get<Producto>(`/productos/${id}`),
  create: (data: Omit<Producto, '_id'>) => api.post<Producto>('/productos', data),
  update: (id: string, data: Partial<Producto>) => api.put(`/productos/${id}`, data),
  delete: (id: string) => api.delete(`/productos/${id}`),
  deleteAll: () => api.delete('/productos'),
  deleteMultiple: (ids: string[]) => api.post('/productos/eliminar-multiples', { ids }),
};

// Flujos
export const flujosApi = {
  getAll: () => api.get<Flujo[]>('/flujos'),
  getById: (id: string) => api.get<Flujo>(`/flujos/${id}`),
  create: (data: Omit<Flujo, '_id'>) => api.post<Flujo>('/flujos', data),
  update: (id: string, data: Partial<Flujo>) => api.put(`/flujos/${id}`, data),
  delete: (id: string) => api.delete(`/flujos/${id}`),
};

// Cálculos
export const calculosApi = {
  getAll: (params?: { nombre?: string; fecha_desde?: string; fecha_hasta?: string }) => 
    api.get<Calculo[]>('/calculos', { params }),
  getById: (id: string) => api.get<Calculo>(`/calculos/${id}`),
  create: (data: Omit<Calculo, '_id'>) => api.post<Calculo>('/calculos', data),
  delete: (id: string) => api.delete(`/calculos/${id}`),
};

// Cotizaciones
export const cotizacionesApi = {
  getAll: () => api.get<Cotizacion[]>('/cotizaciones'),
  getById: (id: string) => api.get<Cotizacion>(`/cotizaciones/${id}`),
  create: (data: Omit<Cotizacion, '_id'>) => api.post<Cotizacion>('/cotizaciones', data),
  update: (id: string, data: Partial<Cotizacion>) => api.put(`/cotizaciones/${id}`, data),
  delete: (id: string) => api.delete(`/cotizaciones/${id}`),
};

// Calcular precio
export const calcularPrecio = (data: {
  costo_base: number;
  flujo_id: string;
  valores_operaciones: Record<string, number>;
  clientes: Array<{ nombre: string; porcentaje_ganancia: number; comentario?: string }>;
}) => api.post<{ costo_base: number; precio_calculado: number; resultados: Cliente[] }>('/calcular', data);

// Match de productos
export const matchProductos = (nombres: string[]) => 
  api.post<Array<{
    nombre_original: string;
    producto_sugerido: Producto | null;
    score: number;
    sospechoso: boolean;
    aprendido?: boolean;
  }>>('/match-productos', { nombres });

// Aprendizaje de IA
export const aprendizajesApi = {
  guardar: (data: {
    nombre_original: string;
    producto_id_correcto: string;
    nombre_producto_correcto: string;
  }) => api.post('/aprender', data),
  getAll: () => api.get<Array<{
    _id: string;
    nombre_original: string;
    nombre_normalizado: string;
    aliases: string[];
    aliases_normalizados: string[];
    producto_id: string;
    nombre_producto: string;
    veces_corregido: number;
  }>>('/aprendizajes'),
  delete: (id: string) => api.delete(`/aprendizajes/${id}`),
};

// Alias legacy para compatibilidad con LectorTexto
export const guardarAprendizaje = aprendizajesApi.guardar;
// ===== NOTA =====
// La búsqueda inteligente (smartSearch, busquedaInteligente, inicializarIndice)
// se importa directamente desde '../services/smartSearch' en los componentes.
// NO se re-exporta aquí para evitar dependencia circular (api ↔ smartSearch).

export default api;
