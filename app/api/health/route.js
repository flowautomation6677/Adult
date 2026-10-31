import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { s3Client } from '@/lib/s3-client';
import { PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    database: null,
    storage: null,
  };

  // 1. Testa Conexão com PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    let generationCount = 0;
    try {
      generationCount = await prisma.generation.count();
      results.database = {
        status: 'CONNECTED',
        tablesReady: true,
        totalGenerations: generationCount,
        message: 'PostgreSQL conectado e tabela Generation pronta.',
      };
    } catch (tableErr) {
      results.database = {
        status: 'CONNECTED',
        tablesReady: false,
        message: 'Conectado ao PostgreSQL, mas execute "npx prisma db push" para criar as tabelas.',
        details: tableErr.message,
      };
    }
  } catch (err) {
    results.database = {
      status: 'ERROR',
      error: err.message,
    };
  }

  // 2. Testa Conexão com MinIO (S3)
  try {
    const bucketName = process.env.MINIO_BUCKET_NAME || 'inputs';
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      } catch (_) {}
    }

    const testFile = `health-${Date.now()}.txt`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testFile,
        Body: Buffer.from(`Health check test at ${new Date().toISOString()}`),
        ContentType: 'text/plain',
      })
    );

    results.storage = {
      status: 'CONNECTED',
      bucket: bucketName,
      message: `MinIO S3 funcionando. Upload de teste criado: ${testFile}`,
    };
  } catch (err) {
    results.storage = {
      status: 'ERROR',
      error: err.message,
    };
  }

  const isHealthy =
    results.database?.status === 'CONNECTED' &&
    results.storage?.status === 'CONNECTED';

  results.status = isHealthy ? 'ONLINE' : 'DEGRADED';

  return NextResponse.json(results, { status: isHealthy ? 200 : 503 });
}

