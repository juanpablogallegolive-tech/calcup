import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Vibration,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ==================== TIPOS Y DATOS ====================

export interface DatosRecurrentes {
  id: string;
  categoria: 'cedula' | 'telefono' | 'tarjeta' | 'email' | 'direccion' | 'custom';
  etiqueta: string;
  valor: string;
}

interface CustomGboardProps {
  onInsertText: (text: string) => void;
  onDeleteChar: () => void;
  onClearAll?: () => void;
  onCloseKeyboard?: () => void;
  darkMode?: boolean;
}

// Diccionario de predicción rápida
const DICCIONARIO_BASE = [
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'en', 'para', 'por', 'con', 'sin', 'sobre',
  'que', 'que', 'como', 'cuando', 'donde', 'quien',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa',
  'producto', 'cotizacion', 'precio', 'valor', 'total',
  'factura', 'cedula', 'cliente', 'telefono', 'direccion',
  'cuenta', 'pago', 'banco', 'transferencia', 'efectivo',
  'gracias', 'saludos', 'atentamente', 'confirmado', 'pendiente'
];

// ==================== COMPONENTE PRINCIPAL ====================

export const CustomGboard: React.FC<CustomGboardProps> = ({
  onInsertText,
  onDeleteChar,
  onClearAll,
  onCloseKeyboard,
  darkMode = true,
}) => {
  // Estados
  const [layoutModo, setLayoutModo] = useState<'qwerty' | 'numeros' | 'simbolos'>('qwerty');
  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);
  const [isCapsLock, setIsCapsLock] = useState<boolean>(false);
  const [palabraActual, setPalabraActual] = useState<string>('');
  const [predicciones, setPredicciones] = useState<string[]>([]);
  const [mostrarQuickFill, setMostrarQuickFill] = useState<boolean>(true);
  const [modalQuickFillVisible, setModalQuickFillVisible] = useState<boolean>(false);

  // Datos recurrentes de autocompletado
  const [datosRecurrentes, setDatosRecurrentes] = useState<DatosRecurrentes[]>([
    { id: '1', categoria: 'cedula', etiqueta: 'Cédula', valor: '1098765432' },
    { id: '2', categoria: 'telefono', etiqueta: 'Teléfono', valor: '3001234567' },
    { id: '3', categoria: 'email', etiqueta: 'Email', valor: 'usuario@ejemplo.com' },
    { id: '4', categoria: 'direccion', etiqueta: 'Dirección', valor: 'Calle 10 # 20-30, Medellín' },
    { id: '5', categoria: 'tarjeta', etiqueta: 'Cuenta Nequi/Daviplata', valor: '3001234567' },
  ]);

  // Formulario nuevo dato recurrente
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState<string>('');
  const [nuevoValor, setNuevaValor] = useState<string>('');
  const [nuevaCategoria, setNuevaCategoria] = useState<DatosRecurrentes['categoria']>('custom');

  // Ref para borrado continuo
  const deleteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Haptic feedback leve estilo Gboard
  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'android') {
      Vibration.vibrate(10);
    }
  }, []);

  // Motor de predicción de texto súper rápido
  useEffect(() => {
    if (!palabraActual || palabraActual.length < 1) {
      setPredicciones([]);
      return;
    }

    const query = palabraActual.toLowerCase();
    const coincidencias = DICCIONARIO_BASE.filter(word => word.toLowerCase().startsWith(query))
      .slice(0, 3)
      .map(word => {
        if (isCapsLock || isShiftActive) {
          return word.toUpperCase();
        }
        if (palabraActual.charAt(0) === palabraActual.charAt(0).toUpperCase()) {
          return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word;
      });

    setPredicciones(coincidencias);
  }, [palabraActual, isShiftActive, isCapsLock]);

  // Manejo de pulsación de teclas
  const handleKeyPress = (char: string) => {
    triggerHaptic();
    let charToInsert = char;

    if (isShiftActive || isCapsLock) {
      charToInsert = char.toUpperCase();
      if (isShiftActive && !isCapsLock) {
        setIsShiftActive(false);
      }
    } else {
      charToInsert = char.toLowerCase();
    }

    onInsertText(charToInsert);
    setPalabraActual(prev => prev + charToInsert);
  };

  // Espacio
  const handleSpace = () => {
    triggerHaptic();
    onInsertText(' ');
    setPalabraActual('');
    setPredicciones([]);
  };

  // Borrar
  const handleDelete = () => {
    triggerHaptic();
    onDeleteChar();
    setPalabraActual(prev => (prev.length > 0 ? prev.slice(0, -1) : ''));
  };

  const startContinuousDelete = () => {
    handleDelete();
    deleteIntervalRef.current = setInterval(() => {
      handleDelete();
    }, 100);
  };

  const stopContinuousDelete = () => {
    if (deleteIntervalRef.current) {
      clearInterval(deleteIntervalRef.current);
      deleteIntervalRef.current = null;
    }
  };

  // Autocompletar sugerencia de predicción
  const handleSelectPrediction = (sugerencia: string) => {
    triggerHaptic();
    // Reemplazar la palabra parcialmente escrita
    if (palabraActual.length > 0) {
      for (let i = 0; i < palabraActual.length; i++) {
        onDeleteChar();
      }
    }
    onInsertText(sugerencia + ' ');
    setPalabraActual('');
    setPredicciones([]);
  };

  // Insertar Dato Recurrente (Autocompletado con un toque)
  const handleInsertQuickFill = (item: DatosRecurrentes) => {
    triggerHaptic();
    onInsertText(item.valor);
    setPalabraActual('');
  };

  // Agregar nuevo dato recurrente
  const handleGuardarNuevoDato = () => {
    if (!nuevaEtiqueta.trim() || !nuevoValor.trim()) return;

    const nuevoItem: DatosRecurrentes = {
      id: Date.now().toString(),
      categoria: nuevaCategoria,
      etiqueta: nuevaEtiqueta.trim(),
      valor: nuevoValor.trim(),
    };

    setDatosRecurrentes(prev => [...prev, nuevoItem]);
    setNuevaEtiqueta('');
    setNuevaValor('');
    setModalQuickFillVisible(false);
  };

  // Layouts de Teclas Estilo Gboard
  const QWERTY_FILA_1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const QWERTY_FILA_2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'];
  const QWERTY_FILA_3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

  const NUMEROS_FILA_1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const NUMEROS_FILA_2 = ['@', '#', '$', '%', '&', '-', '+', '(', ')', '/'];
  const NUMEROS_FILA_3 = ['*', '"', "'", ':', ';', '!', '?', ','];

  const SIMBOLOS_FILA_1 = ['~', '`', '|', '•', '√', 'π', '÷', '×', '¶', '∆'];
  const SIMBOLOS_FILA_2 = ['£', '¢', '€', '¥', '^', '°', '=', '{', '}', '\\'];
  const SIMBOLOS_FILA_3 = ['%', '<', '>', '[', ']', '™', '®', '©'];

  const isDark = darkMode;
  const theme = {
    bg: isDark ? '#171719' : '#e9ecef',
    keyboardBg: isDark ? '#202124' : '#d1d5db',
    keyBg: isDark ? '#303134' : '#ffffff',
    keyText: isDark ? '#e8eaed' : '#1f2937',
    specialKeyBg: isDark ? '#3c4043' : '#b0b7c0',
    accentKeyBg: isDark ? '#8ab4f8' : '#1a73e8',
    accentKeyText: isDark ? '#202124' : '#ffffff',
    barBg: isDark ? '#2c2c2e' : '#e2e8f0',
    chipBg: isDark ? '#3a3b3e' : '#ffffff',
    chipBorder: isDark ? '#4f5053' : '#cbd5e1',
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.keyboardBg }]}>
      {/* BARRA SUPERIOR ESTRUCTURADA ESTILO GBOARD (BARRA DE HERRAMIENTAS) */}
      <View style={[styles.toolbarContainer, { backgroundColor: theme.barBg }]}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setMostrarQuickFill(!mostrarQuickFill)}
        >
          <Ionicons
            name={mostrarQuickFill ? 'flash' : 'flash-outline'}
            size={20}
            color={mostrarQuickFill ? '#8ab4f8' : theme.keyText}
          />
        </TouchableOpacity>

        {/* TIRA DE AUTOCOMPLETADO RÁPIDO O PREDICCIONES DE TEXTO */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFillScroll}
        >
          {predicciones.length > 0 ? (
            predicciones.map((sug, idx) => (
              <TouchableOpacity
                key={`sug-${idx}`}
                style={[styles.predictionChip, { backgroundColor: theme.keyBg }]}
                onPress={() => handleSelectPrediction(sug)}
              >
                <Text style={[styles.predictionText, { color: theme.keyText }]}>{sug}</Text>
              </TouchableOpacity>
            ))
          ) : (
            datosRecurrentes.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.quickFillChip,
                  { backgroundColor: theme.chipBg, borderColor: theme.chipBorder },
                ]}
                onPress={() => handleInsertQuickFill(item)}
              >
                <Ionicons
                  name={
                    item.categoria === 'cedula'
                      ? 'card-outline'
                      : item.categoria === 'telefono'
                      ? 'call-outline'
                      : item.categoria === 'email'
                      ? 'mail-outline'
                      : 'bookmark-outline'
                  }
                  size={14}
                  color="#8ab4f8"
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.quickFillLabel, { color: theme.keyText }]}>
                  {item.etiqueta}: <Text style={styles.quickFillValue}>{item.valor}</Text>
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* BOTÓN + PARA AGREGAR DATOS FRECUENTES */}
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setModalQuickFillVisible(true)}
        >
          <Ionicons name="add-circle-outline" size={22} color="#8ab4f8" />
        </TouchableOpacity>
      </View>

      {/* TECLADO QWERTY / NÚMEROS / SÍMBOLOS */}
      <View style={styles.keysContainer}>
        {/* FILA 1 */}
        <View style={styles.row}>
          {(layoutModo === 'qwerty'
            ? QWERTY_FILA_1
            : layoutModo === 'numeros'
            ? NUMEROS_FILA_1
            : SIMBOLOS_FILA_1
          ).map(char => (
            <TouchableOpacity
              key={char}
              style={[styles.key, { backgroundColor: theme.keyBg }]}
              onPress={() => handleKeyPress(char)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: theme.keyText }]}>
                {isShiftActive || isCapsLock ? char.toUpperCase() : char}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FILA 2 */}
        <View style={styles.row}>
          {(layoutModo === 'qwerty'
            ? QWERTY_FILA_2
            : layoutModo === 'numeros'
            ? NUMEROS_FILA_2
            : SIMBOLOS_FILA_2
          ).map(char => (
            <TouchableOpacity
              key={char}
              style={[styles.key, { backgroundColor: theme.keyBg }]}
              onPress={() => handleKeyPress(char)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: theme.keyText }]}>
                {isShiftActive || isCapsLock ? char.toUpperCase() : char}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FILA 3 (CON SHIFT Y BACKSPACE) */}
        <View style={styles.row}>
          {layoutModo === 'qwerty' && (
            <TouchableOpacity
              style={[
                styles.specialKey,
                {
                  backgroundColor: isShiftActive || isCapsLock ? '#8ab4f8' : theme.specialKeyBg,
                },
              ]}
              onPress={() => {
                triggerHaptic();
                if (isShiftActive) {
                  setIsCapsLock(true);
                  setIsShiftActive(false);
                } else if (isCapsLock) {
                  setIsCapsLock(false);
                  setIsShiftActive(false);
                } else {
                  setIsShiftActive(true);
                }
              }}
            >
              <Ionicons
                name={isCapsLock ? 'arrow-up-circle' : 'arrow-up-outline'}
                size={22}
                color={isShiftActive || isCapsLock ? '#202124' : theme.keyText}
              />
            </TouchableOpacity>
          )}

          {(layoutModo === 'qwerty'
            ? QWERTY_FILA_3
            : layoutModo === 'numeros'
            ? NUMEROS_FILA_3
            : SIMBOLOS_FILA_3
          ).map(char => (
            <TouchableOpacity
              key={char}
              style={[styles.key, { backgroundColor: theme.keyBg }]}
              onPress={() => handleKeyPress(char)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: theme.keyText }]}>
                {isShiftActive || isCapsLock ? char.toUpperCase() : char}
              </Text>
            </TouchableOpacity>
          ))}

          {/* TECLA BORRAR (BACKSPACE) */}
          <TouchableOpacity
            style={[styles.specialKey, { backgroundColor: theme.specialKeyBg }]}
            onPress={handleDelete}
            onPressIn={startContinuousDelete}
            onPressOut={stopContinuousDelete}
          >
            <Ionicons name="backspace-outline" size={22} color={theme.keyText} />
          </TouchableOpacity>
        </View>

        {/* FILA 4 (INFERIOR - MODO, COMAS, ESPACIO, PUNTO, ENTER) */}
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.modeKey, { backgroundColor: theme.specialKeyBg }]}
            onPress={() => {
              triggerHaptic();
              if (layoutModo === 'qwerty') setLayoutModo('numeros');
              else setLayoutModo('qwerty');
            }}
          >
            <Text style={[styles.specialKeyText, { color: theme.keyText }]}>
              {layoutModo === 'qwerty' ? '?123' : 'ABC'}
            </Text>
          </TouchableOpacity>

          {layoutModo === 'numeros' && (
            <TouchableOpacity
              style={[styles.modeKey, { backgroundColor: theme.specialKeyBg }]}
              onPress={() => {
                triggerHaptic();
                setLayoutModo('simbolos');
              }}
            >
              <Text style={[styles.specialKeyText, { color: theme.keyText }]}>=\&lt;</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.key, { backgroundColor: theme.keyBg, flex: 1.2 }]}
            onPress={() => handleKeyPress(',')}
          >
            <Text style={[styles.keyText, { color: theme.keyText }]}>,</Text>
          </TouchableOpacity>

          {/* BARRA ESPACIADORA ESTILO GBOARD */}
          <TouchableOpacity
            style={[styles.spaceKey, { backgroundColor: theme.keyBg }]}
            onPress={handleSpace}
          >
            <Text style={[styles.spaceKeyText, { color: theme.keyText }]}>Español</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.key, { backgroundColor: theme.keyBg, flex: 1.2 }]}
            onPress={() => handleKeyPress('.')}
          >
            <Text style={[styles.keyText, { color: theme.keyText }]}>.</Text>
          </TouchableOpacity>

          {/* TECLA ENTER / ACCIÓN */}
          <TouchableOpacity
            style={[styles.enterKey, { backgroundColor: theme.accentKeyBg }]}
            onPress={() => {
              triggerHaptic();
              onInsertText('\n');
            }}
          >
            <Ionicons name="return-down-back-outline" size={22} color={theme.accentKeyText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL PARA GESTIONAR O AGREGAR NUEVOS DATOS RECURRENTES */}
      <Modal
        visible={modalQuickFillVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalQuickFillVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.keyBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.keyText }]}>
                Añadir Dato Frecuente (Autocompletado)
              </Text>
              <TouchableOpacity onPress={() => setModalQuickFillVisible(false)}>
                <Ionicons name="close" size={24} color={theme.keyText} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: theme.keyText }]}>Etiqueta (Ej. Cédula, Nequi, Dirección):</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.keyboardBg, color: theme.keyText }]}
              value={nuevaEtiqueta}
              onChangeText={setNuevaEtiqueta}
              placeholder="Ej. Cédula Personal"
              placeholderTextColor="#9ca3af"
            />

            <Text style={[styles.inputLabel, { color: theme.keyText }]}>Valor a autocompletar:</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.keyboardBg, color: theme.keyText }]}
              value={nuevoValor}
              onChangeText={setNuevaValor}
              placeholder="Ej. 1098765432"
              placeholderTextColor="#9ca3af"
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleGuardarNuevoDato}>
              <Text style={styles.saveButtonText}>Guardar en Autocompletado</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ==================== ESTILOS GBOARD ERGONÓMICOS ====================

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  toolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toolbarButton: {
    padding: 8,
    borderRadius: 20,
  },
  quickFillScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  quickFillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  quickFillLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickFillValue: {
    fontWeight: '400',
    opacity: 0.9,
  },
  predictionChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  predictionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  keysContainer: {
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 3,
  },
  key: {
    flex: 1,
    height: 48,
    marginHorizontal: 2.5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
  },
  keyText: {
    fontSize: 20,
    fontWeight: '500',
  },
  specialKey: {
    width: 48,
    height: 48,
    marginHorizontal: 2.5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  modeKey: {
    width: 56,
    height: 48,
    marginHorizontal: 2.5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  specialKeyText: {
    fontSize: 14,
    fontWeight: '700',
  },
  spaceKey: {
    flex: 4,
    height: 48,
    marginHorizontal: 2.5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  spaceKeyText: {
    fontSize: 13,
    opacity: 0.7,
  },
  enterKey: {
    width: 56,
    height: 48,
    marginHorizontal: 2.5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default CustomGboard;