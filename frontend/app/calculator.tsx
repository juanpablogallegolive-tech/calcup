import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
  FlatList,
  Keyboard,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Searchbar,
  IconButton,
  ActivityIndicator,
  Card,
  Divider,
} from 'react-native-paper';
import { productosApi, calcularPrecio, calculosApi } from '../services/api';
import { Producto, Flujo, Cliente, Calculo } from '../types/types';
import { useStore } from '../store/store';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { smartSearch } from '../services/smartSearch';

export default function CalculatorScreen() {
  // ⚡ Perf: selectores específicos para evitar re-renders innecesarios
  const flujos = useStore((s) => s.flujos);
  const fetchFlujos = useStore((s) => s.fetchFlujos);
  const flujosVersion = useStore((s) => s.flujosVersion);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Producto[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  
  const [costoBaseEditable, setCostoBaseEditable] = useState('0');
  const [precioCalculado, setPrecioCalculado] = useState<number | null>(null); // Precio después del flujo
  
  const [selectedFlujo, setSelectedFlujo] = useState<Flujo | null>(null);
  const [modalFlujoVisible, setModalFlujoVisible] = useState(false);
  
  const [modalHistorialVisible, setModalHistorialVisible] = useState(false);
  const [historial, setHistorial] = useState<Calculo[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  
  const [valoresOperaciones, setValoresOperaciones] = useState<Record<string, string>>({});
  const [clientes, setClientes] = useState<Array<{
    nombre: string;
    porcentaje_ganancia: string;
    comentario: string;
    precio_final: number;
  }>>([]);
  
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    fetchFlujos();
  }, []);

  useEffect(() => {
    if (flujos.length > 0 && !selectedFlujo) {
      setSelectedFlujo(flujos[0]);
      initOperaciones(flujos[0]);
    }
  }, [flujos]);

  useEffect(() => {
    if (selectedFlujo && flujos.length > 0) {
      const flujoActualizado = flujos.find(f => f._id === selectedFlujo._id);
      if (flujoActualizado) {
        const operacionesCambiaron = JSON.stringify(flujoActualizado.operaciones) !== JSON.stringify(selectedFlujo.operaciones);
        if (operacionesCambiaron) {
          setSelectedFlujo(flujoActualizado);
          initOperaciones(flujoActualizado);
        }
      } else {
        if (flujos.length > 0) {
          setSelectedFlujo(flujos[0]);
          initOperaciones(flujos[0]);
        } else {
          setSelectedFlujo(null);
          setValoresOperaciones({});
        }
      }
    }
  }, [flujos, flujosVersion]);

  const initOperaciones = (flujo: Flujo) => {
    const valores: Record<string, string> = {};
    flujo.operaciones.forEach(op => {
      valores[op.nombre] = '0';
    });
    setValoresOperaciones(valores);
  };

  const resetPrecios = () => {
    setPrecioCalculado(null);
    setClientes(prev => prev.map(c => ({ ...c, precio_final: 0 })));
  };

  // ⚡ Perf: búsqueda debounced para no llamar API en cada tecla
  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    if (query.length >= 1) {
      try {
        setLoading(true);
        const response = await productosApi.search(query);
        setSearchResults(response.data);
        setShowResults(true);
      } catch (error) {
        console.error('Error en búsqueda:', error);
      } finally {
        setLoading(false);
      }
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, 300);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  const selectProduct = (producto: Producto) => {
    setSelectedProduct(producto);
    setSearchQuery(producto.nombre);
    setCostoBaseEditable((producto.costo || 0).toString());
    setShowResults(false);
    Keyboard.dismiss();
    resetPrecios();
    
    if (producto.flujo_id) {
      const flujo = flujos.find(f => f._id === producto.flujo_id);
      if (flujo) {
        setSelectedFlujo(flujo);
        initOperaciones(flujo);
      }
    }
  };

  const selectFlujo = (flujo: Flujo) => {
    setSelectedFlujo(flujo);
    setModalFlujoVisible(false);
    initOperaciones(flujo);
    resetPrecios();
  };

  const addCliente = () => {
    const newClientes = [...clientes, {
      nombre: `Cliente ${clientes.length + 1}`,
      porcentaje_ganancia: '0',
      comentario: '',
      precio_final: 0,
    }];
    setClientes(newClientes);
    
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const removeCliente = (index: number) => {
    if (Platform.OS === 'web') {
      setClientes(clientes.filter((_, i) => i !== index));
    } else {
      Alert.alert('Confirmar', '¿Eliminar este cliente?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => setClientes(clientes.filter((_, i) => i !== index)) },
      ]);
    }
  };

  const updateCliente = (index: number, field: string, value: string) => {
    const newClientes = [...clientes];
    newClientes[index] = { ...newClientes[index], [field]: value, precio_final: 0 };
    setClientes(newClientes);
  };

  const scrollToInput = (yOffset: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: yOffset - 100, animated: true });
    }
  };

  const calcular = async () => {
    const costoBase = parseFloat(costoBaseEditable) || 0;
    
    if (costoBase <= 0) {
      Alert.alert('Error', 'Ingresa un costo base válido');
      return;
    }
    
    if (!selectedFlujo) {
      Alert.alert('Error', 'Selecciona un flujo de cálculo');
      return;
    }

    if (clientes.length === 0) {
      Alert.alert('Error', 'Agrega al menos un cliente');
      return;
    }

    try {
      setCalculando(true);
      Keyboard.dismiss();
      
      const valoresNum: Record<string, number> = {};
      Object.keys(valoresOperaciones).forEach(key => {
        valoresNum[key] = parseFloat(valoresOperaciones[key]) || 0;
      });

      const clientesData = clientes.map(c => ({
        nombre: c.nombre || 'Cliente',
        porcentaje_ganancia: parseFloat(c.porcentaje_ganancia) || 0,
        comentario: c.comentario,
      }));

      const response = await calcularPrecio({
        costo_base: costoBase,
        flujo_id: selectedFlujo._id,
        valores_operaciones: valoresNum,
        clientes: clientesData,
      });

      // Guardar el precio calculado (antes de ganancia)
      setPrecioCalculado(response.data.precio_calculado);

      const newClientes = [...clientes];
      response.data.resultados.forEach((resultado: any, index: number) => {
        if (newClientes[index]) {
          newClientes[index].precio_final = resultado.precio_final;
        }
      });
      setClientes(newClientes);
      
      Alert.alert('Éxito', 'Precios calculados correctamente');

    } catch (error) {
      console.error('Error al calcular:', error);
      Alert.alert('Error', 'No se pudo calcular el precio');
    } finally {
      setCalculando(false);
    }
  };

  const guardar = async () => {
    const costoBase = parseFloat(costoBaseEditable) || 0;
    
    if (!selectedFlujo || clientes.length === 0) {
      Alert.alert('Error', 'Completa todos los campos antes de guardar');
      return;
    }

    if (!precioCalculado || clientes[0]?.precio_final === 0) {
      Alert.alert('Error', 'Calcula los precios antes de guardar');
      return;
    }

    try {
      setLoading(true);
      
      const valoresNum: Record<string, number> = {};
      Object.keys(valoresOperaciones).forEach(key => {
        valoresNum[key] = parseFloat(valoresOperaciones[key]) || 0;
      });

      const clientesGuardar: Cliente[] = clientes.map(c => ({
        nombre: c.nombre || 'Cliente',
        porcentaje_ganancia: parseFloat(c.porcentaje_ganancia) || 0,
        comentario: c.comentario,
        precio_final: c.precio_final,
      }));

      await calculosApi.create({
        nombre_producto: selectedProduct?.nombre || searchQuery || 'Producto',
        producto_id: selectedProduct?._id || '',
        flujo_nombre: selectedFlujo.nombre,
        flujo_id: selectedFlujo._id,
        valores_operaciones: valoresNum,
        clientes: clientesGuardar,
        costo_base: costoBase,
        precio_calculado: precioCalculado, // Guardar el precio calculado
      });

      // Invalidar cache de smartSearch para refrescar costo base y precio de venta
      smartSearch.invalidarCache();
      await smartSearch.inicializar(true);

      Alert.alert('Éxito', 'Cálculo guardado en el historial');
      limpiarFormulario();
      
    } catch (error) {
      console.error('Error al guardar:', error);
      Alert.alert('Error', 'No se pudo guardar el cálculo');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setSelectedProduct(null);
    setSearchQuery('');
    setCostoBaseEditable('0');
    setPrecioCalculado(null);
    setClientes([]);
    if (selectedFlujo) {
      initOperaciones(selectedFlujo);
    }
  };

  const abrirHistorial = async () => {
    setModalHistorialVisible(true);
    setLoadingHistorial(true);
    try {
      const response = await calculosApi.getAll();
      const sorted = response.data.sort((a: any, b: any) => {
        const dateA = new Date(a.fecha || 0).getTime();
        const dateB = new Date(b.fecha || 0).getTime();
        return dateB - dateA;
      });
      setHistorial(sorted);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      Alert.alert('Error', 'No se pudo cargar el historial');
    } finally {
      setLoadingHistorial(false);
    }
  };

  const cargarDesdeHistorial = (calculo: Calculo) => {
    setModalHistorialVisible(false);
    
    setTimeout(() => {
      let flujoEncontrado = flujos.find(f => f._id === calculo.flujo_id);
      if (!flujoEncontrado) {
        flujoEncontrado = flujos.find(f => f.nombre === calculo.flujo_nombre);
      }
      
      setSearchQuery(calculo.nombre_producto || '');
      setCostoBaseEditable((calculo.costo_base || 0).toString());
      setPrecioCalculado(calculo.precio_calculado || null);
      
      if (flujoEncontrado) {
        setSelectedFlujo(flujoEncontrado);
        const valores: Record<string, string> = {};
        flujoEncontrado.operaciones.forEach(op => {
          const valorGuardado = calculo.valores_operaciones?.[op.nombre];
          valores[op.nombre] = valorGuardado !== undefined ? valorGuardado.toString() : '0';
        });
        setValoresOperaciones(valores);
      }
      
      if (calculo.clientes && calculo.clientes.length > 0) {
        const clientesCargados = calculo.clientes.map(c => ({
          nombre: c.nombre || '',
          porcentaje_ganancia: (c.porcentaje_ganancia || 0).toString(),
          comentario: c.comentario || '',
          precio_final: c.precio_final || 0,
        }));
        setClientes(clientesCargados);
      } else {
        setClientes([]);
      }
      
      Alert.alert('Cargado', 'Datos cargados desde el historial');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 300);
  };

  const handleRefreshFlujos = async () => {
    await fetchFlujos();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        {/* Botones de acción rápida */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.quickActions}>
              <Button mode="outlined" onPress={abrirHistorial} icon="history" compact style={styles.quickButton}>
                Cargar Historial
              </Button>
              <Button mode="outlined" onPress={limpiarFormulario} icon="eraser" compact style={styles.quickButton}>
                Limpiar
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Búsqueda de Producto */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Producto</Text>
            <Searchbar
              placeholder="Buscar producto..."
              onChangeText={handleSearch}
              value={searchQuery}
              style={styles.searchbar}
              onFocus={() => scrollToInput(0)}
            />
            {loading && <ActivityIndicator style={styles.loader} />}
            {showResults && searchResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <ScrollView style={styles.resultsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {searchResults.map((producto) => (
                    <TouchableOpacity key={producto._id} onPress={() => selectProduct(producto)} style={styles.resultItem}>
                      <Text style={styles.resultTitle} numberOfLines={2}>{producto.nombre}</Text>
                      <Text style={styles.resultPrice}>${(producto.costo || 0).toLocaleString()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Costo Base Editable */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Costo Base</Text>
            <TextInput
              mode="outlined"
              label="Costo Base ($)"
              value={costoBaseEditable}
              onChangeText={(text) => { setCostoBaseEditable(text); resetPrecios(); }}
              keyboardType="numeric"
              style={styles.input}
              left={<TextInput.Affix text="$" />}
              onFocus={() => scrollToInput(150)}
            />
          </Card.Content>
        </Card>

        {/* Selector de Flujo */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Flujo de Cálculo</Text>
              <IconButton icon="refresh" size={20} onPress={handleRefreshFlujos} style={styles.refreshButton} />
            </View>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => { Keyboard.dismiss(); setModalFlujoVisible(true); }}>
              <Text style={styles.dropdownText} numberOfLines={1}>
                {selectedFlujo ? selectedFlujo.nombre : 'Seleccionar flujo'}
              </Text>
              <IconButton icon="chevron-down" size={20} style={styles.dropdownIcon} />
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Campos Dinámicos según Flujo */}
        {selectedFlujo && selectedFlujo.operaciones.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Valores de Operaciones</Text>
              {selectedFlujo.operaciones.map((operacion, index) => (
                <View key={`${operacion.nombre}-${index}`} style={styles.inputRow}>
                  <Text style={styles.inputLabel}>{operacion.nombre}</Text>
                  <Text style={styles.inputSubLabel}>{operacion.tipo_operacion} - {operacion.tipo_valor}</Text>
                  <TextInput
                    mode="outlined"
                    keyboardType="numeric"
                    value={valoresOperaciones[operacion.nombre] || '0'}
                    onChangeText={(text) => { setValoresOperaciones({ ...valoresOperaciones, [operacion.nombre]: text }); resetPrecios(); }}
                    style={styles.input}
                    dense
                    onFocus={() => scrollToInput(300 + index * 80)}
                  />
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* PRECIO CALCULADO - Antes de ganancia */}
        {precioCalculado !== null && (
          <Card style={[styles.card, styles.precioCalculadoCard]}>
            <Card.Content>
              <Text style={styles.precioCalculadoLabel}>Precio Calculado (Antes de Ganancia)</Text>
              <Text style={styles.precioCalculadoValor}>${precioCalculado.toLocaleString('es-CO')}</Text>
              <Text style={styles.precioCalculadoNota}>Este es el precio después de aplicar el flujo, sin ganancia de cliente</Text>
            </Card.Content>
          </Card>
        )}

        {/* Clientes */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Clientes</Text>
              <Button mode="contained" onPress={addCliente} icon="plus" compact>Agregar</Button>
            </View>
            
            {clientes.length === 0 && (
              <Text style={styles.emptyText}>No hay clientes. Presiona Agregar para comenzar.</Text>
            )}
            
            {clientes.map((cliente, index) => (
              <View key={index} style={styles.clienteCard}>
                <View style={styles.clienteHeader}>
                  <Text style={styles.clienteTitle}>Cliente {index + 1}</Text>
                  <IconButton icon="delete" size={20} iconColor="#d32f2f" onPress={() => removeCliente(index)} />
                </View>
                
                <TextInput
                  mode="outlined"
                  label="Nombre *"
                  value={cliente.nombre}
                  onChangeText={(text) => updateCliente(index, 'nombre', text)}
                  style={styles.inputSmall}
                  dense
                  onFocus={() => scrollToInput(500 + index * 200)}
                />
                
                <TextInput
                  mode="outlined"
                  label="Ganancia (%)"
                  keyboardType="numeric"
                  value={cliente.porcentaje_ganancia}
                  onChangeText={(text) => updateCliente(index, 'porcentaje_ganancia', text)}
                  style={styles.inputSmall}
                  dense
                  onFocus={() => scrollToInput(560 + index * 200)}
                />
                
                <TextInput
                  mode="outlined"
                  label="Comentario"
                  value={cliente.comentario}
                  onChangeText={(text) => updateCliente(index, 'comentario', text)}
                  style={styles.inputSmall}
                  multiline
                  numberOfLines={2}
                  dense
                  onFocus={() => scrollToInput(620 + index * 200)}
                />
                
                {cliente.precio_final > 0 && (
                  <View style={styles.resultadoBox}>
                    <Text style={styles.resultadoLabel}>Precio Final (con ganancia):</Text>
                    <Text style={styles.resultadoValor}>${cliente.precio_final.toLocaleString('es-CO')}</Text>
                  </View>
                )}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Botones */}
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={calcular}
            loading={calculando}
            disabled={parseFloat(costoBaseEditable) <= 0 || !selectedFlujo || clientes.length === 0 || calculando}
            style={styles.button}
            icon="calculator"
            contentStyle={styles.buttonContent}
          >
            Calcular Precios
          </Button>
          
          <Button
            mode="contained"
            onPress={guardar}
            loading={loading}
            disabled={clientes.length === 0 || !precioCalculado || loading}
            style={styles.button}
            icon="content-save"
            buttonColor="#4caf50"
            contentStyle={styles.buttonContent}
          >
            Guardar en Historial
          </Button>
        </View>

        <View style={[styles.bottomSpace, keyboardVisible && styles.keyboardSpace]} />
      </ScrollView>

      {/* Modal para seleccionar flujo */}
      <Modal visible={modalFlujoVisible} transparent animationType="slide" onRequestClose={() => setModalFlujoVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Flujo</Text>
              <IconButton icon="close" size={24} onPress={() => setModalFlujoVisible(false)} />
            </View>
            <Divider />
            <FlatList
              data={flujos}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, selectedFlujo?._id === item._id && styles.modalItemSelected]}
                  onPress={() => selectFlujo(item)}
                >
                  <View style={styles.modalItemContent}>
                    <Text style={[styles.modalItemText, selectedFlujo?._id === item._id && styles.modalItemTextSelected]} numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    <Text style={styles.modalItemSubtext}>{item.operaciones.length} operaciones</Text>
                  </View>
                  {selectedFlujo?._id === item._id && <IconButton icon="check" size={20} iconColor="#6200ee" />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No hay flujos creados.</Text></View>}
            />
          </View>
        </View>
      </Modal>

      {/* Modal para cargar desde historial */}
      <Modal visible={modalHistorialVisible} transparent animationType="slide" onRequestClose={() => setModalHistorialVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cargar desde Historial</Text>
              <IconButton icon="close" size={24} onPress={() => setModalHistorialVisible(false)} />
            </View>
            <Divider />
            {loadingHistorial ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#6200ee" />
                <Text style={styles.loaderText}>Cargando historial...</Text>
              </View>
            ) : (
              <FlatList
                data={historial}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.historialItem} onPress={() => cargarDesdeHistorial(item)}>
                    <View style={styles.historialInfo}>
                      <Text style={styles.historialProducto} numberOfLines={1}>{item.nombre_producto}</Text>
                      <Text style={styles.historialFlujo}>Flujo: {item.flujo_nombre}</Text>
                      <Text style={styles.historialCosto}>Costo Base: ${(item.costo_base || 0).toLocaleString()}</Text>
                      {item.precio_calculado && (
                        <Text style={styles.historialPrecioCalc}>Precio Calculado: ${item.precio_calculado.toLocaleString()}</Text>
                      )}
                      <Text style={styles.historialClientes}>
                        {item.clientes?.length || 0} cliente(s) - ${(item.clientes?.[0]?.precio_final || 0).toLocaleString()}
                      </Text>
                    </View>
                    <IconButton icon="chevron-right" size={24} iconColor="#6200ee" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No hay cálculos guardados.</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  card: { margin: 16, marginBottom: 8, elevation: 2, borderRadius: 12 },
  quickActions: { flexDirection: 'row', gap: 8 },
  quickButton: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  searchbar: { marginBottom: 8, elevation: 0, backgroundColor: '#f5f5f5' },
  loader: { marginVertical: 8 },
  resultsContainer: { maxHeight: 350, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', marginTop: 8 },
  resultsScroll: { maxHeight: 350 },
  resultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  resultTitle: { fontSize: 14, fontWeight: '500', color: '#333' },
  resultPrice: { fontSize: 12, color: '#6200ee', marginTop: 4 },
  dropdownButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minHeight: 48 },
  dropdownText: { fontSize: 16, color: '#333', flex: 1 },
  dropdownIcon: { margin: 0 },
  refreshButton: { margin: 0 },
  inputRow: { marginBottom: 16 },
  inputLabel: { fontSize: 15, fontWeight: '500', marginBottom: 2, color: '#333' },
  inputSubLabel: { fontSize: 12, color: '#666', marginBottom: 6 },
  input: { backgroundColor: '#fff' },
  inputSmall: { backgroundColor: '#fff', marginBottom: 8 },
  // Precio Calculado Card
  precioCalculadoCard: { backgroundColor: '#e3f2fd', borderColor: '#2196f3', borderWidth: 1 },
  precioCalculadoLabel: { fontSize: 14, color: '#1565c0', marginBottom: 4 },
  precioCalculadoValor: { fontSize: 28, fontWeight: 'bold', color: '#0d47a1' },
  precioCalculadoNota: { fontSize: 11, color: '#1976d2', marginTop: 4, fontStyle: 'italic' },
  // Clientes
  clienteCard: { backgroundColor: '#fafafa', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  clienteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clienteTitle: { fontSize: 16, fontWeight: 'bold', color: '#6200ee' },
  resultadoBox: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, marginTop: 8 },
  resultadoLabel: { fontSize: 12, color: '#2e7d32', marginBottom: 4 },
  resultadoValor: { fontSize: 20, fontWeight: 'bold', color: '#1b5e20' },
  emptyText: { textAlign: 'center', color: '#999', paddingVertical: 16, fontSize: 14 },
  buttonContainer: { padding: 16, gap: 12 },
  button: { borderRadius: 8 },
  buttonContent: { paddingVertical: 6 },
  bottomSpace: { height: 32 },
  keyboardSpace: { height: 150 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalItemSelected: { backgroundColor: '#f0e6ff' },
  modalItemContent: { flex: 1 },
  modalItemText: { fontSize: 16, color: '#333' },
  modalItemTextSelected: { color: '#6200ee', fontWeight: '500' },
  modalItemSubtext: { fontSize: 12, color: '#666', marginTop: 2 },
  emptyContainer: { padding: 32, alignItems: 'center' },
  loaderContainer: { padding: 40, alignItems: 'center' },
  loaderText: { marginTop: 12, color: '#666' },
  // Historial
  historialItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  historialInfo: { flex: 1, paddingRight: 8 },
  historialProducto: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  historialFlujo: { fontSize: 13, color: '#6200ee', marginTop: 2 },
  historialCosto: { fontSize: 13, color: '#666', marginTop: 2 },
  historialPrecioCalc: { fontSize: 13, color: '#1565c0', marginTop: 2, fontWeight: '500' },
  historialClientes: { fontSize: 13, color: '#2e7d32', marginTop: 2 },
});
