import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  IconButton,
  Card,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { flujosApi } from '../services/api';
import { Flujo, Operacion } from '../types/types';
import { useStore } from '../store/store';

export default function FlowsScreen() {
  const { flujos, fetchFlujos, addFlujo, updateFlujoInStore, removeFlujo, flujosLoading } = useStore();
  
  const [selectedFlujo, setSelectedFlujo] = useState<Flujo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [nombreFlujo, setNombreFlujo] = useState('');
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);

  useEffect(() => {
    loadFlujos();
  }, []);

  const loadFlujos = async () => {
    await fetchFlujos();
  };

  useEffect(() => {
    if (flujos.length > 0 && !selectedFlujo) {
      selectFlujo(flujos[0]);
    }
  }, [flujos]);

  const selectFlujo = useCallback((flujo: Flujo) => {
    setSelectedFlujo(flujo);
    setNombreFlujo(flujo.nombre);
    setOperaciones(flujo.operaciones.map(op => ({ ...op })));
    setModalVisible(false);
  }, []);

  const nuevoFlujo = () => {
    setSelectedFlujo(null);
    setNombreFlujo('Nuevo Flujo');
    setOperaciones([]);
  };

  const borrarFlujo = async () => {
    if (!selectedFlujo) {
      Alert.alert('Error', 'Selecciona un flujo para borrar');
      return;
    }

    Alert.alert(
      'Confirmar',
      `¿Estás seguro de borrar el flujo "${selectedFlujo.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await flujosApi.delete(selectedFlujo._id);
              removeFlujo(selectedFlujo._id);
              Alert.alert('Éxito', 'Flujo eliminado');
              nuevoFlujo();
            } catch (error) {
              console.error('Error al borrar flujo:', error);
              Alert.alert('Error', 'No se pudo borrar el flujo');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const guardarFlujo = async () => {
    if (!nombreFlujo.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el flujo');
      return;
    }

    if (operaciones.length === 0) {
      Alert.alert('Error', 'Agrega al menos una operación');
      return;
    }

    try {
      setSaving(true);
      const flujoData = {
        nombre: nombreFlujo.trim(),
        operaciones: operaciones.map((op, index) => ({
          nombre: op.nombre,
          tipo_operacion: op.tipo_operacion,
          tipo_valor: op.tipo_valor,
          orden: index,
        })),
      };

      if (selectedFlujo) {
        await flujosApi.update(selectedFlujo._id, flujoData);
        const updatedFlujo: Flujo = {
          ...selectedFlujo,
          ...flujoData,
          operaciones: flujoData.operaciones,
        };
        updateFlujoInStore(updatedFlujo);
        setSelectedFlujo(updatedFlujo);
        Alert.alert('Éxito', 'Flujo actualizado correctamente');
      } else {
        const response = await flujosApi.create(flujoData);
        const newFlujo = response.data;
        addFlujo(newFlujo);
        setSelectedFlujo(newFlujo);
        Alert.alert('Éxito', 'Flujo creado correctamente');
      }
    } catch (error) {
      console.error('Error al guardar flujo:', error);
      Alert.alert('Error', 'No se pudo guardar el flujo');
    } finally {
      setSaving(false);
    }
  };

  const agregarOperacion = useCallback(() => {
    setOperaciones(prevOps => {
      const nuevaOperacion: Operacion = {
        nombre: `Operación ${prevOps.length + 1}`,
        tipo_operacion: 'Sumar',
        tipo_valor: 'Porcentaje',
        orden: prevOps.length,
      };
      return [...prevOps, nuevaOperacion];
    });
  }, []);

  const actualizarOperacion = useCallback((index: number, field: keyof Operacion, value: string) => {
    setOperaciones(prevOps => {
      const nuevasOperaciones = [...prevOps];
      nuevasOperaciones[index] = {
        ...nuevasOperaciones[index],
        [field]: value,
      };
      return nuevasOperaciones;
    });
  }, []);

  // FIXED: Direct delete without Alert for better UX
  const eliminarOperacion = useCallback((index: number) => {
    if (Platform.OS === 'web') {
      // On web, just delete directly
      setOperaciones(prevOps => prevOps.filter((_, i) => i !== index));
    } else {
      Alert.alert(
        'Confirmar',
        '¿Eliminar esta operación?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => {
              setOperaciones(prevOps => prevOps.filter((_, i) => i !== index));
            }
          },
        ]
      );
    }
  }, []);

  const moverOperacion = useCallback((index: number, direccion: 'arriba' | 'abajo') => {
    setOperaciones(prevOps => {
      if (
        (direccion === 'arriba' && index === 0) ||
        (direccion === 'abajo' && index === prevOps.length - 1)
      ) {
        return prevOps;
      }

      const nuevasOperaciones = [...prevOps];
      const newIndex = direccion === 'arriba' ? index - 1 : index + 1;
      [nuevasOperaciones[index], nuevasOperaciones[newIndex]] = [
        nuevasOperaciones[newIndex],
        nuevasOperaciones[index],
      ];
      return nuevasOperaciones;
    });
  }, []);

  const ciclaTipoOperacion = useCallback((index: number) => {
    const tipos: Array<Operacion['tipo_operacion']> = ['Sumar', 'Restar', 'Multiplicar', 'Dividir'];
    setOperaciones(prevOps => {
      const nuevasOperaciones = [...prevOps];
      const currentIndex = tipos.indexOf(nuevasOperaciones[index].tipo_operacion);
      const nextIndex = (currentIndex + 1) % tipos.length;
      nuevasOperaciones[index] = {
        ...nuevasOperaciones[index],
        tipo_operacion: tipos[nextIndex],
      };
      return nuevasOperaciones;
    });
  }, []);

  const ciclaTipoValor = useCallback((index: number) => {
    setOperaciones(prevOps => {
      const nuevasOperaciones = [...prevOps];
      const nuevoTipo = nuevasOperaciones[index].tipo_valor === 'Porcentaje' ? 'Número' : 'Porcentaje';
      nuevasOperaciones[index] = {
        ...nuevasOperaciones[index],
        tipo_valor: nuevoTipo,
      };
      return nuevasOperaciones;
    });
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Flujo Actual</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.dropdownText}>
                {selectedFlujo ? selectedFlujo.nombre : 'Seleccionar flujo'}
              </Text>
              <IconButton icon="chevron-down" size={20} style={styles.dropdownIcon} />
            </TouchableOpacity>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={nuevoFlujo}
                style={styles.actionButton}
                icon="plus"
                compact
              >
                Nuevo
              </Button>
              <Button
                mode="contained"
                onPress={borrarFlujo}
                style={styles.actionButton}
                buttonColor="#d32f2f"
                icon="delete"
                disabled={!selectedFlujo || saving}
                compact
              >
                Borrar
              </Button>
              <Button
                mode="contained"
                onPress={guardarFlujo}
                style={styles.actionButton}
                loading={saving}
                icon="content-save"
                disabled={saving}
                compact
              >
                Guardar
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Nombre del Flujo *</Text>
            <TextInput
              mode="outlined"
              value={nombreFlujo}
              onChangeText={setNombreFlujo}
              placeholder="Ej: Cálculo con IVA"
              style={styles.input}
              dense
            />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Operaciones ({operaciones.length})</Text>
              <Button
                mode="contained"
                onPress={agregarOperacion}
                icon="plus"
                compact
              >
                Agregar
              </Button>
            </View>

            {operaciones.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No hay operaciones aún</Text>
                <Text style={styles.emptySubText}>Presiona Agregar para crear una</Text>
              </View>
            ) : (
              operaciones.map((operacion, index) => (
                <View key={`op-${index}`} style={styles.operacionCard}>
                  <View style={styles.operacionHeader}>
                    <Text style={styles.operacionNumero}>Operación {index + 1}</Text>
                    <View style={styles.operacionButtons}>
                      <IconButton
                        icon="arrow-up"
                        size={20}
                        onPress={() => moverOperacion(index, 'arriba')}
                        disabled={index === 0}
                        style={styles.iconBtn}
                      />
                      <IconButton
                        icon="arrow-down"
                        size={20}
                        onPress={() => moverOperacion(index, 'abajo')}
                        disabled={index === operaciones.length - 1}
                        style={styles.iconBtn}
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => eliminarOperacion(index)}
                        iconColor="#d32f2f"
                        style={styles.iconBtn}
                      />
                    </View>
                  </View>

                  <TextInput
                    mode="outlined"
                    label="Nombre de la operación"
                    value={operacion.nombre}
                    onChangeText={(text) => actualizarOperacion(index, 'nombre', text)}
                    style={styles.inputSmall}
                    dense
                  />

                  <View style={styles.row}>
                    <Button
                      mode="outlined"
                      onPress={() => ciclaTipoOperacion(index)}
                      style={styles.halfButton}
                      compact
                    >
                      {operacion.tipo_operacion}
                    </Button>

                    <Button
                      mode="outlined"
                      onPress={() => ciclaTipoValor(index)}
                      style={styles.halfButton}
                      compact
                    >
                      {operacion.tipo_valor}
                    </Button>
                  </View>
                  <Text style={styles.helpText}>Toca los botones para cambiar el tipo</Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Flujo</Text>
              <IconButton
                icon="close"
                size={24}
                onPress={() => setModalVisible(false)}
              />
            </View>
            <Divider />
            {flujosLoading ? (
              <ActivityIndicator style={styles.loader} size="large" />
            ) : (
              <FlatList
                data={flujos}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      selectedFlujo?._id === item._id && styles.modalItemSelected
                    ]}
                    onPress={() => selectFlujo(item)}
                  >
                    <View style={styles.modalItemContent}>
                      <Text style={[
                        styles.modalItemText,
                        selectedFlujo?._id === item._id && styles.modalItemTextSelected
                      ]}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.modalItemSubtext}>
                        {item.operaciones.length} operaciones
                      </Text>
                    </View>
                    {selectedFlujo?._id === item._id && (
                      <IconButton icon="check" size={20} iconColor="#6200ee" />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No hay flujos creados</Text>
                    <Text style={styles.emptySubText}>Presiona Nuevo para crear uno</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#666',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#fff',
  },
  inputSmall: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownIcon: {
    margin: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  emptySubText: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  operacionCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  operacionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  operacionNumero: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  operacionButtons: {
    flexDirection: 'row',
  },
  iconBtn: {
    margin: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfButton: {
    flex: 1,
  },
  helpText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  bottomSpace: {
    height: 32,
  },
  loader: {
    marginVertical: 32,
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
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemSelected: {
    backgroundColor: '#f0e6ff',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalItemTextSelected: {
    color: '#6200ee',
    fontWeight: '500',
  },
  modalItemSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
