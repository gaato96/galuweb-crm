/**
 * script: deploy-demo.js
 * 
 * Este script automatiza tu flujo de despliegue para demos y actualiza tu CRM automáticamente:
 * 1. Despliega tu proyecto local actual a Vercel usando la Vercel CLI.
 * 2. Extrae el link publicado de la salida de Vercel.
 * 3. Llama a la API de tu CRM Galuweb para registrar la demo en el cliente y generar el mensaje de WhatsApp.
 * 
 * Uso:
 *   node deploy-demo.js --client=[ID_DEL_CLIENTE_EN_EL_CRM]
 * 
 * Requisitos:
 *   - Vercel CLI instalado (npm i -g vercel)
 *   - Estar logueado en Vercel (vercel login)
 */

const { execSync } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
const clientArg = args.find(a => a.startsWith('--client='));

if (!clientArg) {
  console.error("\x1b[31mError: Debes proveer el ID del cliente del CRM usando --client=[ID]\x1b[0m");
  console.log("Ejemplo: node deploy-demo.js --client=c7b39a8c-4f12-4d2b-aa90-349c118e69d7");
  process.exit(1);
}

const clienteId = clientArg.split('=')[1];

// Puedes cambiar esto a la URL de producción de tu CRM en Vercel
const CRM_BASE_URL = process.env.CRM_URL || "http://localhost:3000";

console.log(`\n\x1b[36m🚀 Iniciando despliegue de demo interactiva en Vercel...\x1b[0m`);

try {
  // 1. Ejecutar el deploy de Vercel
  console.log("📦 Conectando con Vercel y desplegando el proyecto...");
  const output = execSync("vercel --prod --yes", { encoding: "utf-8" });
  
  // Extraer la URL de producción de Vercel
  const urlRegex = /https:\/\/[a-zA-Z0-9.-]+\.vercel\.app/i;
  const match = output.match(urlRegex);
  
  if (!match) {
    console.error("\x1b[31mError: No se pudo extraer la URL del despliegue de Vercel.\x1b[0m");
    console.log("Salida de Vercel:", output);
    process.exit(1);
  }
  
  const vercelUrl = match[0];
  console.log(`\x1b[32m✅ Despliegue completado con éxito: ${vercelUrl}\x1b[0m`);
  
  // 2. Reportar al CRM
  console.log(`📡 Registrando link de demo en tu CRM (${CRM_BASE_URL})...`);
  
  const payload = {
    clienteId: clienteId,
    linkDemo: vercelUrl
  };
  
  const url = new URL(`${CRM_BASE_URL}/api/clientes/actualizar-demo`);
  const protocol = url.protocol === 'https:' ? require('https') : require('http');
  const reqData = JSON.stringify(payload);
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(reqData)
    }
  };
  
  const req = protocol.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log(`\x1b[32m🎉 ¡CRM Actualizado con Éxito! El link y el mensaje de WhatsApp han sido creados.\x1b[0m\n`);
      } else {
        console.error(`\x1b[31m❌ Error al actualizar en el CRM (Status: ${res.statusCode})\x1b[0m`);
        console.error("Respuesta del servidor:", body);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error(`\x1b[31m❌ Error al conectar con el servidor del CRM: ${e.message}\x1b[0m`);
  });
  
  req.write(reqData);
  req.end();
  
} catch (error) {
  console.error("\x1b[31m❌ Error durante el flujo de despliegue:\x1b[0m", error.message);
  process.exit(1);
}
