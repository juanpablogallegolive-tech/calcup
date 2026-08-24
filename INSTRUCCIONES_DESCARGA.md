# 📥 Cómo Descargar tu Proyecto desde Emergent

## ✅ TODO ESTÁ LISTO

Ya configuré tu aplicación con:
- ✅ Tu ícono personalizado instalado
- ✅ Splash screen configurado
- ✅ Información de la app completa
- ✅ Permisos Android/iOS listos
- ✅ Archivo `eas.json` para generar APK
- ✅ Guía completa en `README_APK.md`

---

## 📱 OPCIÓN 1: Usar Expo Go (Más Rápido - AHORA MISMO)

**Si quieres probar la app YA en tu celular:**

1. Descarga **Expo Go** en tu celular:
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
   - iOS: https://apps.apple.com/app/expo-go/id982107779

2. Abre el navegador en tu celular y ve a:
   ```
   https://calc-flow-sync.preview.emergentagent.com
   ```

3. Escanea el código QR que aparece

4. ¡La app se abrirá en Expo Go!

**Limitación**: Necesitas Expo Go instalado para usar la app.

---

## 🚀 OPCIÓN 2: Generar APK (Para Instalar sin Expo Go)

### PASO 1: Guardar el Proyecto en GitHub

**Desde Emergent:**

1. Busca el botón **"Save to GitHub"** o **"Export to GitHub"** en la interfaz
2. Dale un nombre a tu repositorio: `calculadora-precios`
3. Emergent subirá todo el código a tu GitHub
4. Copia la URL del repositorio que te dará (algo como: `https://github.com/tu-usuario/calculadora-precios`)

**NOTA**: Si no ves opción de GitHub, puedes:
- Descargar todos los archivos manualmente
- Usar la opción de "Download Project" si está disponible

---

### PASO 2: En Tu Computadora

#### A. Instala los Requisitos

1. **Node.js** (obligatorio):
   - Descargar: https://nodejs.org
   - Instala la versión LTS (recomendada)
   - Verifica: Abre terminal y escribe `node --version`

2. **Git** (si usas GitHub):
   - Descargar: https://git-scm.com
   - Instala con opciones por defecto
   - Verifica: `git --version`

#### B. Descarga el Proyecto

**Si usaste GitHub:**
```bash
# Abre la terminal (Command Prompt en Windows)
# Navega a donde quieres guardar el proyecto
cd Desktop

# Clona el repositorio
git clone https://github.com/tu-usuario/calculadora-precios
cd calculadora-precios/frontend
```

**Si descargaste manual:**
```bash
# Extrae el ZIP
# Abre terminal en la carpeta frontend
cd /ruta/a/tu/carpeta/frontend
```

#### C. Instala Dependencias

```bash
# Instala las dependencias del proyecto
npm install

# Esto tomará 2-3 minutos
```

#### D. Instala EAS CLI

```bash
# Instala EAS CLI globalmente
npm install -g eas-cli

# Verifica que se instaló
eas --version
```

---

### PASO 3: Genera el APK

#### A. Crea una Cuenta en Expo (Gratis)

1. Ve a: https://expo.dev/signup
2. Regístrate con tu email
3. Verifica tu email

#### B. Inicia Sesión

```bash
# En la terminal, dentro de la carpeta frontend
eas login

# Ingresa tu email y contraseña de Expo
```

#### C. Genera el APK

```bash
# Este comando genera el APK
eas build --platform android --profile preview

# Presiona 'Y' si pregunta algo
# El proceso tarda 10-15 minutos
```

**Salida esperada:**
```
✔ Build finished

🎉 Tu APK está listo:
https://expo.dev/artifacts/eas/abc123.apk

Descarga e instala en tu dispositivo Android.
```

---

### PASO 4: Instala el APK en tu Celular

1. **Descarga el APK** desde el link que te dio EAS
2. **Pasa el APK a tu celular** (por USB, email, Drive, WhatsApp, etc.)
3. **En tu Android:**
   - Abre el archivo APK
   - Si pregunta "¿Permitir instalación de fuentes desconocidas?" → Presiona SÍ
   - Presiona "Instalar"
   - Espera 10 segundos
   - Presiona "Abrir"

4. **¡LISTO! 🎉** Tu app está instalada como cualquier otra app

---

## 📋 Resumen de Comandos (Copia y Pega)

```bash
# 1. Clonar repositorio (si usas GitHub)
git clone [URL-DE-TU-REPO]
cd calculadora-precios/frontend

# 2. Instalar dependencias
npm install

# 3. Instalar EAS CLI
npm install -g eas-cli

# 4. Login en Expo
eas login

# 5. Generar APK
eas build --platform android --profile preview
```

---

## ❓ Preguntas Frecuentes

### ¿Cuánto cuesta?
**TODO ES GRATIS**:
- Expo: Gratis
- EAS Build: Gratis (con límite de builds al mes)
- Node.js: Gratis
- GitHub: Gratis

### ¿Necesito una Mac para iOS?
- Para Android APK: NO, funciona en Windows/Mac/Linux
- Para iOS IPA: SÍ, necesitas Mac + cuenta Apple Developer ($99/año)

### ¿Puedo publicar en Play Store?
SÍ, pero necesitas:
1. Cuenta Google Play Console ($25 pago único)
2. Cambiar el comando a: `eas build --platform android --profile production`
3. Subir el archivo .aab a Play Console

### ¿Cuánto tarda generar el APK?
- Primera vez: 15-20 minutos
- Siguientes veces: 5-10 minutos

### ¿El APK funciona sin internet?
Depende de tu app:
- La interfaz funciona sin internet
- Las funciones que usan el backend necesitan internet
- Puedes agregar modo offline después

---

## 🆘 Si Tienes Problemas

### Error: "Command not found: eas"
```bash
# Reinstala EAS CLI
npm uninstall -g eas-cli
npm install -g eas-cli
```

### Error: "Project not configured"
```bash
# Configura el proyecto
eas build:configure
```

### Error: "Build failed"
```bash
# Limpia caché y reintenta
eas build --platform android --profile preview --clear-cache
```

### No puedo instalar el APK
- Activa "Instalar apps de fuentes desconocidas" en Configuración → Seguridad
- Si no funciona, prueba con otro método de transferencia

---

## 📞 Soporte

- **Documentación Expo**: https://docs.expo.dev
- **Foro Expo**: https://forums.expo.dev
- **Discord Expo**: https://chat.expo.dev

---

## 🎯 Próximos Pasos

1. ✅ Guarda el proyecto en GitHub desde Emergent
2. ✅ Descarga e instala Node.js en tu PC
3. ✅ Clona el proyecto en tu PC
4. ✅ Sigue las instrucciones en `README_APK.md`
5. ✅ Genera tu APK
6. ✅ Instala en tu celular
7. ✅ ¡Disfruta tu app!

---

**¿Necesitas ayuda?** Vuelve a preguntar y te guío paso a paso. 🚀
