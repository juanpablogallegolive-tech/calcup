import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import {
  Text,
  Searchbar,
  Card,
  ActivityIndicator,
  Button,
  IconButton,
  Portal,
  Modal,
} from 'react-native-paper';
import { calculosApi } from '../services/api';
import { Calculo } from '../types/types';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useDebounceValue } from '../hooks/useDebounce';

export default function HistoryScreen() {
  const router = useRouter();
  const [calculos, setCalculos] = useState<Calculo[]>([]);
  const [displayedCalculos, setDisplayedCalculos] = useState<Calculo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCalculo, setSelectedCalculo] = useState<Calculo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ⚡ Perf: debounce del filtro local
  const debouncedSearch = useDebounceValue(searchQuery, 250);

  useEffect(() => {
    loadCalculos();
  }, []);

  useEffect(() => {
    filterCalculos();
  }, [debouncedSearch, calculos]);

  const loadCalculos = async () => {
    try {
      setLoading(true);
      const response = await calculosApi.getAll();
      setCalculos(response.data);
    } catch (error) {
      console.error('Error al cargar cálculos:', error);
      Alert.alert('Error', 'No se pudieron cargar los cálculos');
    } finally {
      setLoading(false);
    }
  };

  const filterCalculos = () => {
    if (debouncedSearch.trim() === '') {
      setDisplayedCalculos(calculos);
    } else {
      const q = debouncedSearch.toLowerCase();
      const filtered = calculos.filter((c) =>
        c.nombre_producto.toLowerCase().includes(q)
      );
      setDisplayedCalculos(filtered);
    }
  };

  const verDetalle = (calculo: Calculo) => {
    setSelectedCalculo(calculo);
    setModalVisible(true);
  };

  const eliminarCalculo = async (calculoId: string) => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de que quieres eliminar este cálculo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await calculosApi.delete(calculoId);
              Alert.alert('Éxito', 'Cálculo eliminado');
              loadCalculos();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el cálculo');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Fecha desconocida';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch {
      return 'Fecha inválida';
    }
  };

  // ⚡ Perf: memoizar renderCalculo con useCallback
  const renderCalculo = useCallback(({ item }: { item: Calculo }) => (
    <Card style={styles.card} onPress={() => verDetalle(item)}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.nombre}>{item.nombre_producto}</Text>
            <Text style={styles.flujo}>Flujo: {item.flujo_nombre}</Text>
            <Text style={styles.fecha}>{formatDate(item.fecha)}</Text>
            {item.clientes.length > 0 && (
              <Text style={styles.precio}>
                Precio: ${item.clientes[0].precio_final.toLocaleString()}
              </Text>
            )}
          </View>
          <IconButton
            icon="delete"
            size={20}
            onPress={() => eliminarCalculo(item._id)}
          />
        </View>
      </Card.Content>
    </Card>
  ), []);

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Buscar por producto..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {loading && calculos.length === 0 ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={displayedCalculos}
          renderItem={renderCalculo}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay cálculos guardados</Text>
          }
        />
      )}

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          {selectedCalculo && (
            <View>
              <Text style={styles.modalTitle}>Detalle del Cálculo</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Producto:</Text>
                <Text style={styles.detailValue}>{selectedCalculo.nombre_producto}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Flujo:</Text>
                <Text style={styles.detailValue}>{selectedCalculo.flujo_nombre}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Fecha:</Text>
                <Text style={styles.detailValue}>{formatDate(selectedCalculo.fecha)}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Costo Base:</Text>
                <Text style={styles.detailValue}>${(selectedCalculo.costo_base || 0).toLocaleString()}</Text>
              </View>

              <Text style={styles.clientesTitle}>Clientes:</Text>
              {selectedCalculo.clientes.map((cliente, index) => (
                <View key={index} style={styles.clienteBox}>
                  <Text style={styles.clienteNombre}>{cliente.nombre}</Text>
                  <Text style={styles.clienteGanancia}>Ganancia: {cliente.porcentaje_ganancia}%</Text>
                  <Text style={styles.clientePrecio}>Precio: ${cliente.precio_final.toLocaleString()}</Text>
                  {cliente.comentario && (
                    <Text style={styles.clienteComentario}>{cliente.comentario}</Text>
                  )}
                </View>
              ))}

              <Button
                mode="contained"
                onPress={() => {
                  setModalVisible(false);
                  // Navigate to calculator and pass data
                  router.push({
                    pathname: '/calculator',
                    params: { calculoId: selectedCalculo._id }
                  });
                }}
                style={styles.modalButton}
                icon="calculator"
              >
                Cargar en Calculadora
              </Button>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchbar: {
    margin: 16,
  },
  loader: {
    marginTop: 50,
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
  },
  nombre: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  flujo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  fecha: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  precio: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 50,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
  clientesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  clienteBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  clienteNombre: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  clienteGanancia: {
    fontSize: 12,
    color: '#666',
  },
  clientePrecio: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: 'bold',
    marginTop: 4,
  },
  clienteComentario: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalButton: {
    marginTop: 16,
  },
});
