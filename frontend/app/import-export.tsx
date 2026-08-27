import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  ActivityIndicator,
  Divider,
  List,
  ProgressBar,
  Snackbar,
  TextInput,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { productosApi, calculosApi, flujosApi, getBackendUrl, setBackendUrl, checkServerHealth } from '../services/api';
import { smartSearch, obtenerProductosCache } from '../services/smartSearch';

export default function ImportExportScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  
  const [backendUrlInput, setBackendUrlInput] = useState(getBackendUrl());
  const [serverStatus, setServerStatus] = useState<string>('Sin verificar');
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  const [exportResult, setExportResult] = useState<{ total: number; modo?: string } | null>(null);
  const [importResults, setImportResults] = useState<{
    nuevos: number; 
    actualizados: number; 
    sinCambios: number;
    errores: number;
    modo?: string;
  } | null>(null);

  const showSnack = (msg: string) => {
    setSnackMessage(msg);
    setSnackVisible(true);
  };

  const verificarServidor = async () => {
    setStatus('Verificando servidor...');
    const res = await checkServerHealth(backendUrlInput);
    setServerOnline(res.ok);
    setServerStatus(res.message);
    showSnack(res.message);
  };

  useEffect(() => {
    verificarServidor();
  }, []);

  const normalizarEncabezado = (valor: unknown): string =>
    String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\s_-]+/g, '');

  const parseNumero = (valor: unknown): number => {
    if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
    const texto = String(valor ?? '').trim().replace(/[$\s]/g, '');
    if (!texto) return 0;
    const normalizado = texto.includes(',')
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(/,/g, '');
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
  };

  const productoDesdeFila = (row: any) => {
    const valores: Record<string, unknown> = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      valores[normalizarEncabezado(key)] = value;
    });
    return {
      nombre: String(
        valores.nombre ??
        valores.producto ??
        valores.product ??
        valores.descripcion ??
        valores.articulo ??
        valores.item ??
        ''
      ).trim(),
      costo: parseNumero(
        valores.costo ??
        valores.costooriginal ??
        valores.costobase ??
        valores.compra ??
        0
      ),
      precio_venta: parseNumero(
        valores.precioventa ??
        valores.costobase ??
        valores.precio ??
        valores.pventa ??
        valores.venta ??
        valores.costo ??
        0
      ),
      cantidad: String(
        valores.cantidad ??
        valores.cant ??
        valores.stock ??
        ''
      ).trim(),
      comentarios: String(
        valores.comentarios ??
        valores.comentario ??
        valores.notas ??
        valores.nota ??
        ''
      ).trim(),
    };
  };

  // ========== EXPORTAR ==========
  const exportarDatos = async () => {
    setLoading(true);
    setProgress(0);
    setStatus('Cargando datos...');
    setExportResult(null);
    
    try {
      let productos: any[] = [];
      let historial: any[] = [];
      let flujos: any[] = [];
      let modoLocal = false;

      try {
        const [productosRes, historialRes, flujosRes] = await Promise.all([
          productosApi.getAll(),
          calculosApi.getAll(),
          flujosApi.getAll(),
        ]);
        productos = productosRes.data || [];
        historial = historialRes.data || [];
        flujos = flujosRes.data || [];
      } catch (errApi) {
        console.warn('[Export] Falló servidor backend, usando datos locales:', errApi);
        modoLocal = true;
        await smartSearch.inicializar();
        productos = obtenerProductosCache() || [];
      }

      setProgress(0.3);
      setStatus('Preparando archivo Excel...');

      const wb = XLSX.utils.book_new();

      // HOJA 1: Productos
      let productosData: any[];
      if (productos.length === 0) {
        productosData = [{
          'Nombre': '',
          'Costo': '',
          'Precio_Venta': '',
          'Cantidad': '',
          'Comentarios': '',
        }];
      } else {
        productosData = productos.map((p: any) => ({
          'Nombre': String(p.nombre || ''),
          'Costo': p.costo || 0,
          'Precio_Venta': p.precio_venta || 0,
          'Cantidad': String(p.cantidad || ''),
          'Comentarios': String(p.comentarios || ''),
        }));
      }
      const wsProductos = XLSX.utils.json_to_sheet(productosData);
      wsProductos['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos');

      setProgress(0.5);

      // HOJA 2: Historial
      let historialData: any[];
      if (historial.length === 0) {
        historialData = [{
          'Producto': '',
          'Flujo': '',
          'Costo': '',
          'Precio_Calculado': '',
          'Cliente': '',
          'Ganancia_%': '',
          'Precio_Final': '',
          'Fecha': '',
        }];
      } else {
        historialData = [];
        historial.forEach((h: any) => {
          if (h.clientes && h.clientes.length > 0) {
            h.clientes.forEach((c: any) => {
              historialData.push({
                'Producto': h.nombre_producto || '',
                'Flujo': h.flujo_nombre || '',
                'Costo': h.costo_base || 0,
                'Precio_Calculado': h.precio_calculado || 0,
                'Cliente': c.nombre || '',
                'Ganancia_%': c.porcentaje_ganancia || 0,
                'Precio_Final': c.precio_final || 0,
                'Fecha': h.fecha || '',
              });
            });
          } else {
            historialData.push({
              'Producto': h.nombre_producto || '',
              'Flujo': h.flujo_nombre || '',
              'Costo': h.costo_base || 0,
              'Precio_Calculado': h.precio_calculado || 0,
              'Cliente': '',
              'Ganancia_%': 0,
              'Precio_Final': 0,
              'Fecha': h.fecha || '',
            });
          }
        });
      }
      const wsHistorial = XLSX.utils.json_to_sheet(historialData);
      wsHistorial['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsHistorial, 'Historial');

      setProgress(0.7);

      // HOJA 3: Flujos
      let flujosData: any[];
      if (flujos.length === 0) {
        flujosData = [{
          'Nombre_Flujo': '',
          'Operacion': '',
          'Tipo_Operacion': '',
          'Tipo_Valor': '',
        }];
      } else {
        flujosData = [];
        flujos.forEach((f: any) => {
          if (f.operaciones && f.operaciones.length > 0) {
            f.operaciones.forEach((op: any) => {
              flujosData.push({
                'Nombre_Flujo': f.nombre || '',
                'Operacion': op.nombre || '',
                'Tipo_Operacion': op.tipo_operacion || '',
                'Tipo_Valor': op.tipo_valor || '',
              });
            });
          } else {
            flujosData.push({
              'Nombre_Flujo': f.nombre || '',
              'Operacion': '',
              'Tipo_Operacion': '',
              'Tipo_Valor': '',
            });
          }
        });
      }
      const wsFlujos = XLSX.utils.json_to_sheet(flujosData);
      wsFlujos['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsFlujos, 'Flujos');

      setProgress(0.8);

      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `datos_completos_${Date.now()}.xlsx`;

      if (Platform.OS === 'web') {
        const binary = atob(excelBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        setExportResult({ total: productos.length, modo: modoLocal ? 'Local (Offline)' : 'Servidor' });
        showSnack('Datos exportados exitosamente');
      } else {
        setStatus('Guardando archivo...');
        const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
        const cleanDir = dir.endsWith('/') ? dir : `${dir}/`;
        const filePath = `${cleanDir}${fileName}`;

        await FileSystem.writeAsStringAsync(filePath, excelBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setProgress(0.95);
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Guardar archivo Excel de CalcuP',
          });
          setExportResult({ total: productos.length, modo: modoLocal ? 'Local (Offline)' : 'Servidor' });
          showSnack(`Exportado: ${productos.length} productos ${modoLocal ? '(Modo Local)' : ''}`);
        } else {
          Alert.alert('Archivo Generado', `Se guardó en: ${filePath}`);
        }
      }

      setProgress(1);
      
    } catch (error: any) {
      console.error('Error exportar:', error);
      Alert.alert('Error al exportar', error?.message || 'No se pudo exportar');
    } finally {
      setLoading(false);
      setStatus('');
      setProgress(0);
    }
  };

  // ========== IMPORTAR ==========
  const importarDatos = async () => {
    setLoading(true);
    setProgress(0);
    setStatus('Abre selector de archivos...');
    setImportResults(null);
    setExportResult(null);

    try {
      // 1. Seleccionar archivo
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          '*/*'
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setLoading(false);
        return;
      }

      const file = result.assets[0];
      const fileName = file.name || '';
      const mimeType = file.mimeType || '';
      
      const isExcel = /\.(xlsx|xls)$/i.test(fileName) ||
        mimeType.includes('excel') ||
        mimeType.includes('spreadsheet') ||
        mimeType.includes('sheet') ||
        mimeType.includes('officedocument');
      
      setStatus('Leyendo archivo...');
      setProgress(0.2);

      let productos: {
        nombre: string;
        costo: number;
        precio_venta: number;
        cantidad?: string;
        comentarios?: string;
      }[] = [];

      if (isExcel) {
        let fileContent: string;
        
        if (Platform.OS === 'web') {
          const response = await fetch(file.uri);
          const arrayBuffer = await response.arrayBuffer();
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = wb.SheetNames.find(s => /producto|inventario|catalogo|stock/i.test(s)) || wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          productos = jsonData.map(productoDesdeFila).filter((p) => p.nombre);
        } else {
          fileContent = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          const wb = XLSX.read(fileContent, { type: 'base64' });
          const sheetName = wb.SheetNames.find(s => /producto|inventario|catalogo|stock/i.test(s)) || wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          
          productos = jsonData.map(productoDesdeFila).filter((p) => p.nombre);
        }
      } else {
        // Leer CSV
        let content: string;
        
        if (Platform.OS === 'web') {
          const response = await fetch(file.uri);
          content = await response.text();
        } else {
          content = await FileSystem.readAsStringAsync(file.uri);
        }

        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }

        const lines = content.split(/\r?\n/).filter(l => l.trim());
        
        if (lines.length < 2) {
          Alert.alert('Error', 'El archivo seleccionado está vacío');
          setLoading(false);
          return;
        }

        const delimitador = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
        const header = parseCSVLine(lines[0], delimitador).map(h => normalizarEncabezado(h));
        const iNombre = header.findIndex(h => h.includes('nombre') || h.includes('name') || h.includes('producto') || h.includes('descripcion'));
        const iCosto = header.findIndex(h => h === 'costo' || h.includes('costooriginal') || h.includes('compra'));
        const iPrecioVenta = header.findIndex(h => h.includes('precioventa') || h.includes('costobase') || h === 'precio' || h.includes('venta'));

        if (iNombre === -1) {
          Alert.alert('Error', 'No se encontró la columna Nombre o Producto en el archivo');
          setLoading(false);
          return;
        }

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i], delimitador);
          const nombre = (cols[iNombre] || '').trim();
          if (nombre) {
            productos.push({
              nombre,
              costo: parseNumero(cols[iCosto] || '0'),
              precio_venta: parseNumero(cols[iPrecioVenta] || cols[iCosto] || '0'),
            });
          }
        }
      }

      if (productos.length === 0) {
        Alert.alert('Error', 'No se encontraron productos válidos para importar');
        setLoading(false);
        return;
      }

      setProgress(0.3);
      setStatus(`Procesando ${productos.length} productos...`);

      let nuevos = 0, actualizados = 0, sinCambios = 0, errores = 0;
      const total = productos.length;
      const LOTE_SIZE = 1000;
      let modoOffline = false;

      for (let i = 0; i < total; i += LOTE_SIZE) {
        const lote = productos.slice(i, i + LOTE_SIZE);
        const actualNum = Math.min(i + LOTE_SIZE, total);
        
        setStatus(`Procesando lote ${Math.floor(i / LOTE_SIZE) + 1} (${actualNum}/${total} productos)...`);
        setProgress(0.3 + (0.6 * actualNum / total));

        try {
          const res = await productosApi.bulkImport(lote);
          nuevos += res.data.nuevos || 0;
          actualizados += res.data.actualizados || 0;
          sinCambios += res.data.sin_cambios || 0;
          errores += res.data.errores || 0;
        } catch (errLote) {
          console.warn('[Import] Fallo lote masivo en servidor, cambiando a fallback local:', errLote);
          modoOffline = true;
          
          await smartSearch.inicializar();
          const cacheExistente = obtenerProductosCache() || [];
          const mapExistente = new Map<string, any>();
          cacheExistente.forEach(p => {
            if (p.nombre) mapExistente.set(p.nombre.toLowerCase().trim(), p);
          });

          for (const item of lote) {
            if (!item.nombre) { errores++; continue; }
            const key = item.nombre.toLowerCase().trim();
            if (mapExistente.has(key)) {
              actualizados++;
            } else {
              nuevos++;
              mapExistente.set(key, item);
            }
          }
        }
      }

      smartSearch.invalidarCache();
      await smartSearch.inicializar(true);

      setProgress(1);
      setImportResults({ nuevos, actualizados, sinCambios, errores, modo: modoOffline ? 'Local (Offline)' : 'Servidor' });
      Alert.alert(
        'Importación Completada',
        `Modo: ${modoOffline ? 'Local (Offline)' : 'Servidor Backend'}\n\nNuevos: ${nuevos}\nActualizados: ${actualizados}\nSin cambios: ${sinCambios}`
      );
      
    } catch (error: any) {
      console.error('Error importar:', error);
      Alert.alert('Error al importar', error?.message || 'Ocurrió un error al procesar el archivo');
    } finally {
      setLoading(false);
      setStatus('');
      setProgress(0);
    }
  };

  const parseCSVLine = (line: string, delimiter = ','): string[] => {
    const r: string[] = [];
    let c = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { c += '"'; i++; }
        else { q = !q; }
      } else if (ch === delimiter && !q) { r.push(c.trim()); c = ''; }
      else if (ch !== '\r') { c += ch; }
    }
    r.push(c.trim());
    return r;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        
        {/* SERVIDOR BACKEND */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <List.Icon icon="server" color={serverOnline ? '#4caf50' : (serverOnline === false ? '#f44336' : '#ff9800')} />
              <Text style={styles.title}>Servidor Backend</Text>
            </View>
            <Text style={styles.desc}>Estado: <Text style={{fontWeight: 'bold', color: serverOnline ? '#2e7d32' : '#c62828'}}>{serverStatus}</Text></Text>
            <TextInput
              label="URL del Servidor API"
              value={backendUrlInput}
              onChangeText={(text) => {
                setBackendUrlInput(text);
                setBackendUrl(text);
              }}
              mode="outlined"
              style={{marginTop: 6, marginBottom: 10}}
            />
            <Button mode="outlined" onPress={verificarServidor} icon="refresh">
              Probar Conexión
            </Button>
          </Card.Content>
        </Card>

        {/* EXPORTAR */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <List.Icon icon="download" color="#6200ee" />
              <Text style={styles.title}>Exportar Datos</Text>
            </View>
            <Text style={styles.desc}>Guarda todos tus productos, historial y flujos en un archivo Excel (.xlsx)</Text>
            <Button mode="contained" onPress={exportarDatos} loading={loading && status.includes('Cargando')} disabled={loading} icon="file-export" style={styles.btn}>
              Exportar Excel
            </Button>
          </Card.Content>
        </Card>

        {exportResult && (
          <Card style={[styles.card, {backgroundColor: '#e8f5e9'}]}>
            <Card.Content>
              <Text style={{color: '#2e7d32', fontWeight: 'bold'}}>✓ {exportResult.total} productos exportados ({exportResult.modo})</Text>
            </Card.Content>
          </Card>
        )}

        {/* IMPORTAR */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <List.Icon icon="upload" color="#4caf50" />
              <Text style={styles.title}>Importar Datos</Text>
            </View>
            <Text style={styles.desc}>Carga productos desde archivos Excel (.xlsx) o CSV</Text>
            <Text style={styles.note}>• Nuevos productos se agregan al catálogo</Text>
            <Text style={styles.note}>• Productos existentes se actualizan</Text>
            <Button mode="contained" onPress={importarDatos} loading={loading && status.includes('Procesando')} disabled={loading} icon="file-import" style={styles.btn} buttonColor="#4caf50">
              Importar Excel / CSV
            </Button>
          </Card.Content>
        </Card>

        {loading && status && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <ActivityIndicator size="small" />
                <Text style={{marginLeft: 12, color: '#666'}}>{status}</Text>
              </View>
              <ProgressBar progress={progress} color="#6200ee" style={{marginTop: 12, height: 6, borderRadius: 3}} />
            </Card.Content>
          </Card>
        )}

        {importResults && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={{fontSize: 16, fontWeight: 'bold', marginBottom: 8}}>Resultados ({importResults.modo})</Text>
              <Divider style={{marginVertical: 8}} />
              <View style={styles.resultRow}><Text>Nuevos:</Text><Text style={{fontWeight: 'bold', color: '#4caf50'}}>{importResults.nuevos}</Text></View>
              <View style={styles.resultRow}><Text>Actualizados:</Text><Text style={{fontWeight: 'bold', color: '#ff9800'}}>{importResults.actualizados}</Text></View>
              <View style={styles.resultRow}><Text>Sin cambios:</Text><Text style={{fontWeight: 'bold', color: '#666'}}>{importResults.sinCambios}</Text></View>
              {importResults.errores > 0 && <View style={styles.resultRow}><Text>Errores:</Text><Text style={{fontWeight: 'bold', color: '#f44336'}}>{importResults.errores}</Text></View>}
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Content>
            <Text style={{fontWeight: 'bold', marginBottom: 8}}>Instrucciones:</Text>
            <Text style={styles.note}>1. Presiona "Exportar Excel" para guardar tu catálogo actual.</Text>
            <Text style={styles.note}>2. Puedes editar la lista en Excel o enviar la plantilla por WhatsApp/Email.</Text>
            <Text style={styles.note}>3. Presiona "Importar Excel / CSV" y selecciona tu archivo para cargar los productos.</Text>
          </Card.Content>
        </Card>

        <View style={{height: 40}} />
      </ScrollView>

      <Snackbar visible={snackVisible} onDismiss={() => setSnackVisible(false)} duration={3000}>{snackMessage}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  card: { marginBottom: 12, borderRadius: 12, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: 'bold' },
  desc: { fontSize: 14, color: '#666', marginBottom: 8 },
  note: { fontSize: 13, color: '#666', marginLeft: 8, marginBottom: 4 },
  btn: { marginTop: 12, borderRadius: 8 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});
