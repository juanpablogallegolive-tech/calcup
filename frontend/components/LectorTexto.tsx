import React, { useRef, useState } from 'react';
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
} from 'react-native-paper';
import { matchProductos, guardarAprendizaje } from '../services/api';
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
  noEncontrado?: boolean; // Cuando falla la búsqueda
}

interface Props {
  onProductosSeleccionados: (productos: Array<{ producto: Producto; cantidad: number }>) => void;
  onClose: () => void;
  visible: boolean;
}

const MAX_PRODUCTOS_POR_LOTE = 120;

export default function LectorTexto({ onProductosSeleccionados, onClose, visible }: Props) {
  const [step, setStep] = useState<'input' | 'edit' | 'match' | 'result'>('input');
  const [textoCapturado, setTextoCapturado] = useState('');
  const [lineasTexto, setLineasTexto] = useState<string[]>([]);
  const [matches, setMatches] = useState<ProductoMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [progresoReintento, setProgresoReintento] = useState({ actual: 0, total: 0 });
  const detenerReintentoRef = useRef(false);
  
  // Para cambiar producto
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Producto[]>([]);

  const resetear = () => {
    setStep('input');
    setTextoCapturado('');
    setLineasTexto([]);
    setMatches([]);
    setReintentando(false);
    setProgresoReintento({ actual: 0, total: 0 });
    detenerReintentoRef.current = false;
    setEditandoIndex(null);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
  };

  const cerrarLector = () => {
    detenerReintentoRef.current = true;
    setReintentando(false);
    onClose();
  };

  // Búsqueda interna debounced usando smartSearch (local, rápida, con aprendizajes)
  const ejecutarBusqueda = useDebouncedCallback(async (query: string) => {
    if (query.length >= 1) {
      try {
        const resultados = await smartSearch.buscar(query, 20);
        setResultadosBusqueda(resultados);
      } catch (error) {
        console.error('Error buscando:', error);
      }
    } else {
      setResultadosBusqueda([]);
    }
  }, 250);

  // Buscar productos para cambiar (con debounce + smartSearch)
  const buscarProductoParaCambiar = (query: string) => {
    setBusquedaProducto(query);
    ejecutarBusqueda(query);
  };

  // Cambiar producto manualmente y guardar aprendizaje
  const cambiarProducto = async (index: number, nuevoProducto: Producto) => {
    const match = matches[index];
    
    // Registrar aprendizaje local inmediatamente (para búsquedas subsiguientes)
    smartSearch.registrarAprendizajeLocal(
      match.nombre_original, nuevoProducto._id, nuevoProducto.nombre
    );
    
    // Guardar aprendizaje en el backend (persistencia)
    try {
      await guardarAprendizaje({
        nombre_original: match.nombre_original,
        producto_id_correcto: nuevoProducto._id,
        nombre_producto_correcto: nuevoProducto.nombre,
      });
    } catch (error) {
      console.error('Error guardando aprendizaje:', error);
    }
    
    // Actualizar el match
    const nuevosMatches = [...matches];
    nuevosMatches[index] = {
      ...match,
      producto_sugerido: nuevoProducto,
      nombre_editado: nuevoProducto.nombre,
      score: 1.0,
      sospechoso: false,
      aprendido: true,
      modificado: true,
    };
    setMatches(nuevosMatches);
    
    // Cerrar búsqueda
    setEditandoIndex(null);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
    
    Alert.alert('✓ Aprendizaje guardado', `La IA recordará que "${match.nombre_original}" = "${nuevoProducto.nombre}"`);
  };

  // Confirmar que la sugerencia es correcta (también aprende)
  const confirmarSugerencia = async (index: number) => {
    const match = matches[index];
    if (!match.producto_sugerido) return;
    
    // Registrar aprendizaje local inmediatamente
    smartSearch.registrarAprendizajeLocal(
      match.nombre_original, match.producto_sugerido._id, match.producto_sugerido.nombre
    );
    
    // Guardar aprendizaje en backend para reforzar
    try {
      await guardarAprendizaje({
        nombre_original: match.nombre_original,
        producto_id_correcto: match.producto_sugerido._id,
        nombre_producto_correcto: match.producto_sugerido.nombre,
      });
    } catch (error) {
      console.error('Error guardando aprendizaje:', error);
    }
    
    // Actualizar el match
    const nuevosMatches = [...matches];
    nuevosMatches[index] = {
      ...match,
      sospechoso: false,
      aprendido: true,
    };
    setMatches(nuevosMatches);
    
    Alert.alert('✓ Confirmado', 'La IA recordará esta asociación');
  };

  // Saltar/omitir un producto
  const saltarProducto = (index: number) => {
    const nuevosMatches = [...matches];
    nuevosMatches[index] = {
      ...nuevosMatches[index],
      producto_sugerido: null,
      sospechoso: false,
    };
    setMatches(nuevosMatches);
    setEditandoIndex(null);
    setBusquedaProducto('');
    setResultadosBusqueda([]);
  };

  const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const construirVariantesReintento = (texto: string): string[] => {
    const base = (texto || '').trim();
    if (!base) return [];

    const variantes = new Set<string>();
    variantes.add(base);

    const sinPuntuacion = base.replace(/[|,;]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (sinPuntuacion) variantes.add(sinPuntuacion);

    const sinDuplicados = base
      .replace(/([a-zA-Z])\1{2,}/g, '$1$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (sinDuplicados) variantes.add(sinDuplicados);

    const corregidoOCR = base
      .replace(/\b0\s*([oO])\b/g, '0')
      .replace(/([0-9])[oO]/g, '$10')
      .replace(/[lI](?=[0-9])/g, '1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (corregidoOCR) variantes.add(corregidoOCR);

    return Array.from(variantes).filter(v => v.length > 1).slice(0, 5);
  };

  const detenerReintentos = () => {
    detenerReintentoRef.current = true;
  };

  const iniciarEdicionManual = (index: number) => {
    detenerReintentoRef.current = true;
    setReintentando(false);
    setEditandoIndex(index);
  };

  const reintentarSospechosos = async () => {
    if (reintentando) return;

    const indicesSospechosos = matches
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.sospechoso)
      .map(({ i }) => i);

    if (indicesSospechosos.length === 0) return;

    setReintentando(true);
    detenerReintentoRef.current = false;
    setProgresoReintento({ actual: 0, total: indicesSospechosos.length });

    const nuevosMatches = [...matches];

    try {
      for (let p = 0; p < indicesSospechosos.length; p++) {
        if (detenerReintentoRef.current) break;

        const index = indicesSospechosos[p];
        const actual = nuevosMatches[index];
        if (!actual || !actual.sospechoso) {
          setProgresoReintento({ actual: p + 1, total: indicesSospechosos.length });
          continue;
        }

        const baseBusqueda = actual.nombre_editado || actual.nombre_original;
        const variantes = construirVariantesReintento(baseBusqueda);
        let mejorProducto = actual.producto_sugerido;
        let mejorScore = actual.score || 0;

        for (let intento = 0; intento < Math.min(4, variantes.length); intento++) {
          if (detenerReintentoRef.current) break;

          const query = variantes[intento];
          const candidatos = await smartSearch.buscar(query, 8);
          if (!candidatos || candidatos.length === 0) {
            await esperar(250);
            continue;
          }

          const candidato = candidatos.find(c => c._id !== mejorProducto?._id) || candidatos[0];
          const bono = Math.max(0.02, 0.08 - intento * 0.015);
          const scoreEstimado = Math.min(0.84, Math.max(mejorScore, 0.54 + bono));

          if (!mejorProducto || candidato._id !== mejorProducto._id || scoreEstimado > mejorScore) {
            mejorProducto = candidato;
            mejorScore = scoreEstimado;

            nuevosMatches[index] = {
              ...actual,
              producto_sugerido: candidato,
              nombre_editado: candidato.nombre,
              score: scoreEstimado,
              sospechoso: scoreEstimado < 0.70,
              modificado: true,
            };
            setMatches([...nuevosMatches]);
          }

          await esperar(280);
        }

        setProgresoReintento({ actual: p + 1, total: indicesSospechosos.length });
        await esperar(260);
      }
    } catch (error) {
      console.error('Error en reintentos automáticos:', error);
    } finally {
      setReintentando(false);
      detenerReintentoRef.current = false;
    }
  };

  // Procesar texto en líneas (nombres de productos)
  const procesarTexto = () => {
    if (!textoCapturado.trim()) {
      Alert.alert('Error', 'Ingresa texto primero');
      return;
    }
    
    // Separar por líneas o separadores comunes y limpiar prefijos
    const lineas = textoCapturado
      .split(/\n|;|\||,/)
      .map(l => l.replace(/^[\s\-\*\•\>]+/, '')) // Quitar viñetas como "-", "*", "•", ">"
      .map(l => l.replace(/^[0-9]+[\.\)\-]\s+/, '')) // Quitar listas numeradas como "1. ", "2) ", "3 - "
      .map(l => l.replace(/\s{2,}/g, ' '))
      .map(l => l.trim())
      .filter(l => l.length > 2); // Ignorar líneas muy cortas
    
    if (lineas.length === 0) {
      Alert.alert('Error', 'No se encontraron productos en el texto');
      return;
    }
    
    setLineasTexto(lineas);
    setStep('edit');
  };

  // Editar línea individual
  const editarLinea = (index: number, valor: string) => {
    const nuevas = [...lineasTexto];
    nuevas[index] = valor;
    setLineasTexto(nuevas);
  };

  // Eliminar línea
  const eliminarLinea = (index: number) => {
    setLineasTexto(lineasTexto.filter((_, i) => i !== index));
  };

  // Buscar matches con IA (en lotes para soportar grandes cantidades sin timeout)
  const buscarMatches = async () => {
    if (lineasTexto.length === 0) {
      Alert.alert('Error', 'No hay productos para buscar');
      return;
    }

    setLoading(true);
    setStep('match');

    try {
      const resultadosAcumulados: ProductoMatch[] = [];

      for (let i = 0; i < lineasTexto.length; i += MAX_PRODUCTOS_POR_LOTE) {
        const lote = lineasTexto.slice(i, i + MAX_PRODUCTOS_POR_LOTE);
        const response = await matchProductos(lote);

        const resultadosLote: ProductoMatch[] = response.data.map((r: any, idx: number) => ({
          nombre_original: lote[idx],
          nombre_editado: r.producto_sugerido?.nombre || lote[idx],
          producto_sugerido: r.producto_sugerido,
          score: r.score,
          sospechoso: r.sospechoso,
          aprendido: r.aprendido || false,
        }));

        resultadosAcumulados.push(...resultadosLote);
      }

      setMatches(resultadosAcumulados);
      setStep('result');
    } catch (error) {
      console.error('Error buscando matches:', error);
      // NO MOSTRAR ERROR - crear matches vacíos para que el usuario los corrija manualmente
      const resultadosVacios: ProductoMatch[] = lineasTexto.map((linea) => ({
        nombre_original: linea,
        nombre_editado: linea,
        producto_sugerido: null,
        score: 0,
        sospechoso: true,
        aprendido: false,
        noEncontrado: true, // Marcador especial
      }));
      setMatches(resultadosVacios);
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  // Confirmar selección
  const confirmarSeleccion = () => {
    const productosValidos = matches
      .filter(m => m.producto_sugerido)
      .map(m => ({
        producto: m.producto_sugerido!,
        cantidad: 1,
      }));

    if (productosValidos.length === 0) {
      Alert.alert('Error', 'No hay productos válidos para agregar');
      return;
    }

    onProductosSeleccionados(productosValidos);
    resetear();
    cerrarLector();
  };

  const totalSospechosos = matches.filter(m => m.sospechoso).length;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrarLector}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Lector de Productos</Text>
          <IconButton icon="close" onPress={cerrarLector} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Entrada de texto */}
          {step === 'input' && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.stepTitle}>Ingresa los nombres de productos</Text>
                <Text style={styles.hint}>Puedes pegar por líneas, comas, punto y coma o |</Text>
                
                <RNTextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={10}
                  placeholder="Tornillo hexagonal 1/4&#10;Tuerca galvanizada M8&#10;Arandela plana 3/8..."
                  value={textoCapturado}
                  onChangeText={setTextoCapturado}
                  textAlignVertical="top"
                />

                <View style={styles.buttonRow}>
                  <Button mode="outlined" onPress={cerrarLector}>Cancelar</Button>
                  <Button mode="contained" onPress={procesarTexto}>Siguiente</Button>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* PASO 2: Editar líneas */}
          {step === 'edit' && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.stepTitle}>Revisa los productos ({lineasTexto.length})</Text>
                <Text style={styles.hint}>Edita o elimina antes de buscar</Text>

                {lineasTexto.map((linea, index) => (
                  <View key={index} style={styles.lineaRow}>
                    <TextInput
                      mode="outlined"
                      value={linea}
                      onChangeText={(v) => editarLinea(index, v)}
                      style={styles.lineaInput}
                      dense
                    />
                    <IconButton icon="delete" size={20} iconColor="#d32f2f" onPress={() => eliminarLinea(index)} />
                  </View>
                ))}

                <Divider style={{ marginVertical: 16 }} />

                <View style={styles.buttonRow}>
                  <Button mode="outlined" onPress={() => setStep('input')}>Atrás</Button>
                  <Button mode="contained" onPress={buscarMatches} loading={loading}>
                    Buscar Similares
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* PASO 3: Loading */}
          {step === 'match' && loading && (
            <Card style={styles.card}>
              <Card.Content style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Analizando {lineasTexto.length} productos...</Text>
              </Card.Content>
            </Card>
          )}

          {/* PASO 4: Resultados */}
          {step === 'result' && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.stepTitle}>Productos encontrados</Text>
                <Text style={styles.hint}>La IA aprende de cada corrección que hagas</Text>

                {totalSospechosos > 0 && (
                  <View style={styles.reintentoPanel}>
                    <Text style={styles.reintentoTexto}>
                      {reintentando
                        ? `Reintentando ${progresoReintento.actual}/${progresoReintento.total} productos dudosos...`
                        : `Hay ${totalSospechosos} productos con duda. Puedes reintentar automático o corregir manualmente.`}
                    </Text>
                    {!reintentando ? (
                      <Button
                        mode="contained-tonal"
                        onPress={reintentarSospechosos}
                        icon="refresh"
                      >
                        Reintentar solo dudosos
                      </Button>
                    ) : (
                      <Button
                        mode="outlined"
                        onPress={detenerReintentos}
                        icon="stop"
                        textColor="#d32f2f"
                      >
                        Detener reintento
                      </Button>
                    )}
                  </View>
                )}

                {matches.map((match, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.matchCard,
                      match.sospechoso && !match.producto_sugerido && styles.matchNoEntendido,
                      match.sospechoso && match.producto_sugerido && styles.matchSospechoso,
                      match.aprendido && styles.matchAprendido,
                      match.modificado && styles.matchModificado
                    ]}
                  >
                    <Text style={styles.matchOriginal}>Buscaste: {`“${match.nombre_original}”`}</Text>
                    
                    {editandoIndex === index ? (
                      // Modo edición: buscar otro producto
                      <View style={styles.editarContainer}>
                        <Text style={styles.editarTitulo}>Busca el producto correcto:</Text>
                        <Searchbar
                          placeholder="Escribe para buscar..."
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
                                  <Text style={styles.resultadoNombre} numberOfLines={2}>{item.nombre}</Text>
                                  <Text style={styles.resultadoPrecio}>${(item.precio_venta || item.costo || 0).toLocaleString()}</Text>
                                </TouchableOpacity>
                              )}
                              style={{ maxHeight: 200 }}
                              keyboardShouldPersistTaps="handled"
                              nestedScrollEnabled
                            />
                          </View>
                        )}
                        <View style={styles.editarBotones}>
                          <Button mode="text" onPress={() => { setEditandoIndex(null); setBusquedaProducto(''); setResultadosBusqueda([]); }}>
                            Cancelar
                          </Button>
                          <Button mode="text" onPress={() => saltarProducto(index)} textColor="#d32f2f">
                            Omitir este
                          </Button>
                        </View>
                      </View>
                    ) : (
                      // Modo normal: mostrar resultado
                      <>
                        {match.producto_sugerido ? (
                          match.sospechoso && !match.aprendido ? (
                            // Producto encontrado pero con baja confianza
                            <View style={styles.sospechosoContainer}>
                              <Text style={styles.sospechosoTitulo}>
                                🤔 No estoy seguro... ¿Es este?
                              </Text>
                              <Text style={styles.matchSugerido}>{match.producto_sugerido.nombre}</Text>
                              <Text style={styles.matchPrecio}>
                                ${(match.producto_sugerido.precio_venta || match.producto_sugerido.costo || 0).toLocaleString()}
                              </Text>
                              <Text style={styles.matchScore}>
                                Similitud: {Math.round(match.score * 100)}%
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
                                  onPress={() => iniciarEdicionManual(index)}
                                  icon="magnify"
                                >
                                  No, buscar otro
                                </Button>
                              </View>
                            </View>
                          ) : (
                            // Producto encontrado con buena confianza
                            <>
                              <Text style={styles.matchSugerido}>
                                {match.aprendido ? '✓ ' : '→ '}{match.producto_sugerido.nombre}
                              </Text>
                              <Text style={styles.matchPrecio}>
                                ${(match.producto_sugerido.precio_venta || match.producto_sugerido.costo || 0).toLocaleString()}
                              </Text>
                              <View style={styles.matchInfoRow}>
                                <Text style={styles.matchScore}>
                                  {match.aprendido ? '✓ Aprendido' : `${Math.round(match.score * 100)}% similitud`}
                                </Text>
                                <Button 
                                  mode="text" 
                                  compact 
                                  onPress={() => iniciarEdicionManual(index)}
                                  icon="pencil"
                                >
                                  Cambiar
                                </Button>
                              </View>
                            </>
                          )
                        ) : (
                          // No encontrado
                          <View style={styles.noEntendidoContainer}>
                            <Text style={styles.noEntendidoTitulo}>
                              {`❌ No entendí “${match.nombre_original}”`}
                            </Text>
                            <Text style={styles.noEntendidoDesc}>
                              ¿Podrías buscar el producto correcto? La IA aprenderá de tu corrección.
                            </Text>
                            <View style={styles.noEntendidoButtons}>
                              <Button 
                                mode="contained" 
                                onPress={() => iniciarEdicionManual(index)}
                                icon="magnify"
                              >
                                Buscar producto
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
                  <Button mode="outlined" onPress={() => setStep('edit')}>Volver a editar</Button>
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
  stepTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  hint: { fontSize: 13, color: '#666', marginBottom: 16 },
  methodButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 12,
  },
  methodInfo: { flex: 1, marginLeft: 8 },
  methodTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  methodDesc: { fontSize: 13, color: '#666' },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  lineaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lineaInput: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  reintentoPanel: {
    backgroundColor: '#eef3ff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c8d6ff',
    gap: 8,
  },
  reintentoTexto: {
    fontSize: 13,
    color: '#24407a',
  },
  matchCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  matchSospechoso: { borderColor: '#ff9800', backgroundColor: '#fff3e0' },
  matchNoEntendido: { borderColor: '#d32f2f', backgroundColor: '#ffebee' },
  matchAprendido: { borderColor: '#4caf50', backgroundColor: '#e8f5e9' },
  matchModificado: { borderColor: '#2196f3', backgroundColor: '#e3f2fd' },
  matchOriginal: { fontSize: 12, color: '#666', marginBottom: 8, fontStyle: 'italic' },
  matchSugerido: { fontSize: 15, fontWeight: '600', color: '#333' },
  matchPrecio: { fontSize: 14, color: '#2e7d32', marginTop: 4 },
  matchScore: { fontSize: 12, color: '#666' },
  matchInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  matchNoEncontrado: { fontSize: 14, color: '#d32f2f', fontStyle: 'italic', marginBottom: 8 },
  editarContainer: { marginTop: 8 },
  editarTitulo: { fontSize: 13, color: '#333', marginBottom: 8, fontWeight: '500' },
  editarBotones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  searchbarEdit: { marginBottom: 8, elevation: 0 },
  resultadosEdit: { backgroundColor: '#f5f5f5', borderRadius: 8, marginBottom: 8 },
  resultadoItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  resultadoNombre: { fontSize: 14, color: '#333' },
  resultadoPrecio: { fontSize: 12, color: '#2e7d32', marginTop: 2 },
  // Estilos para "no entendido"
  noEntendidoContainer: { marginTop: 4 },
  noEntendidoTitulo: { fontSize: 15, fontWeight: '600', color: '#d32f2f', marginBottom: 8 },
  noEntendidoDesc: { fontSize: 13, color: '#666', marginBottom: 12 },
  noEntendidoButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Estilos para "sospechoso"
  sospechosoContainer: { marginTop: 4 },
  sospechosoTitulo: { fontSize: 14, fontWeight: '600', color: '#ff9800', marginBottom: 8 },
  sospechosoButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraControls: { 
    position: 'absolute', 
    bottom: 40, 
    left: 20, 
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
