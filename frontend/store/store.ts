import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Producto, Flujo, Calculo, Cotizacion } from '../types/types';
import { flujosApi, productosApi, calculosApi, cotizacionesApi } from '../services/api';

interface AppState {
  // Data
  productos: Producto[];
  flujos: Flujo[];
  calculos: Calculo[];
  cotizaciones: Cotizacion[];
  
  // Loading states
  loading: boolean;
  flujosLoading: boolean;
  productosLoading: boolean;
  
  // Setters
  setProductos: (productos: Producto[]) => void;
  setFlujos: (flujos: Flujo[]) => void;
  setCalculos: (calculos: Calculo[]) => void;
  setCotizaciones: (cotizaciones: Cotizacion[]) => void;
  setLoading: (loading: boolean) => void;
  
  // Async actions - Flujos
  fetchFlujos: () => Promise<void>;
  addFlujo: (flujo: Flujo) => void;
  updateFlujoInStore: (flujo: Flujo) => void;
  removeFlujo: (id: string) => void;
  
  // Async actions - Productos
  fetchProductos: () => Promise<void>;
  
  // Async actions - Calculos
  fetchCalculos: () => Promise<void>;
  
  // Version tracker for forcing re-renders
  flujosVersion: number;
  incrementFlujosVersion: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  productos: [],
  flujos: [],
  calculos: [],
  cotizaciones: [],
  loading: false,
  flujosLoading: false,
  productosLoading: false,
  flujosVersion: 0,
  
  // Basic setters
  setProductos: (productos) => set({ productos }),
  setFlujos: (flujos) => set({ flujos }),
  setCalculos: (calculos) => set({ calculos }),
  setCotizaciones: (cotizaciones) => set({ cotizaciones }),
  setLoading: (loading) => set({ loading }),
  
  // Version incrementer for forcing updates
  incrementFlujosVersion: () => set((state) => ({ flujosVersion: state.flujosVersion + 1 })),
  
  // Fetch flujos from API and update store
  fetchFlujos: async () => {
    set({ flujosLoading: true });
    try {
      const response = await flujosApi.getAll();
      set({ flujos: response.data, flujosLoading: false });
    } catch (error) {
      console.error('Error fetching flujos:', error);
      set({ flujosLoading: false });
    }
  },
  
  // Add a flujo to the store
  addFlujo: (flujo) => {
    set((state) => ({
      flujos: [...state.flujos, flujo],
      flujosVersion: state.flujosVersion + 1,
    }));
  },
  
  // Update a flujo in the store
  updateFlujoInStore: (updatedFlujo) => {
    set((state) => ({
      flujos: state.flujos.map((f) => 
        f._id === updatedFlujo._id ? updatedFlujo : f
      ),
      flujosVersion: state.flujosVersion + 1,
    }));
  },
  
  // Remove a flujo from the store
  removeFlujo: (id) => {
    set((state) => ({
      flujos: state.flujos.filter((f) => f._id !== id),
      flujosVersion: state.flujosVersion + 1,
    }));
  },
  
  // Fetch productos from API
  fetchProductos: async () => {
    set({ productosLoading: true });
    try {
      const response = await productosApi.getAll();
      set({ productos: response.data, productosLoading: false });
    } catch (error) {
      console.error('Error fetching productos:', error);
      set({ productosLoading: false });
    }
  },
  
  // Fetch calculos from API
  fetchCalculos: async () => {
    set({ loading: true });
    try {
      const response = await calculosApi.getAll();
      set({ calculos: response.data, loading: false });
    } catch (error) {
      console.error('Error fetching calculos:', error);
      set({ loading: false });
    }
  },
}));

// ⚡ Perf: Selectores específicos con useShallow para evitar re-renders innecesarios
// Usar estos hooks en lugar de destructurar múltiples propiedades del store.
// Ejemplo: const { flujos, fetchFlujos } = useFlujosStore();
export const useFlujosStore = () =>
  useStore(
    useShallow((s) => ({
      flujos: s.flujos,
      flujosLoading: s.flujosLoading,
      flujosVersion: s.flujosVersion,
      fetchFlujos: s.fetchFlujos,
      addFlujo: s.addFlujo,
      updateFlujoInStore: s.updateFlujoInStore,
      removeFlujo: s.removeFlujo,
      incrementFlujosVersion: s.incrementFlujosVersion,
    }))
  );

export const useProductosStore = () =>
  useStore(
    useShallow((s) => ({
      productos: s.productos,
      productosLoading: s.productosLoading,
      fetchProductos: s.fetchProductos,
      setProductos: s.setProductos,
    }))
  );

export const useCalculosStore = () =>
  useStore(
    useShallow((s) => ({
      calculos: s.calculos,
      loading: s.loading,
      fetchCalculos: s.fetchCalculos,
      setCalculos: s.setCalculos,
    }))
  );
