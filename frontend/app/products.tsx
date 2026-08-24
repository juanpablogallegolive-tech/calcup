import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Searchbar,
  FAB,
  IconButton,
  ActivityIndicator,
  Divider,
  Chip,
  Checkbox,
} from 'react-native-paper';
import { productosApi } from '../services/api';
import { Producto } from '../types/types';
import { useDebounceValue } from '../hooks/useDebounce';
import { smartSearch } from '../services/smartSearch';

export default function ProductsScreen() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalProductos, setTotalProductos] = useState(0);
  
  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [costo, setCosto] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [saving, setSaving] = useState(false);

  // ⚡ Perf: debounce del filtro local para no re-filtrar en cada tecla
  const debouncedSearch = useDebounceValue(searchQuery, 250);

  useEffect(() => {
    loadProductos();
  }, []);

  useEffect(() => {
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      const filtered = productos.filter(p =>
        p.nombre.toLowerCase().includes(q)
      );
      setFilteredProductos(filtered);
    } else {
      setFilteredProductos(productos);
    }
  }, [debouncedSearch, productos]);

  const loadProductos = async () => {
    try {
      setLoading(true);
      // Cargar TODOS los productos (sin límite)
      const response = await productosApi.getAll();
      const productosData = response.data;
      setProductos(productosData);
      setFilteredProductos(productosData);
      setTotalProductos(productosData.length);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      Alert.alert('Error', 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProductos();
    setRefreshing(false);
  }, []);

  const openNewProduct = () => {
    setEditingProduct(null);
    setNombre('');
    setCosto('');
    setPrecioVenta('');
    setCantidad('');
    setComentarios('');
    setModalVisible(true);
  };

  const openEditProduct = (producto: Producto) => {
    setEditingProduct(producto);
    setNombre(producto.nombre);
    setCosto((producto.costo || 0).toString());
    setPrecioVenta((producto.precio_venta || 0).toString());
    setCantidad((producto.cantidad || '').toString());
    setComentarios(producto.comentarios || '');
    setModalVisible(true);
  };

  const saveProduct = async () => {
    if (!nombre.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el producto');
      return;
    }

    const costoVal = parseFloat(costo) || 0;
    const precioVentaVal = parseFloat(precioVenta) || 0;

    try {
      setSaving(true);

      if (editingProduct) {
        const precioAnterior = editingProduct.precio_venta || 0;
        let nuevoComentario = comentarios;
        
        if (precioAnterior !== precioVentaVal && precioAnterior > 0) {
          const fecha = new Date().toLocaleDateString('es-CO');
          nuevoComentario = `${comentarios}\n[Precio actualizado: $${precioAnterior.toLocaleString()} → $${precioVentaVal.toLocaleString()} el ${fecha}]`.trim();
        }

        await productosApi.update(editingProduct._id, {
          nombre: nombre.trim(),
          costo: costoVal,
          precio_venta: precioVentaVal,
          cantidad: cantidad,
          comentarios: nuevoComentario,
        });
        Alert.alert('Éxito', 'Producto actualizado');
      } else {
        await productosApi.create({
          nombre: nombre.trim(),
          costo: costoVal,
          precio_venta: precioVentaVal,
          cantidad: cantidad,
          comentarios,
        });
        Alert.alert('Éxito', 'Producto creado');
      }

      // Invalidar cache y recargar smartSearch
      smartSearch.invalidarCache();
      await smartSearch.inicializar(true);

      setModalVisible(false);
      loadProductos();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      Alert.alert('Error', 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = (producto: Producto) => {
    if (Platform.OS === 'web') {
      handleDelete(producto);
    } else {
      Alert.alert(
        'Confirmar Eliminación',
        `¿Estás seguro de eliminar "${producto.nombre}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => handleDelete(producto),
          },
        ]
      );
    }
  };

  const handleDelete = async (producto: Producto) => {
    try {
      await productosApi.delete(producto._id);
      
      // Invalidar cache y recargar smartSearch
      smartSearch.invalidarCache();
      await smartSearch.inicializar(true);

      Alert.alert('Éxito', 'Producto eliminado');
      loadProductos();
    } catch (error) {
      Alert.alert('Error', 'No se pudo eliminar el producto');
    }
  };

  const formatPrice = (price: number) => {
    return '$' + price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // ----- Borrado Completo y Selección Múltiple -----
  const cancelSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  const handleLongPressProduct = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleBorrarTodo = () => {
    if (Platform.OS === 'web') {
      const confirm1 = window.confirm('¿Desea borrar todos los productos?');
      if (confirm1) {
        const confirm2 = window.confirm('Esta acción eliminará permanentemente todos los productos del catálogo. No podrá deshacerse. ¿Está completamente seguro?');
        if (confirm2) {
          ejecutarBorrarTodo();
        }
      }
    } else {
      Alert.alert(
        '⚠️ ¿Borrar TODOS los productos?',
        'Esta acción eliminará de forma permanente todos los productos de la base de datos. No se puede deshacer.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                '🚨 Confirmación Final',
                '¿Estás ABSOLUTAMENTE seguro de borrar la base de datos? Se eliminarán todos los productos en todos los dispositivos.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Confirmar Borrado',
                    style: 'destructive',
                    onPress: ejecutarBorrarTodo,
                  },
                ]
              );
            },
          },
        ]
      );
    }
  };

  const ejecutarBorrarTodo = async () => {
    try {
      setLoading(true);
      await productosApi.deleteAll();
      
      smartSearch.invalidarCache();
      await smartSearch.inicializar(true);

      Alert.alert('Éxito', 'Todos los productos han sido eliminados.');
      setProductos([]);
      setFilteredProductos([]);
      setTotalProductos(0);
      cancelSelection();
    } catch (error) {
      console.error('Error al borrar todos los productos:', error);
      Alert.alert('Error', 'No se pudieron borrar los productos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm(`¿Desea eliminar los ${selectedIds.size} productos seleccionados?`);
      if (confirmDelete) {
        ejecutarBorrarSeleccionados();
      }
    } else {
      Alert.alert(
        'Confirmar Eliminación',
        `¿Desea eliminar los ${selectedIds.size} productos seleccionados?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: ejecutarBorrarSeleccionados,
          },
        ]
      );
    }
  };

  const ejecutarBorrarSeleccionados = async () => {
    try {
      setLoading(true);
      const idsArray = Array.from(selectedIds);
      await productosApi.deleteMultiple(idsArray);
      
      smartSearch.invalidarCache();
      await smartSearch.inicializar(true);

      Alert.alert('Éxito', 'Productos eliminados');
      cancelSelection();
      loadProductos();
    } catch (error) {
      console.error('Error al borrar productos seleccionados:', error);
      Alert.alert('Error', 'No se pudieron eliminar los productos seleccionados');
    } finally {
      setLoading(false);
    }
  };
  // -------------------------------------------------

  // ⚡ Perf: memoizar renderProduct con useCallback para evitar re-creación en cada render
  const renderProduct = useCallback(({ item, index }: { item: Producto; index: number }) => {
    const isSelected = selectedIds.has(item._id);
    const hasUpdate = item.comentarios?.includes('[Precio actualizado') || 
                      item.comentarios?.includes('[Actualizado desde Excel');
    
    return (
      <Card style={[styles.productCard, isSelected && styles.selectedProductCard]}>
        <TouchableOpacity 
          onPress={() => {
            if (isSelectionMode) {
              toggleSelectProduct(item._id);
            } else {
              openEditProduct(item);
            }
          }}
          onLongPress={() => {
            if (!isSelectionMode) {
              handleLongPressProduct(item._id);
            }
          }}
          delayLongPress={300}
          activeOpacity={0.7}
        >
          <Card.Content style={styles.cardContent}>
            {isSelectionMode && (
              <View style={styles.checkboxContainer}>
                <Checkbox.Android
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => toggleSelectProduct(item._id)}
                  color="#6200ee"
                />
              </View>
            )}
            <View style={styles.productMain}>
              <View style={styles.indexBadge}>
                <Text style={styles.indexText}>{index + 1}</Text>
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2} ellipsizeMode="tail">
                  {item.nombre}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Costo:</Text>
                  <Text style={styles.productOriginal}>
                    {formatPrice(item.costo || 0)}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Venta:</Text>
                  <Text style={styles.productPrice}>
                    {formatPrice(item.precio_venta || 0)}
                  </Text>
                </View>
                {hasUpdate && (
                  <Chip 
                    mode="flat" 
                    style={styles.updateChip}
                    textStyle={styles.updateChipText}
                    compact
                  >
                    Actualizado
                  </Chip>
                )}
              </View>
            </View>
            {!isSelectionMode && (
              <View style={styles.productActions}>
                <IconButton
                  icon="pencil"
                  size={22}
                  iconColor="#6200ee"
                  onPress={() => openEditProduct(item)}
                  style={styles.actionBtn}
                />
                <IconButton
                  icon="delete"
                  size={22}
                  iconColor="#d32f2f"
                  onPress={() => deleteProduct(item)}
                  style={styles.actionBtn}
                />
              </View>
            )}
          </Card.Content>
        </TouchableOpacity>
      </Card>
    );
  }, [selectedIds, isSelectionMode]);

  return (
    <View style={styles.container}>
      {/* Header con búsqueda o barra de selección */}
      {isSelectionMode ? (
        <View style={styles.selectionHeader}>
          <View style={styles.selectionInfo}>
            <IconButton icon="close" size={24} iconColor="#6200ee" onPress={cancelSelection} />
            <Text style={styles.selectionTitle}>{selectedIds.size} seleccionados</Text>
          </View>
          <Button mode="text" textColor="#d32f2f" icon="delete" onPress={handleDeleteSelected}>
            Eliminar
          </Button>
        </View>
      ) : (
        <View style={styles.header}>
          <Searchbar
            placeholder="Buscar producto..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
            inputStyle={styles.searchInput}
          />
          <View style={styles.statsRow}>
            <Chip mode="outlined" style={styles.statChip}>
              Total: {totalProductos}
            </Chip>
            <Chip mode="outlined" style={styles.statChip}>
              Mostrando: {filteredProductos.length}
            </Chip>
            <IconButton
              icon="refresh"
              size={20}
              onPress={loadProductos}
              disabled={loading}
            />
            <IconButton
              icon="trash-can"
              size={20}
              iconColor="#d32f2f"
              onPress={handleBorrarTodo}
              disabled={loading}
              style={{ marginLeft: -4 }}
            />
          </View>
        </View>
      )}

      {/* Lista de productos */}
      {loading && !refreshing && productos.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProductos}
          keyExtractor={(item) => item._id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6200ee']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconButton icon="package-variant" size={60} iconColor="#ccc" />
              <Text style={styles.emptyText}>No hay productos</Text>
              <Text style={styles.emptySubText}>
                {searchQuery ? 'No se encontraron resultados' : 'Presiona + para agregar uno nuevo'}
              </Text>
            </View>
          }
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews={true}
        />
      )}

      {/* FAB para agregar */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openNewProduct}
        color="#fff"
      />

      {/* Modal para editar/crear producto */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setModalVisible(false)}
              />
            </View>
            <Divider />
            
            <View style={styles.modalBody}>
              <TextInput
                mode="outlined"
                label="Nombre del producto *"
                value={nombre}
                onChangeText={setNombre}
                style={styles.input}
                outlineColor="#ccc"
                activeOutlineColor="#6200ee"
              />
              
              <View style={styles.priceInputRow}>
                <TextInput
                  mode="outlined"
                  label="Costo"
                  value={costo}
                  onChangeText={setCosto}
                  keyboardType="numeric"
                  style={[styles.input, styles.halfInput]}
                  left={<TextInput.Affix text="$" />}
                  outlineColor="#ccc"
                  activeOutlineColor="#6200ee"
                />
                
                <TextInput
                  mode="outlined"
                  label="Precio Venta"
                  value={precioVenta}
                  onChangeText={setPrecioVenta}
                  keyboardType="numeric"
                  style={[styles.input, styles.halfInput]}
                  left={<TextInput.Affix text="$" />}
                  outlineColor="#ccc"
                  activeOutlineColor="#6200ee"
                />
              </View>

              <TextInput
                mode="outlined"
                label="Cantidad en Stock"
                value={cantidad}
                onChangeText={setCantidad}
                keyboardType="numeric"
                style={styles.input}
                outlineColor="#ccc"
                activeOutlineColor="#6200ee"
              />
              
              <TextInput
                mode="outlined"
                label="Comentarios"
                value={comentarios}
                onChangeText={setComentarios}
                multiline
                numberOfLines={3}
                style={styles.input}
                outlineColor="#ccc"
                activeOutlineColor="#6200ee"
              />

              {editingProduct && (editingProduct.precio_venta || 0) !== parseFloat(precioVenta) && precioVenta && (
                <View style={styles.priceChangeWarning}>
                  <IconButton icon="alert" size={18} iconColor="#ff9800" />
                  <Text style={styles.warningText}>
                    El precio de venta será actualizado y se registrará el cambio
                  </Text>
                </View>
              )}

              <Button
                mode="contained"
                onPress={saveProduct}
                loading={saving}
                disabled={saving || !nombre.trim()}
                style={styles.saveButton}
                contentStyle={styles.saveButtonContent}
              >
                {editingProduct ? 'Actualizar Producto' : 'Crear Producto'}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchbar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  searchInput: {
    fontSize: 15,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  statChip: {
    height: 28,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  productCard: {
    marginBottom: 8,
    elevation: 2,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  productMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6200ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  indexText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productInfo: {
    flex: 1,
    paddingRight: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: '#888',
    marginRight: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#6200ee',
    fontWeight: '600',
  },
  productOriginal: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  updateChip: {
    backgroundColor: '#fff3e0',
    marginTop: 6,
    alignSelf: 'flex-start',
    height: 24,
  },
  updateChipText: {
    fontSize: 10,
    color: '#ff9800',
  },
  productActions: {
    flexDirection: 'column',
  },
  actionBtn: {
    margin: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#6200ee',
    borderRadius: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  priceInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  priceChangeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#f57c00',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  saveButtonContent: {
    paddingVertical: 6,
  },
  selectedProductCard: {
    backgroundColor: '#f1e6ff',
    borderColor: '#6200ee',
    borderWidth: 1,
  },
  checkboxContainer: {
    justifyContent: 'center',
    marginRight: 8,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6200ee',
    marginLeft: 8,
  },
});
