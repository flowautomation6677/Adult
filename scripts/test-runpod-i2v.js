const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runPodTest() {
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;

  console.log('====================================================');
  console.log('🚀 FASE 2: TESTE DE INFERÊNCIA COMFYUI NO RUNPOD');
  console.log('====================================================\n');

  if (!apiKey || apiKey === 'your_runpod_api_key_here' || !endpointId || endpointId === 'your_endpoint_id_here') {
    console.error('❌ ERRO: RUNPOD_API_KEY ou RUNPOD_ENDPOINT_ID não configurados no arquivo .env!');
    console.log('\nPor favor, preencha no seu arquivo .env:');
    console.log('RUNPOD_API_KEY="seu_token_aqui"');
    console.log('RUNPOD_ENDPOINT_ID="id_do_seu_endpoint"\n');
    console.log('Exemplo de comando com Postman / Insomnia descrito abaixo.');
    process.exit(1);
  }

  // Permite passar uma URL customizada via argumento de linha de comando
  const customImageUrl = process.argv[2];
  const inputImageUrl = customImageUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1024&q=80';

  console.log(`📸 Imagem de entrada: ${inputImageUrl}`);

  // Carrega o workflow I2V
  const workflowPath = path.join(__dirname, '..', 'workflows', 'workflow_i2v.json');
  const workflowRaw = fs.readFileSync(workflowPath, 'utf8');
  const workflow = JSON.parse(workflowRaw);

  // Injeta a URL no nó LoadImage (Node 1)
  if (workflow['1'] && workflow['1'].inputs) {
    workflow['1'].inputs.image = inputImageUrl;
  }

  const runUrl = `https://api.runpod.ai/v2/${endpointId}/run`;

  console.log(`\n📡 1. Disparando inferência para: ${runUrl}...`);

  const runResponse = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: {
        workflow: workflow,
      },
    }),
  });

  if (!runResponse.ok) {
    const errorBody = await runResponse.text();
    throw new Error(`Falha no disparo RunPod (HTTP ${runResponse.status}): ${errorBody}`);
  }

  const runData = await runResponse.json();
  const jobId = runData.id;
  console.log(`✔ Job iniciado com sucesso!`);
  console.log(`🔑 Job ID: ${jobId}`);
  console.log(`📊 Status Inicial: ${runData.status}\n`);

  // Polling em /status/{id}
  const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`;
  console.log(`⏳ 2. Monitorando progresso em: ${statusUrl}...`);

  const startTime = Date.now();
  let completed = false;

  while (!completed) {
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const statusRes = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!statusRes.ok) {
      console.warn(`Aviso: HTTP ${statusRes.status} ao checar status, tentando novamente...`);
      continue;
    }

    const statusData = await statusRes.json();
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

    process.stdout.write(`\r⌛ [${elapsedSeconds}s] Status do Job: ${statusData.status}... `);

    if (statusData.status === 'COMPLETED') {
      completed = true;
      console.log('\n\n🎉 INFERÊNCIA CONCLUÍDA COM SUCESSO!');
      console.log('Resultado da API:');
      console.log(JSON.stringify(statusData.output, null, 2));

      // Salva o vídeo se houver URL ou base64
      await handleVideoOutput(statusData.output, jobId);
      break;
    }

    if (statusData.status === 'FAILED') {
      console.log('\n\n❌ O Job falhou no RunPod!');
      console.error(JSON.stringify(statusData, null, 2));
      process.exit(1);
    }
  }
}

async function handleVideoOutput(output, jobId) {
  const outputsDir = path.join(__dirname, '..', 'outputs');
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
  }

  // Tenta extrair URL de vídeo ou base64 retornado pelo ComfyUI worker
  let videoUrl = null;
  let base64Data = null;

  if (typeof output === 'string' && (output.startsWith('http://') || output.startsWith('https://'))) {
    videoUrl = output;
  } else if (output && typeof output === 'object') {
    if (output.video_url) videoUrl = output.video_url;
    if (output.url) videoUrl = output.url;
    if (output.video) base64Data = output.video;
    if (Array.isArray(output.images) && output.images[0]?.url) videoUrl = output.images[0].url;
  }

  if (videoUrl) {
    const destPath = path.join(outputsDir, `output-${jobId}.mp4`);
    console.log(`\n⬇ Baixando vídeo gerado de: ${videoUrl}`);
    const videoRes = await fetch(videoUrl);
    const buffer = await videoRes.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    console.log(`✔ Vídeo salvo em: ${destPath}`);
  } else if (base64Data) {
    const destPath = path.join(outputsDir, `output-${jobId}.mp4`);
    const cleanBase64 = base64Data.replace(/^data:video\/\w+;base64,/, '');
    fs.writeFileSync(destPath, Buffer.from(cleanBase64, 'base64'));
    console.log(`✔ Vídeo base64 salvo com sucesso em: ${destPath}`);
  } else {
    console.log('\nℹ Os dados retornados pelo output foram salvos no log acima.');
  }
}

runPodTest().catch((err) => {
  console.error('\n❌ Erro durante o teste:', err.message);
  process.exit(1);
});
