# 📱 Guía Completa: Generar APK de Calculadora de Precios

## ✅ Tu App está 100% Configurada y Lista

Ya configuré TODO lo necesario:
- ✅ Ícono de la app instalado
- ✅ Splash screen configurado
- ✅ Información de la app completada
- ✅ Permisos de Android/iOS configurados
- ✅ Archivos EAS Build creados
- ✅ Configuración de producción lista

---

## 🚀 Pasos para Generar tu APK

### **PASO 1: Requisitos en tu Computadora**

Antes de empezar, instala:

1. **Node.js** (versión 18+)
   - Descargar: https://nodejs.org
   - Verifica con: `node --version`

2. **Git** (para descargar el proyecto)
   - Descargar: https://git-scm.com
   - Verifica con: `git --version`

3. **Cuenta Expo** (GRATIS)
   - Regístrate: https://expo.dev/signup

---

### **PASO 2: Descargar el Proyecto**

#### Opción A - Desde GitHub (Recomendado):
```bash
# 1. Guarda el proyecto en GitHub desde Emergent
# 2. En tu computadora, clona el repositorio:
git clone [URL-DE-TU-REPOSITORIO]
cd calculadora-precios
```

#### Opción B - Descarga Directa:
```bash
# 1. Descarga el proyecto desde Emergent
# 2. Extrae el ZIP a una carpeta
# 3. Abre la terminal en esa carpeta
cd /ruta/a/tu/carpeta/frontend
```

---

### **PASO 3: Instalar Dependencias**

En la terminal, dentro de la carpeta `frontend`:

```bash
# Instalar las dependencias del proyecto
npm install

# O si prefieres yarn:
yarn install
```

---

### **PASO 4: Instalar EAS CLI**

```bash
# Instalar EAS CLI globalmente
npm install -g eas-cli

# Verificar instalación
eas --version
```

---

### **PASO 5: Configurar EAS Build**

```bash
# 1. Iniciar sesión en Expo
eas login
# Te pedirá tu email y contraseña de Expo

# 2. Configurar el proyecto (SOLO LA PRIMERA VEZ)
eas build:configure
# Presiona Enter para aceptar los valores por defecto
```

---

### **PASO 6: Generar el APK** 🎉

```bash
# Generar APK de prueba (NO necesita Google Play Console)
eas build --platform android --profile preview

# El proceso tomará 10-15 minutos
# Al finalizar, te dará un link para descargar el APK
```

**Ejemplo de salida:**
```
✔ Build finished

🎉 APK listo para descargar:
https://expo.dev/artifacts/eas/[ID-UNICO].apk

Instala el APK en tu dispositivo Android.
```

---

### **PASO 7: Instalar el APK en tu Celular**

1. **Descarga el APK** desde el link que te dio EAS
2. **Transfiere el APK** a tu celular (USB, email, Drive, etc.)
3. **En tu celular Android:**
   - Ve a Configuración → Seguridad
   - Activa "Instalar apps de fuentes desconocidas"
   - Abre el archivo APK
   - Presiona "Instalar"
4. **¡Listo!** La app se instalará como cualquier otra app

---

## 📦 Generar para Play Store

Si quieres publicar en Google Play Store:

```bash
# Generar App Bundle (formato requerido por Play Store)
eas build --platform android --profile production

# Esto genera un .aab en lugar de .apk
# Sube el .aab a Google Play Console
```

---

## 🍎 Generar para iOS (iPhone/iPad)

```bash
# Para App Store
eas build --platform ios --profile production

# Necesitarás:
# - Cuenta de Apple Developer ($99/año)
# - Certificados de firma
```

---

## ⚠️ Solución de Problemas

### Error: "Project ID not found"
```bash
# Actualiza el projectId en app.json
# Luego ejecuta:
eas build:configure
```

### Error: "Build failed"
- Verifica que todas las dependencias estén instaladas
- Asegúrate de estar en la carpeta `frontend`
- Intenta de nuevo con: `eas build --platform android --profile preview --clear-cache`

### Error: "Unable to authenticate"
```bash
# Vuelve a iniciar sesión
eas logout
eas login
```

---

## 📝 Comandos Rápidos de Referencia

```bash
# Ver builds anteriores
eas build:list

# Ver detalles de un build
eas build:view [BUILD-ID]

# Cancelar un build en progreso
eas build:cancel

# Generar APK rápido
eas build -p android --profile preview

# Generar para producción
eas build -p android --profile production
```

---

## 🎯 Configuración Actual

**Información de la App:**
- **Nombre**: Calculadora de Precios
- **Package**: com.calculadoraprecios.app
- **Versión**: 1.0.0
- **Ícono**: ✅ Configurado (tu logo)
- **Splash**: ✅ Configurado (color púrpura #6200ee)
- **Permisos**: Cámara, Almacenamiento

**Archivos Configurados:**
- ✅ `app.json` - Configuración principal
- ✅ `eas.json` - Configuración de builds
- ✅ Assets (ícono, splash) - Listos

---

## 📱 Perfiles de Build Disponibles

### `preview` (Recomendado para testing)
- Genera APK directo
- No requiere cuenta de Play Store
- Instalación directa en dispositivos
- Ideal para probar antes de publicar

### `production`
- Genera App Bundle (.aab)
- Requerido para Play Store
- Versión optimizada
- Necesita configuración adicional

---

## 🆘 ¿Necesitas Ayuda?

1. **Documentación Oficial**: https://docs.expo.dev/build/setup/
2. **Foro de Expo**: https://forums.expo.dev
3. **Discord de Expo**: https://chat.expo.dev

---

## ✨ Próximos Pasos Recomendados

1. ✅ Genera tu primer APK con `eas build --platform android --profile preview`
2. ✅ Prueba la app en tu dispositivo
3. ✅ Si todo funciona bien, genera el build de producción
4. ✅ Publica en Google Play Store

---

**¡Tu app está lista para ser compilada! 🚀**

**Recuerda**: El proceso de build tarda 10-15 minutos. Puedes cerrar la terminal mientras esperas, recibirás un email cuando esté listo.
