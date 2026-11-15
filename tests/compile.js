const solc = require('solc'), fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const evm = process.argv[3] || 'cancun';
const input = { language: 'Solidity', sources: { 'ImportaChain.sol': { content: src } },
  settings: { optimizer: { enabled: false, runs: 200 }, evmVersion: evm,
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'metadata'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input)));
(out.errors || []).forEach(e => console.log(e.severity.toUpperCase() + ': ' + e.formattedMessage));
const c = out.contracts && out.contracts['ImportaChain.sol'] && out.contracts['ImportaChain.sol'].ImportaChain;
if (!c) { console.log('FALHOU'); process.exit(1); }
fs.writeFileSync(`out-${evm}.json`, JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }));
console.log('OK evm=' + evm + ' bytecode bytes=' + (c.evm.bytecode.object.length / 2) + ' erros/warnings=' + (out.errors || []).length);
