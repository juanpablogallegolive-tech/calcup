import axios from 'axios';
import { Producto, Flujo, Calculo, Cotizacion, Cliente } from '../types/types';

let currentBackendUrl = (
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://calcup-api.onrender.com'
).replace(/\/$/, '');

const api = axios.create({
  baseURL: `${currentBackendUrl}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getBackendUrl = () => currentBackendUrl;

export const setBackendUrl = (newUrl: string) => {
  const cleanUrl = (newUrl || '').trim().replace(/\/$/, '');
  if (cleanUrl) {
    currentBackendUrl = cleanUrl;
    api.defaults.baseURL = `${cleanUrl}/api`;
  }
};

export const checkServerHealth = async (customUrl?: string): Promise<{ ok: boolean; message: string }> => {
  const targetUrl = customUrl ? customUrl.trim().replace(/\/$/, '') : currentBackendUrl;
  try {
    const res = await axios.get(`${targetUrl}/api/health`, { timeout: 5000 });
    if (res.status === 200) {
      return { ok: true, message: 'Servidor en línea (' + (res.data?.mongo || 'OK') + ')' };
    }
    return { ok: false, message: 'Servidor respondió con código ' + res.status };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Sin conexión con el servidor' };
  }
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error?.code;
    const status = error?.response?.status;
    if (!error.response || code === 'ECONNABORTED' || code === 'ERR_NETWORK') {
      error.userMessage =
        'No se pudo conectar con el servidor (Render). Si el servicio está en plan free, puede tardar ~1 min en despertar. Revisa EXPO_PUBLIC_BACKEND_URL y que el backend esté vivo.';
    } else if (status >= 500) {
      error.userMessage = 'El servidor de Render respondió con error. Revisa logs y MONGO_URL.';
    }
    return Promise.reject(error);
  }
);

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
  bulkImport: (productos: Array<{ nombre: string; costo: number; precio_venta: number; cantidad?: string; comentarios?: string }>) =>
    api.post<{ nuevos: number; actualizados: number; sin_cambios: number; errores: number; total: number }>('/productos/bulk-import', { productos }),
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

export const matchProductoIndividual = (nombre: string) => 
  api.post<{
    nombre_original: string;
    producto_sugerido: Producto | null;
    score: number;
    sospechoso: boolean;
    aprendido?: boolean;
  }>('/match-producto', { nombre });

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

export const guardarAprendizaje = aprendizajesApi.guardar;

export default api;
