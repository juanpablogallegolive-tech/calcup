export interface Producto {
  _id: string;
  nombre: string;
  costo: number;           // Costo del producto
  precio_venta: number;    // Precio de venta al público
  cantidad?: string;       // Cantidad en stock
  flujo_id?: string;
  comentarios?: string;
  fecha_creacion?: string;
}

export interface Operacion {
  nombre: string;
  tipo_operacion: 'Sumar' | 'Restar' | 'Multiplicar' | 'Dividir';
  tipo_valor: 'Porcentaje' | 'Número';
  orden: number;
}

export interface Flujo {
  _id: string;
  nombre: string;
  operaciones: Operacion[];
  fecha_creacion?: string;
}

export interface Cliente {
  nombre: string;
  porcentaje_ganancia: number;
  comentario?: string;
  precio_final: number;
}

export interface Calculo {
  _id: string;
  producto_id?: string;
  nombre_producto: string;
  flujo_nombre: string;
  flujo_id?: string;
  valores_operaciones: Record<string, number>;
  clientes: Cliente[];
  costo_base: number;
  precio_calculado?: number;  // Precio después del flujo, antes de ganancia
  fecha?: string;
}

export interface ItemCotizacion {
  cantidad: number;
  producto_id: string;
  nombre_producto: string;
  precio_unitario: number;
  subtotal: number;
}

export interface Cotizacion {
  _id: string;
  nombre_cliente?: string;
  items: ItemCotizacion[];
  total: number;
  fecha?: string;
}
