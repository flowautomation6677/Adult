const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testDatabase() {
  console.log('Iniciando teste de conexão e inserção no PostgreSQL via Prisma...');

  try {
    const mockGeneration = await prisma.generation.create({
      data: {
        type: 'I2V',
        status: 'PENDING',
        prompt: 'A cinematic drone shot of futuristic neon Tokyo, 8k resolution, photorealistic',
        webhook_url: 'https://webhook.site/mock-callback-endpoint',
        output_url: null,
      },
    });

    console.log('✔ Sucesso! Registro mock criado na tabela Generation:');
    console.log(JSON.stringify(mockGeneration, null, 2));
  } catch (error) {
    console.error('❌ Falha ao conectar ou inserir no banco de dados:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();

