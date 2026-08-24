# 🔧 Solución: Error de Conexión MongoDB en Render

## ❌ Error Actual

```
❌ Error extrayendo sinónimos dinámicos: localhost:27017: [Errno 111] Connection refused
```

## 🎯 Causa del Problema

El backend está intentando conectarse a `localhost:27017` porque **las variables de entorno no están configuradas en Render**. Cuando el código no encuentra la variable `MONGO_URL`, usa el valor por defecto:

```python
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")  # ← Usa localhost por defecto
```

En Render (producción), no hay MongoDB corriendo en localhost, por eso falla.

---

## ✅ Solución: Configurar Variables de Entorno en Render

### Paso 1: Conseguir tu URL de MongoDB Atlas

Si ya tienes MongoDB Atlas configurado:

1. Ve a [MongoDB Atlas](https://cloud.mongodb.com/)
2. Inicia sesión
3. Selecciona tu cluster
4. Click en **"Connect"**
5. Selecciona **"Connect your application"**
6. Copia la **Connection String** (se ve algo así):
   ```
   mongodb+srv://usuario:contraseña@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. **Reemplaza** `<password>` con tu contraseña real
8. **Verifica** que tu IP esté en la lista blanca (o permite 0.0.0.0/0 para permitir todas)

### Paso 2: Configurar Variables de Entorno en Render

1. Ve a tu [Dashboard de Render](https://dashboard.render.com/)
2. Selecciona tu servicio backend (el que tiene el error)
3. Click en **"Environment"** en el menú izquierdo
4. Click en **"Add Environment Variable"**
5. Agrega las siguientes variables:

| Key | Value | Ejemplo |
|-----|-------|---------|
| `MONGO_URL` | Tu connection string de MongoDB Atlas | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority` |
| `DB_NAME` | Nombre de tu base de datos | `calculadora_precios` |

**⚠️ IMPORTANTE:**
- La URL debe estar completa (con usuario y contraseña)
- NO uses comillas alrededor de los valores
- Si tu contraseña tiene caracteres especiales (@, #, $, etc.), codifícalos en URL:
  - `@` → `%40`
  - `#` → `%23`
  - `$` → `%24`
  - `%` → `%25`

### Paso 3: Guardar y Hacer Deploy

1. Click en **"Save Changes"** en Render
2. Render automáticamente hará **redeploy** de tu servicio
3. Espera a que el deploy termine (puedes ver el log en tiempo real)

### Paso 4: Verificar la Conexión

Una vez que el deploy termine, verifica los logs:

1. En Render, ve a tu servicio
2. Click en **"Logs"** en el menú izquierdo
3. Busca mensajes de error relacionados con MongoDB
4. Si todo está bien, NO deberías ver más errores de conexión

---

## 🧪 Probar la Conexión desde tu App

Una vez configurado:

1. Abre tu app móvil
2. Ve a la sección de **"Cotizar"** o **"Escanear"**
3. Intenta escanear algunos productos
4. Si todo funciona, el analizador debería:
   - Buscar similitudes correctamente
   - Usar sinónimos aprendidos
   - NO mostrar errores de conexión

---

## 🔍 Troubleshooting

### Error: "Authentication failed"

**Causa:** Usuario o contraseña incorrectos

**Solución:**
1. Verifica que tu contraseña sea correcta
2. Codifica caracteres especiales en la URL
3. Asegúrate de que el usuario tenga permisos de lectura/escritura

### Error: "connection attempt failed: HostUnreachable"

**Causa:** IP no está en la lista blanca de MongoDB Atlas

**Solución:**
1. Ve a MongoDB Atlas → Network Access
2. Click en "Add IP Address"
3. Selecciona **"Allow Access from Anywhere"** (0.0.0.0/0)
4. Guarda los cambios

### Error: "Connection timeout"

**Causa:** La URL de conexión está mal formada

**Solución:**
1. Verifica que la URL sea correcta
2. Asegúrate de tener `mongodb+srv://` al inicio
3. Verifica que no haya espacios en la URL

### El servicio no redeploy después de guardar

**Solución:**
1. Ve a tu servicio en Render
2. Click en **"Manual Deploy"** → **"Deploy latest commit"**
3. Espera a que termine

---

## 📋 Checklist de Verificación

Antes de cerrar, verifica que:

- [ ] MongoDB Atlas está accesible y funcionando
- [ ] La IP de Render está en la lista blanca (o 0.0.0.0/0 permitido)
- [ ] Las variables `MONGO_URL` y `DB_NAME` están configuradas en Render
- [ ] La URL de conexión tiene usuario y contraseña correctos
- [ ] Caracteres especiales están codificados en URL
- [ ] El servicio hizo redeploy después de agregar las variables
- [ ] Los logs de Render NO muestran errores de conexión
- [ ] La app móvil puede escanear productos sin errores

---

## 🚀 Después de Configurar

Una vez que MongoDB esté conectado correctamente:

1. El analizador funcionará en producción
2. Podrás ver los productos escaneados en tiempo real
3. El sistema de aprendizaje guardará correcciones
4. Los sinónimos dinámicos se extraerán automáticamente

---

## 💡 Tip: Usar .env para Testing Local

Si quieres probar localmente antes de subir a Render:

1. Crea un archivo `.env` en la carpeta `backend/`:

```env
MONGO_URL=mongodb+srv://usuario:contraseña@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=calculadora_precios
```

2. Instala las dependencias:
```bash
pip install python-dotenv
```

3. Ejecuta el backend localmente:
```bash
cd backend
python server.py
```

4. Verifica que se conecte correctamente a MongoDB Atlas

**⚠️ NO subas el archivo `.env` a GitHub** (ya está en `.gitignore`)

---

## 📞 ¿Necesitas Más Ayuda?

Si después de seguir estos pasos sigues teniendo problemas:

1. Copia el error completo de los logs de Render
2. Verifica que MongoDB Atlas esté funcionando (prueba conectarte con MongoDB Compass)
3. Revisa que las variables de entorno estén exactamente como se muestran arriba (sin espacios, sin comillas)

---

**Fecha de creación:** 5 de agosto de 2026  
**Versión:** 1.0
