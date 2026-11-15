const solc = require('solc'), fs = require('fs');
const input = { language: 'Solidity', sources: { 'Attacker.sol': { content: fs.readFileSync('Attacker.sol','utf8') } },
  settings: { evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi','evm.bytecode.object'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input)));
(out.errors||[]).forEach(e=>console.log(e.formattedMessage));
const c = out.contracts['Attacker.sol'].Attacker;
fs.writeFileSync('attacker.json', JSON.stringify({abi:c.abi, bytecode:'0x'+c.evm.bytecode.object}));
console.log('attacker ok');
