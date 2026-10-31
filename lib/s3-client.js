const { S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin_minio',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'password123',
  },
  forcePathStyle: true, // Obrigatório para o MinIO local
});

module.exports = { s3Client };

