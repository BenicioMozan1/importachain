const ganache = require('ganache'); const { Web3 } = require('web3'); const fs = require('fs');
const ZERO = '0x0000000000000000000000000000000000000000';
const FINNEY = 10n ** 15n; // 0,001 ETH
let pass = 0, fail = 0; const falhas = []; const gas = {};
const S = ['Pago','Embarcado','Liberado','Entregue','Cancelado'];
(async () => {
  const provider = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai', vmErrorsOnRPCResponse: true }, wallet: { totalAccounts: 10, defaultBalance: 1000 } });
  const web3 = new Web3(provider);
  const acc = await web3.eth.getAccounts();
  const [DONO, IMP, COMP, VER2, OUTRO] = acc;
  const { abi, bytecode } = JSON.parse(fs.readFileSync('out-shanghai.json'));
  const dep = await new web3.eth.Contract(abi).deploy({ data: bytecode }).send({ from: DONO, gas: 6000000 });
  const c = dep;
  const addr = c.options.address;
  const hashDe = (t) => web3.utils.keccak256(t);
  const H_OK = await c.methods.gerarHash('CHASSI-9BW123').call();
  const H_FALSO = await c.methods.gerarHash('CHASSI-FALSO').call();
  const rastreadas = [...acc];

  const ok = (nome, cond, extra='') => { if (cond) { pass++; console.log('  ✅', nome); } else { fail++; falhas.push(nome + ' ' + extra); console.log('  ❌', nome, extra); } };
  const sv = (x) => JSON.stringify(x, (k,v)=>typeof v==='bigint'?v.toString():v);

  // executa tx e guarda gás
  const tx = async (tag, method, from, value = 0) => {
    const r = await method.send({ from, value, gas: 5000000 });
    if (tag) gas[tag] = Number(r.gasUsed);
    return r;
  };
  // espera revert com erro personalizado (nome + args opcionais) ou require (string)
  const reverte = async (nome, method, from, esperado, argsEsperados, value = 0) => {
    try { await method.call({ from, value }); ok(nome, false, '(não reverteu)'); return; }
    catch (e) {
      const i = e.innerError || {};
      const nomeErro = i.errorName; const args = i.errorArgs || {};
      let bom = false;
      if (nomeErro === 'Error') bom = args.message === esperado;
      else bom = nomeErro === esperado;
      if (bom && argsEsperados) {
        argsEsperados.forEach((v, idx) => { if (String(args[idx]).toLowerCase() !== String(v).toLowerCase()) bom = false; });
      }
      ok(nome, bom, `(obtido: ${nomeErro} ${sv(args)})`);
    }
  };
  // invariante: saldo do contrato == soma(saldos) + valor(Pago) + (valor - adiant)(Embarcado/Liberado)
  const invariante = async (tag) => {
    const bal = BigInt(await web3.eth.getBalance(addr));
    let soma = 0n;
    for (const a of rastreadas) soma += BigInt(await c.methods.saldos(a).call());
    const n = Number(await c.methods.totalPedidos().call());
    for (let i = 0; i < n; i++) {
      const p = await c.methods.getPedido(i).call(); const st = Number(p.status);
      if (st === 0) soma += BigInt(p.valor);
      if (st === 1 || st === 2) soma += BigInt(p.valor) - BigInt(p.adiantamentoPago);
    }
    ok(`invariante de saldo (${tag})`, bal === soma, `saldoContrato=${bal} esperado=${soma}`);
  };
  const eventos = async (nome, filtro) => (await c.getPastEvents(nome, { fromBlock: 0, toBlock: 'latest' })).filter(filtro || (()=>true));

  console.log('\n=== Constantes e estado inicial ===');
  ok('dono = deployer', (await c.methods.dono().call()) === DONO);
  ok('TAXA_BPS = 200', (await c.methods.TAXA_BPS().call()) == 200n);
  ok('ADIANTAMENTO_BPS = 3000', (await c.methods.ADIANTAMENTO_BPS().call()) == 3000n);
  ok('MAX_ITENS_POR_IMPORTADOR = 20', (await c.methods.MAX_ITENS_POR_IMPORTADOR().call()) == 20n);
  ok('MAX_LISTAGEM = 50', (await c.methods.MAX_LISTAGEM().call()) == 50n);
  ok('nomePlataforma = ImportaChain', (await c.methods.nomePlataforma().call()) === 'ImportaChain');
  ok('dono nasce verificador', (await c.methods.verificadores(DONO).call()) === true);
  ok('gerarHash == keccak256 off-chain', H_OK === hashDe('CHASSI-9BW123'));
  ok('calcularTaxa(1 finney) = 0,02 finney', (await c.methods.calcularTaxa(FINNEY).call()) == 20000000000000n);
  ok('calcularAdiantamento(1 finney) = 0,3 finney', (await c.methods.calcularAdiantamento(FINNEY).call()) == 300000000000000n);

  console.log('\n=== Os 24 testes do roteiro (Benicio) ===');
  // 1
  let r = await tx('cadastrarItem', c.methods.cadastrarItem('Porsche 911 1990', 0, FINNEY, 3), IMP);
  ok('T1 cadastrarItem -> ItemCadastrado, id 0', (await eventos('ItemCadastrado')).length === 1 && (await eventos('ItemCadastrado'))[0].returnValues.itemId == 0n);
  // 2
  await tx(null, c.methods.cadastrarItem('Whisky 18 anos', 1, FINNEY, 5), IMP);
  ok('T2 itemId 1', (await c.methods.totalItens().call()) == 2n);
  // 3
  await reverte('T3 importador não compra o próprio item', c.methods.comprar(0), IMP, 'NaoAutorizado', [IMP], FINNEY);
  // 4
  await reverte('T4 comprar com 0,5 finney -> ValorIncorreto(1e15, 5e14)', c.methods.comprar(0), COMP, 'ValorIncorreto', [FINNEY, FINNEY / 2n], FINNEY / 2n);
  // 5
  await tx('comprar', c.methods.comprar(0), COMP, FINNEY);
  let p0 = await c.methods.getPedido(0).call();
  ok('T5 pedido 0 em Pago, estoque do item 0 = 2', Number(p0.status) === 0 && (await c.methods.getItem(0).call()).estoque == 2n);
  await invariante('após T5');
  // 6
  await reverte('T6 comprador não registra embarque', c.methods.registrarEmbarque(0, H_OK), COMP, 'NaoAutorizado', [COMP]);
  // 7
  await reverte('T7 importador (não verificador) não libera', c.methods.liberarAlfandega(0, H_OK), IMP, 'NaoAutorizado', [IMP]);
  // 8
  await tx('registrarEmbarque', c.methods.registrarEmbarque(0, H_OK), IMP);
  p0 = await c.methods.getPedido(0).call();
  ok('T8 status Embarcado, saldo importador = 30%', Number(p0.status) === 1 && (await c.methods.saldos(IMP).call()) == 300000000000000n);
  ok('T8 evento AutenticidadeRegistrada com o hash', (await eventos('AutenticidadeRegistrada'))[0].returnValues.hashAutenticidade === H_OK);
  await invariante('após T8');
  // 9
  await reverte('T9 cancelar após embarque -> StatusInvalido(1,0)', c.methods.cancelarPedido(0), COMP, 'StatusInvalido', [1, 0]);
  // 10
  await reverte('T10 hash falso -> HashNaoConfere', c.methods.liberarAlfandega(0, H_FALSO), DONO, 'HashNaoConfere', [H_OK, H_FALSO]);
  // 11
  await tx('liberarAlfandega', c.methods.liberarAlfandega(0, H_OK), DONO);
  p0 = await c.methods.getPedido(0).call();
  ok('T11 status Liberado e conferiu(0,Dono)=true', Number(p0.status) === 2 && (await c.methods.conferiu(0, DONO).call()) === true);
  await invariante('após T11');
  // 12
  await tx('confirmarEntrega', c.methods.confirmarEntrega(0), COMP);
  p0 = await c.methods.getPedido(0).call();
  ok('T12 status Entregue', Number(p0.status) === 3);
  ok('T12 saldo importador = 980000000000000', (await c.methods.saldos(IMP).call()) == 980000000000000n);
  ok('T12 saldo dono = 20000000000000', (await c.methods.saldos(DONO).call()) == 20000000000000n);
  ok('T12 reputação importador = 1', (await c.methods.reputacao(IMP).call()) == 1n);
  await invariante('após T12');
  // 13/14
  ok('T13 verificarAutenticidade(0, hashOK) = true', (await c.methods.verificarAutenticidade(0, H_OK).call()) === true);
  ok('T14 verificarAutenticidade(0, hashFALSO) = false', (await c.methods.verificarAutenticidade(0, H_FALSO).call()) === false);
  // 15
  await reverte('T15 sacar 1 ETH -> SaldoInsuficiente(9,8e14, 1e18)', c.methods.sacar(10n ** 18n), IMP, 'SaldoInsuficiente', [980000000000000n, 10n ** 18n]);
  // 16
  const antes = BigInt(await web3.eth.getBalance(IMP));
  await tx('sacar', c.methods.sacar(980000000000000n), IMP);
  ok('T16 evento Saque e saldo vai a 0', (await eventos('Saque')).length === 1 && (await c.methods.saldos(IMP).call()) == 0n);
  ok('T16 carteira do importador subiu ~0,00098 ETH (menos o gás)', BigInt(await web3.eth.getBalance(IMP)) > antes + 800000000000000n);
  await invariante('após T16');
  // 17
  await tx(null, c.methods.comprar(1), COMP, FINNEY);
  await tx(null, c.methods.cancelarPedido(1), COMP);
  ok('T17 cancelado, estoque do item 1 volta a 5, saldo comprador = 1 finney',
    Number((await c.methods.getPedido(1).call()).status) === 4 && (await c.methods.getItem(1).call()).estoque == 5n && (await c.methods.saldos(COMP).call()) == FINNEY);
  await invariante('após T17');
  // 18
  await tx(null, c.methods.comprar(0), COMP, FINNEY); // pedido 2
  await tx(null, c.methods.registrarEmbarque(2, H_OK), IMP);
  await tx(null, c.methods.resolverDisputa(2, true), DONO);
  ok('T18 disputa a favor do comprador: Cancelado, saldo comprador = 1,7 finney, reputação = 0',
    Number((await c.methods.getPedido(2).call()).status) === 4 && (await c.methods.saldos(COMP).call()) == 1700000000000000n && (await c.methods.reputacao(IMP).call()) == 0n);
  await invariante('após T18');
  // 19/20
  await reverte('T19 importador não nomeia verificador', c.methods.nomearVerificador(VER2, true), IMP, 'NaoAutorizado', [IMP]);
  await tx(null, c.methods.nomearVerificador(VER2, true), DONO);
  ok('T20 evento VerificadorAlterado e verificadores(VER2)=true', (await eventos('VerificadorAlterado')).length === 1 && (await c.methods.verificadores(VER2).call()) === true);
  // 21/22
  await tx(null, c.methods.definirPausa(true), DONO);
  await reverte('T21 comprar pausado -> "Plataforma pausada"', c.methods.comprar(1), COMP, 'Plataforma pausada', null, FINNEY);
  await reverte('T21b cadastrar pausado -> "Plataforma pausada"', c.methods.cadastrarItem('X', 0, 1, 1), IMP, 'Plataforma pausada');
  await tx(null, c.methods.definirPausa(false), DONO);
  ok('T22 despausar', (await c.methods.pausado().call()) === false);
  // 23
  const lista = await c.methods.listarPedidosDoComprador(COMP).call();
  ok('T23 listarPedidosDoComprador = 3 pedidos', lista.length === 3);
  // 24
  await reverte('T24 getPedido(99) -> "Pedido inexistente"', c.methods.getPedido(99), OUTRO, 'Pedido inexistente');

  console.log('\n=== Casos extras ===');
  await reverte('X1 getItem(99) -> "Item inexistente"', c.methods.getItem(99), OUTRO, 'Item inexistente');
  await reverte('X2 confirmarEntrega de pedido Pago -> StatusInvalido(0,2)', (await tx(null, c.methods.comprar(1), COMP, FINNEY), c.methods.confirmarEntrega(3)), COMP, 'StatusInvalido', [0, 2]);
  await reverte('X3 liberarAlfandega com pedido Pago -> StatusInvalido(0,1)', c.methods.liberarAlfandega(3, H_OK), DONO, 'StatusInvalido', [0, 1]);
  await reverte('X4 confirmarEntrega duplicado (pedido 0 já Entregue)', c.methods.confirmarEntrega(0), COMP, 'StatusInvalido', [3, 2]);
  await reverte('X5 embarque com hash zero -> "Hash vazio"', c.methods.registrarEmbarque(3, '0x' + '00'.repeat(32)), IMP, 'Hash vazio');
  await reverte('X6 outro (não comprador) cancela pedido 3', c.methods.cancelarPedido(3), OUTRO, 'NaoAutorizado', [OUTRO]);
  await reverte('X8 resolverDisputa por não-dono', c.methods.resolverDisputa(3, true), COMP, 'NaoAutorizado', [COMP]);
  await reverte('X9 resolverDisputa em pedido Pago -> StatusInvalido(0,1)', c.methods.resolverDisputa(3, true), DONO, 'StatusInvalido', [0, 1]);
  await reverte('X10 sacar 0 -> SaldoInsuficiente(saldo,0)', c.methods.sacar(0), OUTRO, 'SaldoInsuficiente', [0, 0]);
  await reverte('X11 nomearVerificador(0x0) -> "Endereco zero"', c.methods.nomearVerificador(ZERO, true), DONO, 'Endereco zero');
  await reverte('X12 cadastrarItem nome vazio -> "Nome vazio"', c.methods.cadastrarItem('', 0, 1, 1), IMP, 'Nome vazio');
  await reverte('X13 cadastrarItem preço zero -> "Preco zero"', c.methods.cadastrarItem('Y', 0, 0, 1), IMP, 'Preco zero');
  await reverte('X14 atualizarItem por não-importador', c.methods.atualizarItem(0, 1, 1, true), COMP, 'NaoAutorizado', [COMP]);
  await reverte('X15 atualizarItem preço zero -> "Preco zero"', c.methods.atualizarItem(0, 0, 1, true), IMP, 'Preco zero');
  // item desativado e sem estoque
  await tx(null, c.methods.atualizarItem(1, FINNEY, 5, false), IMP);
  await reverte('X16 item desativado -> ItemIndisponivel(1)', c.methods.comprar(1), COMP, 'ItemIndisponivel', [1], FINNEY);
  await tx(null, c.methods.atualizarItem(1, FINNEY, 0, true), IMP);
  await reverte('X17 item sem estoque -> ItemIndisponivel(1)', c.methods.comprar(1), COMP, 'ItemIndisponivel', [1], FINNEY);
  await tx(null, c.methods.atualizarItem(1, FINNEY, 5, true), IMP);
  ok('X18 evento ItemAtualizado emitido', (await eventos('ItemAtualizado')).length === 3);

  // verificador não libera o próprio item: DONO vira importador de um item
  await tx(null, c.methods.cadastrarItem('Relógio do dono', 2, 2n * FINNEY, 2), DONO); // id 2
  await tx(null, c.methods.comprar(2), COMP, 2n * FINNEY); // pedido 4
  await tx(null, c.methods.registrarEmbarque(4, H_OK), DONO);
  await reverte('X19 verificador não libera o PRÓPRIO item', c.methods.liberarAlfandega(4, H_OK), DONO, 'NaoAutorizado', [DONO]);
  await tx(null, c.methods.liberarAlfandega(4, H_OK), VER2); // outro verificador libera
  ok('X20 outro verificador libera o item do dono', Number((await c.methods.getPedido(4).call()).status) === 2);
  await reverte('X7 só o comprador confirma a entrega (pedido 4 Liberado)', c.methods.confirmarEntrega(4), OUTRO, 'NaoAutorizado', [OUTRO]);
  await invariante('após X20');

  // disputa a favor do importador (else)
  const saldoImpAntes = BigInt(await c.methods.saldos(IMP).call());
  await tx(null, c.methods.comprar(0), COMP, FINNEY); // pedido 5
  await tx(null, c.methods.registrarEmbarque(5, H_OK), IMP);
  await tx(null, c.methods.resolverDisputa(5, false), DONO); // paga importador, status Embarcado
  const saldoImpDepois = BigInt(await c.methods.saldos(IMP).call());
  ok('X21 disputa a favor do importador: Entregue e importador recebe 98%', Number((await c.methods.getPedido(5).call()).status) === 3 && saldoImpDepois - saldoImpAntes === 980000000000000n);
  ok('X22 evento PagamentoLiberado emitido', (await eventos('PagamentoLiberado')).length >= 2);
  await invariante('após X22');

  // arredondamento: valores pequenos (1 wei, 3 wei, 7 wei, 12345678901234567 wei)
  for (const v of [1n, 3n, 7n, 99n, 12345678901234567n]) {
    await tx(null, c.methods.cadastrarItem('Mini ' + v, 3, v, 1), IMP);
    const id = Number(await c.methods.totalItens().call()) - 1;
    await tx(null, c.methods.comprar(id), OUTRO, v);
    const pid = Number(await c.methods.totalPedidos().call()) - 1;
    await tx(null, c.methods.registrarEmbarque(pid, H_OK), IMP);
    await tx(null, c.methods.liberarAlfandega(pid, H_OK), DONO);
    await tx(null, c.methods.confirmarEntrega(pid), OUTRO);
    await invariante(`arredondamento valor=${v} wei`);
  }

  // limite de 20 itens por importador
  const nImp = (await c.methods.listarItensDoImportador(IMP).call()).length;
  for (let i = nImp; i < 20; i++) await tx(null, c.methods.cadastrarItem('Lote ' + i, 1, 1, 1), IMP);
  ok('X23 importador chegou a 20 itens', (await c.methods.listarItensDoImportador(IMP).call()).length === 20);
  await reverte('X24 21º item -> LimiteItensAtingido(20)', c.methods.cadastrarItem('Excedente', 1, 1, 1), IMP, 'LimiteItensAtingido', [20]);

  // listarPedidosDoComprador: janela dos 50 mais recentes
  await tx(null, c.methods.cadastrarItem('Massa', 1, 1, 100), VER2);
  const idMassa = Number(await c.methods.totalItens().call()) - 1;
  for (let i = 0; i < 55; i++) await tx(null, c.methods.comprar(idMassa), acc[5], 1n);
  const lst = await c.methods.listarPedidosDoComprador(acc[5]).call();
  const ultimoId = Number(await c.methods.totalPedidos().call()) - 1;
  ok('X25 listarPedidosDoComprador limita a 50', lst.length === 50);
  ok('X26 a janela são os 50 MAIS RECENTES (último = último pedido criado)', Number(lst[49].id) === ultimoId && Number(lst[0].id) === ultimoId - 49);
  await invariante('após 55 pedidos em massa');

  // reentrância em sacar
  console.log('\n=== Ataque de reentrância em sacar() ===');
  const att = JSON.parse(fs.readFileSync('attacker.json'));
  const A = await new web3.eth.Contract(att.abi).deploy({ data: att.bytecode, arguments: [addr] }).send({ from: acc[6], gas: 3000000 });
  const AA = A.options.address; rastreadas.push(AA);
  await tx(null, c.methods.cadastrarItem('Isca', 1, FINNEY, 5), acc[7]);
  const idIsca = Number(await c.methods.totalItens().call()) - 1;
  await A.methods.comprarItem(idIsca).send({ from: acc[6], value: FINNEY, gas: 3000000 });
  const pidIsca = Number(await c.methods.totalPedidos().call()) - 1;
  await A.methods.cancelar(pidIsca).send({ from: acc[6], gas: 3000000 });
  ok('R1 atacante tem saldo sacável de 1 finney', (await c.methods.saldos(AA).call()) == FINNEY);
  const balContratoAntes = BigInt(await web3.eth.getBalance(addr));
  await A.methods.atacar(FINNEY).send({ from: acc[6], gas: 3000000 });
  const balAtacante = BigInt(await web3.eth.getBalance(AA));
  const balContratoDepois = BigInt(await web3.eth.getBalance(addr));
  ok('R2 atacante recebeu EXATAMENTE 1 finney (não conseguiu sacar em dobro)', balAtacante === FINNEY, `recebeu ${balAtacante}`);
  ok('R3 contrato perdeu só 1 finney', balContratoAntes - balContratoDepois === FINNEY);
  ok('R4 reentradas tentadas e todas revertidas (CEI funcionou)', (await A.methods.vezes().call()) == 1n && (await A.methods.falhasReentrada().call()) == 1n);
  ok('R5 saldo do atacante zerado', (await c.methods.saldos(AA).call()) == 0n);
  await invariante('após ataque de reentrância');

  // nenhuma função aceita ETH fora de comprar: envio direto deve falhar
  let rejeitou = false;
  try { await web3.eth.sendTransaction({ from: OUTRO, to: addr, value: 1, gas: 100000 }); } catch (e) { rejeitou = true; }
  ok('R6 enviar ETH direto ao contrato é rejeitado (sem receive/fallback)', rejeitou);

  console.log('\n=== Gás observado (EVM local, otimização desligada) ===');
  gas['deploy'] = Number(await new web3.eth.Contract(abi).deploy({ data: bytecode }).estimateGas({ from: DONO }));
  Object.entries(gas).forEach(([k, v]) => console.log('  ', k.padEnd(20), v));
  fs.writeFileSync('gas.json', JSON.stringify(gas, null, 2));
  console.log(`\nRESULTADO: ${pass} ok, ${fail} falhas`);
  if (fail) { console.log(falhas.join('\n')); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
