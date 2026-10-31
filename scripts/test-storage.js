const { PutObjectCommand, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../lib/s3-client');
require('dotenv').config();

async function testStorage() {
  const bucketName = process.env.MINIO_BUCKET_NAME || 'inputs';
  const fileName = `test-${Date.now()}.txt`;
  const fileContent = `Upload de teste realizado com sucesso no MinIO via AWS SDK S3 às ${new Date().toISOString()}`;

  console.log(`Iniciando teste de storage no MinIO (Bucket: ${bucketName})...`);

  // Garante que o bucket existe antes do upload caso seja a primeira inicialização do MinIO
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`Bucket "${bucketName}" não existia. Criando automaticamente...`);
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket "${bucketName}" criado.`);
    } else {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      } catch (_) {
        // Prossegue se o bucket já existir ou puder receber uploads
      }
    }
  }

  // a) Upload de arquivo/buffer usando PutObjectCommand
  const putCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: Buffer.from(fileContent, 'utf-8'),
    ContentType: 'text/plain',
  });

  await s3Client.send(putCommand);

  // b) Gera a URL simulando o endpoint público do MinIO (path-style)
  const endpoint = (process.env.MINIO_ENDPOINT || 'http://localhost:9000').replace(/\/$/, '');
  const publicUrl = `${endpoint}/${bucketName}/${fileName}`;

  // c) Console.log indicando sucesso e a URL final
  console.log('✔ Sucesso! Arquivo enviado com êxito para o MinIO.');
  console.log(`✔ URL final: ${publicUrl}`);
}

testStorage().catch((err) => {
  console.error('❌ Falha ao executar teste de storage:', err);
  process.exit(1);
});

