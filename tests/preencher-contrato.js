// Uso: node preencher-contrato.js 0xENDERECO_DO_CONTRATO NUMERO_DO_BLOCO [caminho/contrato.js]
// Preenche o endereço e o bloco do deploy em frontend/contrato.js sem mexer na ABI.
const fs = require('fs');
const [endereco, bloco, caminho = '../frontend/contrato.js'] = process.argv.slice(2);
if (!/^0x[0-9a-fA-F]{40}$/.test(endereco || '') || !/^[0-9]+$/.test(bloco || '')) {
  console.error('Uso: node preencher-contrato.js 0xENDERECO_DE_40_HEX NUMERO_DO_BLOCO [contrato.js]'); process.exit(1);
}
let s = fs.readFileSync(caminho, 'utf8');
s = s.replace(/endereco:\s*"[^"]*"/, `endereco: "${endereco}"`).replace(/blocoDeploy:\s*\d+/, `blocoDeploy: ${bloco}`);
fs.writeFileSync(caminho, s);
console.log('OK:', caminho, '->', endereco, 'bloco', bloco);
