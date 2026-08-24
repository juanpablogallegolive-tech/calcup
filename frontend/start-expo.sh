#!/bin/bash
cd /app/frontend
# Eliminar directorios que no necesitan ser observados
find node_modules -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null
find node_modules -type d -name "android" -exec rm -rf {} + 2>/dev/null  
find node_modules -type d -name "ios" -exec rm -rf {} + 2>/dev/null
find node_modules -type d -name ".git" -exec rm -rf {} + 2>/dev/null
exec yarn expo start --port 3000
