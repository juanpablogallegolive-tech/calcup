import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput as RNTextInput,
  Modal,
  FlatList,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  IconButton,
  ActivityIndicator,
  Divider,
  TextInput,
  Searchbar,
  ProgressBar,
} from 'react-native-paper';
import { matchProductoIndividual, guardarAprendizaje } from '../services/api';
import { smartSearch } from '../services/smartSearch';
import { Producto } from '../types/types';
import { useDebouncedCallback } from '../hooks/useDebounce';

interface ProductoMatch {
  nombre_original: string;
  nombre_editado: string;
  producto_sugerido: Producto | null;
  score: number;
  sospechoso: boolean;
  aprendido?: boolean;
  modificado?: boolean;
  noEncontrado?: boolean;
  analizando?: boolean; // Para spinner individual
}

interface Props {
  onProductosSeleccionados: (productos: Array<{ producto: Producto; cantidad: number }>) => void;
  onClose: () => void;
  visible: boolean;
}

export default function LectorTexto({ onProductosSeleccionados, onClose, visible }: Props) {
  const [step, setStep] = useState<'input' | 'edit' | 'result'>('input');
  const [textoCapturado, setTextoCapturado] = useState('');
  const [lineasTexto, setLineasTexto] = useState<string[]>([]);
  const [matches, setMatches] = useState<ProductoMatch[]>([]);
  
  // Cola de procesamiento asíncrona
  const [colaProcesando, setColaProcesando] = useState(false);
  const [colaPausada, setColaPausada] = useState(false);
  const [progresoCola, setProgresoCola] = useState({ actual: 0, total: 0, nombreActual: '' });
  
  const detenerColaRef = useRef(false);
  const pausarColaRef = useRef(false);

  // Para cambiar producto
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Producto[]>([]);

  // Limpieza al cerrar
  useEffect(() => {
    if (!visible) {
      detenerCola();
    }
  }, [visible]);

  const detenerCola = () => {
    detenerColaRef.current = true;
    pausarColaRef.current = false;
    setColaProcesando(false);
    setColaPausada(false);
  };

  const pausarOReanudarCola = () => {
    if (colaPausada) {
      pausarColaRef.current = false;
      setColaPausada(false);
    } else {
      pausarColaRef.current = true;
      setColaPausada(true);
    }
  };

  const resetear = () => {
    detenerCola();
    setStep('input');
    setTextoCapturado('');
    setLineasTexto([]);
    setMatches([]);
    setProgresoCola({ actual: 0, total: 0, nombreActual: '' });
    setEditandoIndex(null);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
  };

  const cerrarLector = () => {
    detenerCola();
    onClose();
  };

  // Helper para ceder ejecución al event loop de React Native (0 congelamiento de UI)
  const cederEventLoop = (ms: number = 10) => new Promise(resolve => setTimeout(resolve, ms));

  // Búsqueda interna debounced para cambiar producto manualmente
  const ejecutarBusqueda = useDebouncedCallback(async (query: string) => {
    if (query.trim().length >= 1) {
      try {
        const resultados = await smartSearch.buscar(query, 20);
        setResultadosBusqueda(resultados);
      } catch (error) {
        console.error('Error buscando producto manual:', error);
      }
    } else {
      setResultadosBusqueda([]);
    }
  }, 200);

  const buscarProductoParaCambiar = (query: string) => {
    setBusquedaProducto(query);
    ejecutarBusqueda(query);
  };

  // Cambiar producto manualmente y guardar aprendizaje
  const cambiarProducto = async (index: number, nuevoProducto: Producto) => {
    const match = matches[index];
    if (!match) return;

    smartSearch.registrarAprendizajeLocal(
      match.nombre_original, nuevoProducto._id, nuevoProducto.nombre
    );

    try {
      await guardarAprendizaje({
        nombre_original: match.nombre_original,
        producto_id_correcto: nuevoProducto._id,
        nombre_producto_correcto: nuevoProducto.nombre,
      });
    } catch (error) {
      console.error('Error guardando aprendizaje en servidor:', error);
    }

    setMatches(prev => {
      const copy = [...prev];
      copy[index] = {
        ...match,
        producto_sugerido: nuevoProducto,
        nombre_editado: nuevoProducto.nombre,
        score: 1.0,
        sospechoso: false,
        aprendido: true,
        modificado: true,
        analizando: false,
        noEncontrado: false,
      };
      return copy;
    });

    setEditandoIndex(null);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
  };

  // Confirmar sugerencia del analizador
  const confirmarSugerencia = async (index: number) => {
    const match = matches[index];
    if (!match || !match.producto_sugerido) return;

    smartSearch.registrarAprendizajeLocal(
      match.nombre_original, match.producto_sugerido._id, match.producto_sugerido.nombre
    );

    try {
      await guardarAprendizaje({
        nombre_original: match.nombre_original,
        producto_id_correcto: match.producto_sugerido._id,
        nombre_producto_correcto: match.producto_sugerido.nombre,
      });
    } catch (error) {
      console.error('Error confirmando aprendizaje en servidor:', error);
    }

    setMatches(prev => {
      const copy = [...prev];
      copy[index] = {
        ...match,
        sospechoso: false,
        aprendido: true,
      };
      return copy;
    });
  };

  const saltarProducto = (index: number) => {
    setMatches(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        producto_sugerido: null,
        sospechoso: false,
        noEncontrado: true,
        analizando: false,
      };
      return copy;
    });
    setEditandoIndex(null);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
  };

  // 1. Capacidad Masiva: Procesar texto de entrada sin límite
  const procesarTexto = () => {
    if (!textoCapturado.trim()) {
      Alert.alert('Atención', 'Por favor ingresa o pega el texto de los productos');
      return;
    }

    // Separar por saltos de línea, comas, punto y coma o tuberías (|)
    const lineas = textoCapturado
      .split(/\n|;|\||,/)
      .map(l => l.replace(/^[\s\-\*\•\>\–\—]+/, '')) // Quitar viñetas
      .map(l => l.replace(/^[0-9]+[\.\)\-]\s+/, '')) // Quitar números de lista
      .map(l => l.replace(/\s{2,}/g, ' '))
      .map(l => l.trim())
      .filter(l => l.length >= 2); // Filtro básico de ruido

    if (lineas.length === 0) {
      Alert.alert('Sin productos', 'No se pudieron extraer nombres válidos de productos del texto');
      return;
    }

    setLineasTexto(lineas);
    setStep('edit');
  };

  const editarLinea = (index: number, valor: string) => {
    const nuevas = [...lineasTexto];
    nuevas[index] = valor;
    setLineasTexto(nuevas);
  };

  const eliminarLinea = (index: number) => {
    setLineasTexto(lineasTexto.filter((_, i) => i !== index));
  };

  const agregarNuevaLinea = () => {
    setLineasTexto([...lineasTexto, 'Nuevo Producto']);
  };

  // 2. Cola de Procesamiento Asíncrona (Queue) Uno por Uno
  const iniciarColaAnalisis = async (lineasAProcesar: string[] = lineasTexto) => {
    if (lineasAProcesar.length === 0) {
      Alert.alert('Atención', 'No hay productos para analizar');
      return;
    }

    detenerColaRef.current = false;
    pausarColaRef.current = false;
    setColaProcesando(true);
    setColaPausada(false);
    setStep('result');

    // Inicializar lista de matches con placeholders pendientes
    const iniciales: ProductoMatch[] = lineasAProcesar.map(l => ({
      nombre_original: l,
      nombre_editado: l,
      producto_sugerido: null,
      score: 0,
      sospechoso: true,
      analizando: true,
    }));
    setMatches(iniciales);

    for (let i = 0; i < lineasAProcesar.length; i++) {
      if (detenerColaRef.current) break;

      // Soporte para Pausar / Reanudar la cola
      while (pausarColaRef.current) {
        await cederEventLoop(150);
        if (detenerColaRef.current) break;
      }
      if (detenerColaRef.current) break;

      const nombreItem = lineasAProcesar[i];
      setProgresoCola({
        actual: i + 1,
        total: lineasAProcesar.length,
        nombreActual: nombreItem,
      });

      // Paso A: Análisis difuso local rápido (smartSearch)
      let resultadoMatch = await smartSearch.analizarProducto(nombreItem);

      // Paso B: Si la confianza local es baja o no lo halló, consultar backend de forma aislada
      if (!resultadoMatch.producto_sugerido || resultadoMatch.score < 0.42) {
        try {
          const resApi = await matchProductoIndividual(nombreItem);
          if (resApi.data && resApi.data.producto_sugerido) {
            resultadoMatch = {
              nombre_original: nombreItem,
              producto_sugerido: resApi.data.producto_sugerido,
              score: resApi.data.score || 0.82,
              sospechoso: resApi.data.sospechoso || false,
              aprendido: resApi.data.aprendido || false,
            };
          }
        } catch (e) {
          // La falla de red/servidor en un solo ítem NO tumba el resto de la cola
          console.warn(`[LectorTexto Queue] Caída aislada de backend para '${nombreItem}':`, e);
        }
      }

      // Actualización inmediata del estado para el ítem actual en la interfaz de usuario
      setMatches(prev => {
        const copy = [...prev];
        copy[i] = {
          nombre_original: nombreItem,
          nombre_editado: resultadoMatch.producto_sugerido?.nombre || nombreItem,
          producto_sugerido: resultadoMatch.producto_sugerido,
          score: resultadoMatch.score,
          sospechoso: resultadoMatch.sospechoso,
          aprendido: resultadoMatch.aprendido || false,
          analizando: false,
          noEncontrado: !resultadoMatch.producto_sugerido,
        };
        return copy;
      });

      // Ceder voluntariamente el event loop para asegurar fluido total de UI (60 FPS)
      await cederEventLoop(15);
    }

    setColaProcesando(false);
    setColaPausada(false);
  };

  // Reintentar solo productos dudosos o no encontrados en cola
  const reintentarDudosos = () => {
    const dudosos = matches
      .filter(m => m.sospechoso || !m.producto_sugerido)
      .map(m => m.nombre_original);

    if (dudosos.length === 0) {
      Alert.alert('Información', 'No hay productos dudosos para reintentar');
      return;
    }

    iniciarColaAnalisis(dudosos);
  };

  const confirmarSeleccion = () => {
    const productosValidos = matches
      .filter(m => m.producto_sugerido)
      .map(m => ({
        producto: m.producto_sugerido!,
        cantidad: 1,
      }));

    if (productosValidos.length === 0) {
      Alert.alert('Sin selección', 'Debes seleccionar o confirmar al menos un producto válido');
      return;
    }

    onProductosSeleccionados(productosValidos);
    resetear();
    cerrarLector();
  };

  const totalEncontrados = matches.filter(m => m.producto_sugerido && !m.sospechoso).length;
  const totalDudosos = matches.filter(m => m.producto_sugerido && m.sospechoso).length;
  const totalNoEncontrados = matches.filter(m => !m.producto_sugerido && !m.analizando).length;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrarLector}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Escáner y Lector Masivo</Text>
          <IconButton icon="close" iconColor="#fff" onPress={cerrarLector} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* PASO 1: Entrada de texto sin límites */}
          {step === 'input' && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.stepTitle}>Pega tu Lista de Productos</Text>
                <Text style={styles.hint}>
                  Capacidad ilimitada. Puedes pegar listas por saltos de línea, comas, guiones o barras.
                </Text>

                <RNTextInput
                  style={styles.textArea}
                  multiline
                  placeholder="Tornillo hexagonal 1/4&#10;Tuerca galvanizada M8&#10;Arandela plana 3/8&#10;Tubo PVC 1/2 pulgada&#10;Codo galvanizado 3/4..."
                  value={textoCapturado}
                  onChangeText={setTextoCapturado}
                  textAlignVertical="top"
                />

                <View style={styles.buttonRow}>
                  <Button mode="outlined" onPress={cerrarLector}>Cancelar</Button>
                  <Button mode="contained" onPress={procesarTexto}>
                    Procesar Lista
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* PASO 2: Revisar / Editar líneas */}
          {step === 'edit' && (
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.stepHeaderRow}>
                  <Text style={styles.stepTitle}>Revisar Productos ({lineasTexto.length})</Text>
                  <Button mode="text" compact onPress={agregarNuevaLinea} icon="plus">
                    Agregar Ítem
                  </Button>
                </View>
                <Text style={styles.hint}>Edita o ajusta los nombres antes de iniciar la cola de análisis.</Text>

                {lineasTexto.map((linea, index) => (
                  <View key={index} style={styles.lineaRow}>
                    <TextInput
                      mode="outlined"
                      value={linea}
                      onChangeText={(v) => editarLinea(index, v)}
                      style={styles.lineaInput}
                      dense
                    />
                    <IconButton
                      icon="delete-outline"
                      size={20}
                      iconColor="#d32f2f"
                      onPress={() => eliminarLinea(index)}
                    />
                  </View>
                ))}

                <Divider style={{ marginVertical: 16 }} />

                <View style={styles.buttonRow}>
                  <Button mode="outlined" onPress={() => setStep('input')}>Atrás</Button>
                  <Button
                    mode="contained"
                    onPress={() => iniciarColaAnalisis(lineasTexto)}
                    icon="play"
                  >
                    Iniciar Análisis en Cola
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* PASO 3: Resultados en tiempo real con cola asíncrona */}
          {step === 'result' && (
            <Card style={styles.card}>
              <Card.Content>
                {/* Banner de progreso de la Cola */}
                {colaProcesando && (
                  <View style={styles.progressBanner}>
                    <View style={styles.progressHeader}>
                      <ActivityIndicator size="small" color="#6200ee" />
                      <Text style={styles.progressText}>
                        Analizando {progresoCola.actual} de {progresoCola.total}
                      </Text>
                      <Text style={styles.progressPercent}>
                        {Math.round((progresoCola.actual / (progresoCola.total || 1)) * 100)}%
                      </Text>
                    </View>
                    <ProgressBar
                      progress={progresoCola.total > 0 ? progresoCola.actual / progresoCola.total : 0}
                      color="#6200ee"
                      style={styles.progressBar}
                    />
                    <Text style={styles.currentNameText} numberOfLines={1}>
                      Buscando: “{progresoCola.nombreActual}”
                    </Text>

                    <View style={styles.queueControls}>
                      <Button
                        mode="outlined"
                        compact
                        onPress={pausarOReanudarCola}
                        icon={colaPausada ? 'play' : 'pause'}
                      >
                        {colaPausada ? 'Reanudar' : 'Pausar'}
                      </Button>
                      <Button
                        mode="outlined"
                        compact
                        onPress={detenerCola}
                        icon="stop"
                        textColor="#d32f2f"
                      >
                        Detener
                      </Button>
                    </View>
                  </View>
                )}

                {/* Resumen de estadísticas */}
                {!colaProcesando && matches.length > 0 && (
                  <View style={styles.summaryBox}>
                    <View style={styles.summaryBadgeGood}>
                      <Text style={styles.badgeTextGood}>✓ {totalEncontrados} Listos</Text>
                    </View>
                    {totalDudosos > 0 && (
                      <View style={styles.summaryBadgeWarning}>
                        <Text style={styles.badgeTextWarning}>🤔 {totalDudosos} Dudosos</Text>
                      </View>
                    )}
                    {totalNoEncontrados > 0 && (
                      <View style={styles.summaryBadgeBad}>
                        <Text style={styles.badgeTextBad}>❌ {totalNoEncontrados} No hallados</Text>
                      </View>
                    )}
                  </View>
                )}

                {totalDudosos > 0 && !colaProcesando && (
                  <Button
                    mode="contained-tonal"
                    onPress={reintentarDudosos}
                    icon="refresh"
                    style={{ marginBottom: 12 }}
                  >
                    Reintentar ({totalDudosos}) Dudosos
                  </Button>
                )}

                {/* Lista de Resultados de Productos */}
                {matches.map((match, index) => (
                  <View
                    key={index}
                    style={[
                      styles.matchCard,
                      match.analizando && styles.matchAnalizando,
                      match.sospechoso && !match.producto_sugerido && styles.matchNoEntendido,
                      match.sospechoso && match.producto_sugerido && styles.matchSospechoso,
                      match.aprendido && styles.matchAprendido,
                      match.modificado && styles.matchModificado,
                    ]}
                  >
                    <Text style={styles.matchOriginal}>Buscaste: “{match.nombre_original}”</Text>

                    {match.analizando ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#6200ee" />
                        <Text style={styles.loadingRowText}>Analizando coincidencia difusa...</Text>
                      </View>
                    ) : editandoIndex === index ? (
                      /* Modo Edición / Búsqueda Manual */
                      <View style={styles.editarContainer}>
                        <Text style={styles.editarTitulo}>Buscar producto correcto:</Text>
                        <Searchbar
                          placeholder="Escribe para buscar en el catálogo..."
                          onChangeText={buscarProductoParaCambiar}
                          value={busquedaProducto}
                          style={styles.searchbarEdit}
                          autoFocus
                        />
                        {resultadosBusqueda.length > 0 && (
                          <View style={styles.resultadosEdit}>
                            <FlatList
                              data={resultadosBusqueda}
                              keyExtractor={(item) => item._id}
                              renderItem={({ item }) => (
                                <TouchableOpacity
                                  style={styles.resultadoItem}
                                  onPress={() => cambiarProducto(index, item)}
                                >
                                  <Text style={styles.resultadoNombre} numberOfLines={2}>
                                    {item.nombre}
                                  </Text>
                                  <Text style={styles.resultadoPrecio}>
                                    ${(item.precio_venta || item.costo || 0).toLocaleString()}
                                  </Text>
                                </TouchableOpacity>
                              )}
                              style={{ maxHeight: 200 }}
                              keyboardShouldPersistTaps="handled"
                              nestedScrollEnabled
                            />
                          </View>
                        )}
                        <View style={styles.editarBotones}>
                          <Button
                            mode="text"
                            onPress={() => {
                              setEditandoIndex(null);
                              setBusquedaProducto('');
                              setResultadosBusqueda([]);
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            mode="text"
                            onPress={() => saltarProducto(index)}
                            textColor="#d32f2f"
                          >
                            Omitir
                          </Button>
                        </View>
                      </View>
                    ) : (
                      /* Modo Normal de Mostrar Producto */
                      <>
                        {match.producto_sugerido ? (
                          match.sospechoso && !match.aprendido ? (
                            <View style={styles.sospechosoContainer}>
                              <Text style={styles.sospechosoTitulo}>
                                🤔 No estoy seguro... ¿Es este producto?
                              </Text>
                              <Text style={styles.matchSugerido}>{match.producto_sugerido.nombre}</Text>
                              <Text style={styles.matchPrecio}>
                                ${(match.producto_sugerido.precio_venta || match.producto_sugerido.costo || 0).toLocaleString()}
                              </Text>
                              <Text style={styles.matchScore}>
                                Similitud estimada: {Math.round(match.score * 100)}%
                              </Text>
                              <View style={styles.sospechosoButtons}>
                                <Button
                                  mode="contained"
                                  compact
                                  onPress={() => confirmarSugerencia(index)}
                                  buttonColor="#4caf50"
                                  icon="check"
                                >
                                  Sí, es correcto
                                </Button>
                                <Button
                                  mode="outlined"
                                  compact
                                  onPress={() => setEditandoIndex(index)}
                                  icon="magnify"
                                >
                                  Buscar otro
                                </Button>
                              </View>
                            </View>
                          ) : (
                            <>
                              <Text style={styles.matchSugerido}>
                                {match.aprendido ? '✓ ' : '→ '}{match.producto_sugerido.nombre}
                              </Text>
                              <Text style={styles.matchPrecio}>
                                ${(match.producto_sugerido.precio_venta || match.producto_sugerido.costo || 0).toLocaleString()}
                              </Text>
                              <View style={styles.matchInfoRow}>
                                <Text style={styles.matchScore}>
                                  {match.aprendido
                                    ? '✓ Recordado por IA'
                                    : `${Math.round(match.score * 100)}% coincidencia`}
                                </Text>
                                <Button
                                  mode="text"
                                  compact
                                  onPress={() => setEditandoIndex(index)}
                                  icon="pencil"
                                >
                                  Cambiar
                                </Button>
                              </View>
                            </>
                          )
                        ) : (
                          <View style={styles.noEntendidoContainer}>
                            <Text style={styles.noEntendidoTitulo}>
                              ❌ No encontrado: “{match.nombre_original}”
                            </Text>
                            <Text style={styles.noEntendidoDesc}>
                              Busca el producto manualmente y la IA aprenderá para futuras ocasiones.
                            </Text>
                            <View style={styles.noEntendidoButtons}>
                              <Button
                                mode="contained"
                                onPress={() => setEditandoIndex(index)}
                                icon="magnify"
                              >
                                Seleccionar Producto
                              </Button>
                              <Button
                                mode="text"
                                onPress={() => saltarProducto(index)}
                                textColor="#666"
                              >
                                Omitir
                              </Button>
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                ))}

                <Divider style={{ marginVertical: 16 }} />

                <View style={styles.buttonRow}>
                  <Button mode="outlined" onPress={() => setStep('edit')}>
                    Volver a editar
                  </Button>
                  <Button
                    mode="contained"
                    onPress={confirmarSeleccion}
                    disabled={matches.filter(m => m.producto_sugerido).length === 0}
                  >
                    Agregar ({matches.filter(m => m.producto_sugerido).length})
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#6200ee',
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, padding: 16 },
  card: { borderRadius: 12, marginBottom: 16 },
  stepHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  hint: { fontSize: 13, color: '#666', marginBottom: 16 },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 220,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  lineaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lineaInput: { flex: 1, backgroundColor: '#fff' },

  progressBanner: {
    backgroundColor: '#f0f4ff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0dbe8',
    marginBottom: 16,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  progressText: { flex: 1, fontWeight: 'bold', color: '#1a237e' },
  progressPercent: { fontWeight: 'bold', color: '#6200ee' },
  progressBar: { height: 8, borderRadius: 4, marginBottom: 8 },
  currentNameText: { fontSize: 12, fontStyle: 'italic', color: '#555', marginBottom: 8 },
  queueControls: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },

  summaryBox: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  summaryBadgeGood: { backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeTextGood: { color: '#2e7d32', fontWeight: 'bold', fontSize: 12 },
  summaryBadgeWarning: { backgroundColor: '#fff3e0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeTextWarning: { color: '#ef6c00', fontWeight: 'bold', fontSize: 12 },
  summaryBadgeBad: { backgroundColor: '#ffebee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeTextBad: { color: '#c62828', fontWeight: 'bold', fontSize: 12 },

  matchCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  matchAnalizando: { borderColor: '#b3e5fc', backgroundColor: '#e1f5fe' },
  matchSospechoso: { borderColor: '#ff9800', backgroundColor: '#fff3e0' },
  matchNoEntendido: { borderColor: '#d32f2f', backgroundColor: '#ffebee' },
  matchAprendido: { borderColor: '#4caf50', backgroundColor: '#e8f5e9' },
  matchModificado: { borderColor: '#2196f3', backgroundColor: '#e3f2fd' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingRowText: { fontSize: 13, color: '#0288d1', fontStyle: 'italic' },

  matchOriginal: { fontSize: 12, color: '#666', marginBottom: 8, fontStyle: 'italic' },
  matchSugerido: { fontSize: 15, fontWeight: '600', color: '#333' },
  matchPrecio: { fontSize: 14, color: '#2e7d32', marginTop: 4 },
  matchScore: { fontSize: 12, color: '#666' },
  matchInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },

  editarContainer: { marginTop: 8 },
  editarTitulo: { fontSize: 13, color: '#333', marginBottom: 8, fontWeight: '500' },
  editarBotones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  searchbarEdit: { marginBottom: 8, elevation: 0 },
  resultadosEdit: { backgroundColor: '#f5f5f5', borderRadius: 8, marginBottom: 8 },
  resultadoItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  resultadoNombre: { fontSize: 14, color: '#333' },
  resultadoPrecio: { fontSize: 12, color: '#2e7d32', marginTop: 2 },

  noEntendidoContainer: { marginTop: 4 },
  noEntendidoTitulo: { fontSize: 14, fontWeight: '600', color: '#d32f2f', marginBottom: 4 },
  noEntendidoDesc: { fontSize: 12, color: '#666', marginBottom: 8 },
  noEntendidoButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  sospechosoContainer: { marginTop: 4 },
  sospechosoTitulo: { fontSize: 13, fontWeight: '600', color: '#ef6c00', marginBottom: 8 },
  sospechosoButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 },
});
