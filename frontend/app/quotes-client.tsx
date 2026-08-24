import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  FlatList,
  TouchableOpacity,
  Keyboard,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  IconButton,
  Card,
  Searchbar,
  Divider,
  Portal,
  Modal,
  ActivityIndicator,
} from 'react-native-paper';
import { cotizacionesApi, calculosApi, productosApi } from '../services/api';
import { Cotizacion, ItemCotizacion, Calculo, Producto } from '../types/types';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useDebounceValue } from '../hooks/useDebounce';

interface ClienteConPrecio {
  nombre: string;
  producto: string;
  precio_final: number;
  porcentaje_ganancia: number;
  costo: number;
}

export default function QuoteClientScreen() {
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('Cliente General');
  const [searchCliente, setSearchCliente] = useState('Cliente General');
  const [showClienteResults, setShowClienteResults] = useState(false);
  const [clientesDisponibles, setClientesDisponibles] = useState<string[]>(['Cliente General']);
  const [preciosPorCliente, setPreciosPorCliente] = useState<ClienteConPrecio[]>([]);
  const [productosGenerales, setProductosGenerales] = useState<Producto[]>([]);
  
  const [items, setItems] = useState<Array<{
    cantidad: string;
    producto: string;
    precio_unitario: number;
    subtotal: number;
  }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [nombreCotizacion, setNombreCotizacion] = useState('');
  
  // Búsqueda de productos
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchingIndex, setSearchingIndex] = useState<number | null>(null);
  
  // Cotizaciones guardadas
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    cargarDatosClientes();
    cargarProductosGenerales();
    loadCotizaciones();
  }, []);

  useEffect(() => {
    calcularTotal();
  }, [items]);

  const cargarProductosGenerales = async () => {
    try {
      const response = await productosApi.getAll();
      setProductosGenerales(response.data);
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  };

  const cargarDatosClientes = async () => {
    try {
      const response = await calculosApi.getAll();
      const calculos: Calculo[] = response.data;
      
      // Extraer clientes únicos y sus precios
      const clientesSet = new Set<string>();
      const precios: ClienteConPrecio[] = [];
      
      calculos.forEach(calc => {
        if (calc.clientes && calc.clientes.length > 0) {
          calc.clientes.forEach(cliente => {
            if (cliente.nombre) {
              clientesSet.add(cliente.nombre);
              precios.push({
                nombre: cliente.nombre,
                producto: calc.nombre_producto,
                precio_final: cliente.precio_final,
                porcentaje_ganancia: cliente.porcentaje_ganancia,
                costo: calc.costo_base,
              });
            }
          });
        }
      });
      
      setClientesDisponibles(['Cliente General', ...Array.from(clientesSet).sort()]);
      setPreciosPorCliente(precios);
    } catch (error) {
      console.error('Error cargando clientes:', error);
    }
  };

  const loadCotizaciones = async () => {
    try {
      const response = await cotizacionesApi.getAll();
      setCotizaciones(response.data.filter((c: Cotizacion) => c.nombre_cliente?.startsWith('[C] ')));
    } catch (error) {
      console.error('Error al cargar cotizaciones:', error);
    }
  };

  // ⚡ Perf: debounce búsqueda de clientes
  const debouncedSearchCliente = useDebounceValue(searchCliente, 200);

  const clientesFiltrados = useMemo(() => {
    if (!debouncedSearchCliente) return clientesDisponibles.slice(0, 20);
    const q = debouncedSearchCliente.toLowerCase();
    return clientesDisponibles.filter(c => c.toLowerCase().includes(q)).slice(0, 20);
  }, [debouncedSearchCliente, clientesDisponibles]);

  const productosDelCliente = useMemo(() => {
    if (!clienteSeleccionado) return [];
    if (clienteSeleccionado === 'Cliente General') {
      // Para Cliente General, usar precio_venta de todos los productos
      return productosGenerales.map(p => ({
        nombre: 'Cliente General',
        producto: p.nombre,
        precio_final: p.precio_venta || 0,
        porcentaje_ganancia: 0,
        costo: p.costo || 0,
      }));
    }
    return preciosPorCliente.filter(p => p.nombre === clienteSeleccionado);
  }, [clienteSeleccionado, preciosPorCliente, productosGenerales]);

  const productosFiltrados = useMemo(() => {
    if (!searchQuery) return productosDelCliente.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return productosDelCliente.filter(p => p.producto.toLowerCase().includes(q)).slice(0, 50);
  }, [searchQuery, productosDelCliente]);

  const seleccionarCliente = useCallback((cliente: string) => {
    setClienteSeleccionado(cliente);
    setSearchCliente(cliente);
    setShowClienteResults(false);
    setItems([]);
    setTotal(0);
  }, []);

  const agregarFila = useCallback(() => {
    setItems(prev => [...prev, { cantidad: '1', producto: '', precio_unitario: 0, subtotal: 0 }]);
  }, []);

  const eliminarFila = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const actualizarCantidad = useCallback((index: number, cantidad: string) => {
    const cantNorm = cantidad.replace(',', '.');
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = {
        ...newItems[index],
        cantidad,
        subtotal: (parseFloat(cantNorm) || 0) * newItems[index].precio_unitario,
      };
      return newItems;
    });
  }, []);

  const buscarProducto = useCallback((index: number, query: string) => {
    setSearchingIndex(index);
    setSearchQuery(query);
    setShowResults(query.length >= 1);
  }, []);

  const seleccionarProducto = useCallback((index: number, prod: ClienteConPrecio) => {
    setItems(prev => {
      const newItems = [...prev];
      const cant = parseFloat(newItems[index].cantidad.replace(',', '.')) || 0;
      newItems[index] = {
        ...newItems[index],
        producto: prod.producto,
        precio_unitario: prod.precio_final,
        subtotal: cant * prod.precio_final,
      };
      return newItems;
    });
    setShowResults(false);
    setSearchQuery('');
    setSearchingIndex(null);
    Keyboard.dismiss();
  }, []);

  const calcularTotal = useCallback(() => {
    const suma = items.reduce((acc, item) => acc + item.subtotal, 0);
    setTotal(suma);
  }, [items]);

  const limpiar = useCallback(() => {
    setItems([]);
    setTotal(0);
    setNombreCotizacion('');
  }, []);

  const guardarCotizacion = async () => {
    if (!clienteSeleccionado) {
      Alert.alert('Error', 'Selecciona un cliente primero');
      return;
    }
    if (items.length === 0 || items.every(i => !i.producto)) {
      Alert.alert('Error', 'Agrega al menos un producto');
      return;
    }

    try {
      setLoading(true);
      
      const itemsCotizacion: ItemCotizacion[] = items
        .filter(item => item.producto)
        .map(item => ({
          cantidad: parseFloat(item.cantidad.replace(',', '.')) || 0,
          producto_id: '',
          nombre_producto: item.producto,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
        }));

      await cotizacionesApi.create({
        nombre_cliente: `[C] ${clienteSeleccionado}${nombreCotizacion ? ' - ' + nombreCotizacion : ''}`,
        items: itemsCotizacion,
        total,
      });

      Alert.alert('Éxito', 'Cotización guardada');
      limpiar();
      loadCotizaciones();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  const exportarCotizacion = async (cotizacion: Cotizacion) => {
    try {
      const data = cotizacion.items.map(item => ({
        'Producto': item.nombre_producto,
        'Cantidad': item.cantidad,
        'Precio_Unitario': item.precio_unitario,
        'Subtotal': item.subtotal,
      }));
      data.push({ 'Producto': 'TOTAL', 'Cantidad': '', 'Precio_Unitario': '', 'Subtotal': cotizacion.total } as any);

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cotizacion');
      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `cotizacion_cliente_${Date.now()}.xlsx`;

      if (Platform.OS === 'web') {
        const binary = atob(excelBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
      } else {
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, excelBase64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo exportar');
    }
  };

  const renderItem = useCallback(({ item, index }: { item: typeof items[0]; index: number }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>Item {index + 1}</Text>
        <IconButton icon="delete" size={20} iconColor="#d32f2f" onPress={() => eliminarFila(index)} />
      </View>

      <TextInput
        mode="outlined"
        label="Cantidad"
        value={item.cantidad}
        onChangeText={(text) => actualizarCantidad(index, text)}
        keyboardType="decimal-pad"
        style={styles.inputSmall}
        dense
      />

      <Searchbar
        placeholder="Buscar producto..."
        onChangeText={(query) => buscarProducto(index, query)}
        value={searchingIndex === index ? searchQuery : item.producto}
        style={styles.searchbar}
      />

      {showResults && searchingIndex === index && productosFiltrados.length > 0 && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={productosFiltrados}
            keyExtractor={(p, i) => `${p.producto}-${i}`}
            renderItem={({ item: prod }) => (
              <TouchableOpacity onPress={() => seleccionarProducto(index, prod)} style={styles.resultItem}>
                <Text style={styles.resultTitle} numberOfLines={2}>{prod.producto}</Text>
                <Text style={styles.resultPrice}>${prod.precio_final.toLocaleString()} ({prod.porcentaje_ganancia}%)</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 200 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          />
        </View>
      )}

      {item.producto && (
        <View style={styles.subtotalBox}>
          <Text style={styles.subtotalLabel}>Subtotal:</Text>
          <Text style={styles.subtotalValor}>${item.subtotal.toLocaleString()}</Text>
        </View>
      )}
    </View>
  ), [searchingIndex, searchQuery, showResults, productosFiltrados, actualizarCantidad, buscarProducto, seleccionarProducto, eliminarFila]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* Selector de Cliente */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Seleccionar Cliente</Text>
            <Searchbar
              placeholder="Buscar cliente..."
              onChangeText={(text) => { setSearchCliente(text); setShowClienteResults(true); }}
              value={searchCliente}
              onFocus={() => setShowClienteResults(true)}
              style={styles.searchbar}
            />
            {showClienteResults && clientesFiltrados.length > 0 && (
              <View style={styles.clienteResults}>
                <FlatList
                  data={clientesFiltrados}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => seleccionarCliente(item)} style={styles.clienteItem}>
                      <Text style={styles.clienteText}>{item}</Text>
                    </TouchableOpacity>
                  )}
                  style={{ maxHeight: 150 }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                />
              </View>
            )}
            {clienteSeleccionado && (
              <View style={styles.clienteSeleccionado}>
                <Text style={styles.clienteLabel}>Cliente: <Text style={styles.clienteNombre}>{clienteSeleccionado}</Text></Text>
                <Text style={styles.productosDisp}>{productosDelCliente.length} productos con precios</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Items */}
        {clienteSeleccionado && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Productos</Text>
                <IconButton icon="plus" size={24} onPress={agregarFila} mode="contained" />
              </View>

              {/* ⚡ Perf: usar FlatList en lugar de .map() para virtualización */}
              <FlatList
                data={items}
                keyExtractor={(_, index) => `item-${index}`}
                renderItem={renderItem}
                scrollEnabled={false}
                nestedScrollEnabled
              />

              {items.length === 0 && (
                <Text style={styles.emptyText}>Presiona + para agregar productos</Text>
              )}

              {items.length > 0 && (
                <Button mode="outlined" onPress={agregarFila} icon="plus" style={{ marginTop: 8 }}>
                  Agregar otro producto
                </Button>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Total */}
        {total > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <TextInput
                mode="outlined"
                label="Nombre/Referencia (opcional)"
                value={nombreCotizacion}
                onChangeText={setNombreCotizacion}
                style={styles.inputSmall}
                dense
              />
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>TOTAL:</Text>
                <Text style={styles.totalValor}>${total.toLocaleString()}</Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Botones */}
        <View style={styles.buttonContainer}>
          <Button mode="contained" onPress={guardarCotizacion} loading={loading} disabled={!clienteSeleccionado || items.length === 0} icon="content-save">
            Guardar Cotización
          </Button>
          <Button mode="outlined" onPress={limpiar} icon="eraser">
            Limpiar
          </Button>
          <Divider style={styles.divider} />
          <Button mode="contained" onPress={() => setModalVisible(true)} icon="folder-open" buttonColor="#1976d2">
            Ver Cotizaciones Cliente
          </Button>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Cotizaciones por Cliente</Text>
          {cotizaciones.length === 0 ? (
            <Text style={styles.emptyText}>No hay cotizaciones</Text>
          ) : (
            <FlatList
              data={cotizaciones}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <Card style={styles.cotizacionCard}>
                  <Card.Content>
                    <Text style={styles.cotizacionCliente}>{item.nombre_cliente?.replace('[C] ', '')}</Text>
                    <Text style={styles.cotizacionItems}>{item.items.length} productos</Text>
                    <Text style={styles.cotizacionTotal}>Total: ${item.total.toLocaleString()}</Text>
                    <View style={styles.cotizacionActions}>
                      <Button mode="text" onPress={() => exportarCotizacion(item)} icon="share" compact>Compartir</Button>
                    </View>
                  </Card.Content>
                </Card>
              )}
            />
          )}
          <Button mode="contained" onPress={() => setModalVisible(false)} style={styles.modalButton}>Cerrar</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  card: { margin: 16, marginBottom: 8, borderRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  searchbar: { marginBottom: 8, elevation: 0, backgroundColor: '#fff' },
  clienteResults: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 8 },
  clienteItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  clienteText: { fontSize: 15, color: '#333' },
  clienteSeleccionado: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, marginTop: 8 },
  clienteLabel: { fontSize: 14, color: '#333' },
  clienteNombre: { fontWeight: 'bold', color: '#2e7d32' },
  productosDisp: { fontSize: 12, color: '#666', marginTop: 4 },
  inputSmall: { backgroundColor: '#fff', marginBottom: 8 },
  itemCard: { backgroundColor: '#fafafa', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { fontSize: 16, fontWeight: 'bold', color: '#6200ee' },
  resultsContainer: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 8 },
  resultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  resultTitle: { fontSize: 14, fontWeight: '500', color: '#333' },
  resultPrice: { fontSize: 12, color: '#2e7d32', marginTop: 4 },
  subtotalBox: { backgroundColor: '#e3f2fd', padding: 10, borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtotalLabel: { fontSize: 14, color: '#1565c0' },
  subtotalValor: { fontSize: 16, fontWeight: 'bold', color: '#0d47a1' },
  totalBox: { backgroundColor: '#e8f5e9', padding: 16, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#2e7d32' },
  totalValor: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20' },
  emptyText: { textAlign: 'center', color: '#999', paddingVertical: 20, fontSize: 14 },
  buttonContainer: { padding: 16, gap: 12 },
  divider: { marginVertical: 8 },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 12, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  cotizacionCard: { marginBottom: 12, borderRadius: 10 },
  cotizacionCliente: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  cotizacionItems: { fontSize: 14, color: '#666' },
  cotizacionTotal: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginTop: 4 },
  cotizacionActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalButton: { marginTop: 16 },
});
