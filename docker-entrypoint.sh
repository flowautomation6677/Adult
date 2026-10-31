#!/bin/sh
set -e

echo "Verificando e sincronizando banco de dados via Prisma..."
# Tenta sincronizar o banco com retry caso o postgres ainda esteja subindo
for i in 1 2 3 4 5; do
  prisma db push --skip-generate && break || {
    echo "Aguardando banco de dados (tentativa $i/5)..."
    sleep 2
  }
done

echo "Iniciando aplicação Next.js..."
exec node server.js
