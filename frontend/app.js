// ImportaChain: liga a interface ao contrato na Sepolia (Web3.js + MetaMask).

// ===== Constantes (espelham os enums do contrato, na mesma ordem) =====
// Os enums chegam da Web3.js como BigInt: use Number() antes de indexar.
const CATEGORIAS = ["Veículo", "Bebida", "Relógio", "Outro"];
const STATUS = ["Pago", "Embarcado", "Liberado", "Entregue", "Cancelado"];
const CLASSE_STATUS = ["status-pago", "status-embarcado", "status-liberado", "status-entregue", "status-cancelado"];
const MAX_PEDIDOS_VARRIDOS = 100;   // quantos pedidos recentes o app lê para importador/alfândega
const MAX_EVENTOS = 30;             // tamanho do histórico de eventos

// ===== Estado global =====
let web3, contrato, conta = null, ehDono = false, ehVerificador = false;
let redeOk = false;   // true quando a MetaMask está na Sepolia
let itensCache = {};  // itemId → Item (preenchido em carregarItens; dá o nome do item nos cards de pedido)

// Atalho para buscar elementos pelos IDs combinados com o Davi
const $ = (id) => document.getElementById(id);

// Inicialização

// Verifica a MetaMask, cria web3 e o objeto do contrato, registra os
// listeners, liga os botões e, se a conta já foi autorizada antes
// (eth_accounts), conecta sem abrir a MetaMask.
async function init() {
  ligarBotoes();

  // Link do contrato no Etherscan (cabeçalho)
  const link = $("linkContrato");
  link.href = `${CONTRATO.etherscan}/address/${CONTRATO.endereco}`;
  if (!link.textContent.trim()) link.textContent = abreviar(CONTRATO.endereco);

  if (!window.ethereum) { semMetaMask(); return; }

  web3 = new Web3(window.ethereum);
  contrato = new web3.eth.Contract(CONTRATO.abi, CONTRATO.endereco);

  // Listeners da MetaMask: troca de conta e troca de rede
  window.ethereum.on("accountsChanged", aoTrocarConta);
  window.ethereum.on("chainChanged", aoTrocarRede);

  try {
    const contas = await window.ethereum.request({ method: "eth_accounts" });
    if (contas.length > 0) conta = contas[0];
    await verificarRede();
    await carregarTudo();
  } catch (err) {
    mostrarErro(traduzirErro(err));
  }
}

// Liga cada botão fixo do HTML à sua função
function ligarBotoes() {
  $("btnConectar").addEventListener("click", conectar);
  $("btnTrocarRede").addEventListener("click", (e) => comBotao(e.currentTarget, trocarRede));

  // preventDefault: o botão de cadastro fica dentro do formItem e não pode recarregar a página
  $("btnCadastrar").addEventListener("click", (e) => { e.preventDefault(); comBotao(e.currentTarget, cadastrarItem); });
  $("btnSacar").addEventListener("click", (e) => comBotao(e.currentTarget, sacar));
  $("btnSacarTudo").addEventListener("click", (e) => comBotao(e.currentTarget, sacarTudo));
  $("btnVerificarAut").addEventListener("click", (e) => comBotao(e.currentTarget, verificarAutenticidade));

  // Painel do dono
  $("btnPausar").addEventListener("click", (e) => comBotao(e.currentTarget, pausar));
  $("btnDespausar").addEventListener("click", (e) => comBotao(e.currentTarget, despausar));
  $("btnNomearVerificador").addEventListener("click", (e) => comBotao(e.currentTarget, () => nomearVerificador(true)));
  $("btnRemoverVerificador").addEventListener("click", (e) => comBotao(e.currentTarget, () => nomearVerificador(false)));
  $("btnDisputaReembolsar").addEventListener("click", (e) => comBotao(e.currentTarget, () => resolverDisputa(true)));
  $("btnDisputaPagar").addEventListener("click", (e) => comBotao(e.currentTarget, () => resolverDisputa(false)));

  // Event delegation: um único listener por lista olha o id do botão
  // clicado (ex.: "comprar-3"). Continua funcionando quando os cards são recriados.
  ["listaItens", "listaMeusItens", "listaPedidosImportador", "listaPedidosComprador", "listaPedidosAlfandega"]
    .forEach((id) => $(id).addEventListener("click", cliqueNaLista));
}

// Ações dos botões gerados no JS: "<acao>-<id>"
const ACOES_DAS_LISTAS = {
  comprar: (id) => comprar(id),
  ativar: (id) => alternarItem(id, true),
  desativar: (id) => alternarItem(id, false),
  embarcar: (id) => registrarEmbarque(id),
  liberar: (id) => liberarAlfandega(id),
  cancelar: (id) => cancelarPedido(id),
  confirmar: (id) => confirmarEntrega(id),
};

function cliqueNaLista(e) {
  const botao = e.target.closest("button");
  if (!botao || !botao.id) return;
  const [acao, idTexto] = botao.id.split("-");
  if (ACOES_DAS_LISTAS[acao]) comBotao(botao, () => ACOES_DAS_LISTAS[acao](Number(idTexto)));
}

// Carteira e rede

// Pede à MetaMask acesso às contas (abre o popup), guarda a primeira
// conta e carrega os dados da tela.
async function conectar() {
  if (!window.ethereum) { semMetaMask(); return; }
  esconderErro();
  try {
    const contas = await window.ethereum.request({ method: "eth_requestAccounts" });
    conta = contas[0];
    await verificarRede();
    await carregarTudo();
  } catch (err) {
    mostrarErro(traduzirErro(err));
  }
}

// Só consulta a rede atual (eth_chainId) e compara com a Sepolia
async function redeEhSepolia() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  return chainId.toLowerCase() === CONTRATO.chainIdHex.toLowerCase();
}

// Mostra o aviso de rede errada e desabilita as ações fora da Sepolia
async function verificarRede() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  redeOk = chainId.toLowerCase() === CONTRATO.chainIdHex.toLowerCase();

  $("avisoRede").classList.toggle("oculto", redeOk);
  $("redeStatus").textContent = redeOk ? "Sepolia" : `Rede errada (Chain ID ${parseInt(chainId, 16)})`;

  // Fora da Sepolia, só "Conectar" e "Trocar rede" ficam clicáveis
  document.querySelectorAll("button").forEach((b) => {
    if (b.id !== "btnConectar" && b.id !== "btnTrocarRede") b.disabled = !redeOk;
  });
  return redeOk;
}

// Pede à MetaMask para trocar para a Sepolia (wallet_switchEthereumChain).
// Erro 4902 = a rede não está cadastrada na MetaMask: adiciona e troca.
// Depois da troca, o evento chainChanged recarrega a página.
async function trocarRede() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CONTRATO.chainIdHex }],
    });
  } catch (err) {
    if (err.code !== 4902) throw err;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CONTRATO.chainIdHex,
        chainName: "Sepolia",
        nativeCurrency: { name: "SepoliaETH", symbol: "SepoliaETH", decimals: 18 },
        rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
        blockExplorerUrls: [CONTRATO.etherscan],
      }],
    });
  }
}

// Endereço curto e saldo da carteira (getBalance devolve wei em BigInt)
async function atualizarCabecalho() {
  if (!conta) { mostrarDesconectado(); return; }
  $("endereco").textContent = abreviar(conta);
  $("endereco").title = conta;
  $("btnConectar").textContent = "Carteira conectada";
  if (redeOk) {
    const saldo = await web3.eth.getBalance(conta);
    $("saldoEth").textContent = `${formatarEth(saldo)} ETH`;
  } else {
    $("saldoEth").textContent = "—";
  }
}

// Estado "sem conta conectada": limpa os dados pessoais da tela
function mostrarDesconectado() {
  conta = null;
  ehDono = false;
  ehVerificador = false;
  $("endereco").textContent = "Não conectado";
  $("endereco").title = "";
  $("saldoEth").textContent = "—";
  $("papelUsuario").textContent = "—";
  $("btnConectar").textContent = "Conectar carteira";
  $("painelAdmin").classList.add("oculto");
  $("secaoVerificador").classList.add("oculto");
}

// Sem MetaMask instalada: avisa com link e desabilita todos os botões
function semMetaMask() {
  const alerta = $("alertaErro");
  alerta.innerHTML = 'Instale a MetaMask para usar a ImportaChain: ' +
    '<a href="https://metamask.io" target="_blank" rel="noopener">metamask.io</a>';
  alerta.classList.remove("oculto");
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
}

// Leituras (.call(): grátis, não abrem a MetaMask)

// Recarrega tudo o que aparece na tela. Chamado ao conectar, ao trocar
// de conta e depois de cada transação confirmada.
async function carregarTudo() {
  if (!contrato) return;
  try {
    await atualizarCabecalho();

    // O contrato só existe na Sepolia: em outra rede não há o que ler
    if (!redeOk) {
      ["listaItens", "listaMeusItens", "listaPedidosImportador", "listaPedidosComprador", "listaPedidosAlfandega"]
        .forEach((id) => listaVazia($(id), "Troque para a rede Sepolia para ver os dados"));
      return;
    }

    // 1ª rodada, em paralelo: papel, totais, vitrine, saldo sacável, admin, eventos
    await Promise.all([
      carregarPapel(), carregarTotais(), carregarItens(), carregarSaldo(),
      carregarAdmin(), carregarEventos(),
    ]);

    // 2ª rodada: pedidos (usam o cache de itens para mostrar o nome do item)
    const ultimos = await buscarUltimosPedidos();
    await Promise.all([carregarMeusItens(), carregarPedidosComprador()]);
    carregarPedidosImportador(ultimos);
    carregarAlfandega(ultimos);
  } catch (err) {
    mostrarErro(traduzirErro(err));
  }
}

// Papel da conta: dono() e verificadores(conta). Mostra/esconde o painel
// do dono e a seção do verificador. Esconder é só usabilidade: quem
// garante a segurança é o contrato (apenasDono, apenasVerificador).
async function carregarPapel() {
  if (!conta) {
    ehDono = false;
    ehVerificador = false;
  } else {
    const dono = await contrato.methods.dono().call();
    ehDono = dono.toLowerCase() === conta.toLowerCase();
    ehVerificador = await contrato.methods.verificadores(conta).call();
  }
  $("painelAdmin").classList.toggle("oculto", !ehDono);
  $("secaoVerificador").classList.toggle("oculto", !ehVerificador);
  $("papelUsuario").textContent = !conta ? "—" : ehDono ? "Dono" : ehVerificador ? "Verificador" : "Usuário";
}

// Totais de itens e pedidos cadastrados
async function carregarTotais() {
  const [totalItens, totalPedidos] = await Promise.all([
    contrato.methods.totalItens().call(),
    contrato.methods.totalPedidos().call(),
  ]);
  $("totalItens").textContent = totalItens.toString();
  $("totalPedidos").textContent = totalPedidos.toString();
}

// Vitrine: getItem(i) para i de 0 a totalItens-1; mostra só os ativos.
// Guarda todos os itens em itensCache para os cards de pedido.
async function carregarItens() {
  const total = Number(await contrato.methods.totalItens().call());
  const promessas = [];
  for (let i = 0; i < total; i++) promessas.push(contrato.methods.getItem(i).call());
  const itens = await Promise.all(promessas);

  itensCache = {};
  itens.forEach((it) => (itensCache[Number(it.id)] = it));

  renderizarLista($("listaItens"), itens.filter((it) => it.ativo), cardItemVitrine, "Nenhum item à venda");
}

// Itens cadastrados pela conta conectada (com botões ativar/desativar)
async function carregarMeusItens() {
  if (!conta) { listaVazia($("listaMeusItens"), "Conecte a carteira"); return; }
  const itens = await contrato.methods.listarItensDoImportador(conta).call();
  renderizarLista($("listaMeusItens"), itens, cardMeuItem, "Nenhum item cadastrado");
}

// Pedidos em que a conta é compradora (o contrato devolve até 50; mais recentes primeiro)
async function carregarPedidosComprador() {
  if (!conta) { listaVazia($("listaPedidosComprador"), "Conecte a carteira"); return; }
  const pedidos = await contrato.methods.listarPedidosDoComprador(conta).call();
  renderizarLista($("listaPedidosComprador"), [...pedidos].reverse(), (p) => cardPedido(p, "comprador"), "Nenhum pedido");
}

// Lê os últimos 100 pedidos com getPedido (do mais recente ao mais antigo).
// O resultado é usado pelas listas do importador e da alfândega.
async function buscarUltimosPedidos() {
  const total = Number(await contrato.methods.totalPedidos().call());
  const inicio = Math.max(0, total - MAX_PEDIDOS_VARRIDOS);
  const promessas = [];
  for (let i = total - 1; i >= inicio; i--) promessas.push(contrato.methods.getPedido(i).call());
  return Promise.all(promessas);
}

// Pedidos dos itens que a conta importa
function carregarPedidosImportador(pedidos) {
  if (!conta) { listaVazia($("listaPedidosImportador"), "Conecte a carteira"); return; }
  const meus = pedidos.filter((p) => p.importador.toLowerCase() === conta.toLowerCase());
  renderizarLista($("listaPedidosImportador"), meus, (p) => cardPedido(p, "importador"), "Nenhum pedido dos seus itens");
}

// Alfândega (só verificador): pedidos Embarcados de outros importadores
function carregarAlfandega(pedidos) {
  if (!conta || !ehVerificador) { listaVazia($("listaPedidosAlfandega"), "Nenhum pedido aguardando alfândega"); return; }
  const fila = pedidos.filter((p) =>
    Number(p.status) === 1 && p.importador.toLowerCase() !== conta.toLowerCase());
  renderizarLista($("listaPedidosAlfandega"), fila, (p) => cardPedido(p, "alfandega"), "Nenhum pedido aguardando alfândega");
}

// Saldo sacável da conta dentro do contrato (saldos(conta))
async function carregarSaldo() {
  if (!conta) { $("saldoSacavel").textContent = "—"; return; }
  const saldo = await contrato.methods.saldos(conta).call();
  $("saldoSacavel").textContent = `${formatarEth(saldo)} ETH`;
}

// Painel do dono: estado de pausa da plataforma
async function carregarAdmin() {
  const pausado = await contrato.methods.pausado().call();
  $("estadoPausa").textContent = pausado ? "Pausada" : "Ativa";
}

// Histórico de eventos. O RPC da MetaMask aceita no máximo 10.000 blocos
// por consulta, então a busca é feita em fatias, do bloco mais novo ao deploy.
const JANELA_BLOCOS = 9000n;

async function buscarEventosRecentes() {
  const inicio = BigInt(CONTRATO.blocoDeploy);
  let fim = BigInt(await web3.eth.getBlockNumber());
  let janela = JANELA_BLOCOS;
  const eventos = [];
  while (fim >= inicio && eventos.length < MAX_EVENTOS) {
    const de = fim - janela + 1n > inicio ? fim - janela + 1n : inicio;
    try {
      const fatia = await contrato.getPastEvents("allEvents", { fromBlock: de, toBlock: fim });
      eventos.unshift(...fatia);
      fim = de - 1n;
    } catch (err) {
      if (janela > 500n && /range|limit|exceed|too many/i.test(String(err && (err.message || err)))) {
        janela = janela / 2n;
        continue;
      }
      throw err;
    }
  }
  return eventos;
}

async function carregarEventos() {
  const lista = $("listaEventos");
  const tag = /^(UL|OL)$/.test(lista.tagName) ? "li" : "div";
  let eventos;
  try {
    eventos = await buscarEventosRecentes();
  } catch (err) {
    console.error("Falha ao carregar eventos:", err);
    lista.innerHTML = `<${tag} class="vazio">Não foi possível carregar o histórico agora. Veja os eventos no Etherscan.</${tag}>`;
    return;
  }
  const recentes = eventos.slice(-MAX_EVENTOS).reverse();

  if (recentes.length === 0) {
    lista.innerHTML = `<${tag} class="vazio">Nenhum evento ainda</${tag}>`;
    return;
  }
  lista.innerHTML = recentes.map((ev) => `
    <${tag}>#${ev.blockNumber.toString()} · <strong>${escaparHtml(ev.event)}</strong> ·
      ${escaparHtml(descreverEvento(ev))} ·
      <a href="${escaparHtml(`${CONTRATO.etherscan}/tx/${ev.transactionHash}`)}" target="_blank" rel="noopener">ver tx</a>
    </${tag}>`).join("");
}

// Texto curto com os parâmetros de cada evento do contrato
function descreverEvento(ev) {
  const v = ev.returnValues;
  switch (ev.event) {
    case "ItemCadastrado":
      return `item ${v.itemId}, "${v.nome}", ${CATEGORIAS[Number(v.categoria)]}, ${formatarEth(v.preco)} ETH, importador ${abreviar(v.importador)}`;
    case "ItemAtualizado":
      return `item ${v.itemId}, ${formatarEth(v.preco)} ETH, estoque ${v.estoque}, ${v.ativo ? "ativo" : "inativo"}`;
    case "PedidoCriado":
      return `pedido ${v.pedidoId}, item ${v.itemId}, comprador ${abreviar(v.comprador)}, ${formatarEth(v.valor)} ETH`;
    case "EtapaAvancada":
      return `pedido ${v.pedidoId} → ${STATUS[Number(v.novoStatus)]}, por ${abreviar(v.por)}`;
    case "AutenticidadeRegistrada":
      return `pedido ${v.pedidoId}, hash ${v.hashAutenticidade.slice(0, 10)}…`;
    case "PagamentoLiberado":
      return `pedido ${v.pedidoId}, para ${abreviar(v.para)}, ${formatarEth(v.valor)} ETH`;
    case "Saque":
      return `${abreviar(v.conta)} sacou ${formatarEth(v.valor)} ETH`;
    case "VerificadorAlterado":
      return `${abreviar(v.conta)} ${v.ativo ? "nomeado" : "removido"} como verificador`;
    case "PausaAlterada":
      return v.pausado ? "plataforma pausada" : "plataforma reativada";
    default:
      return "";
  }
}

// Montagem dos cards (HTML gerado pelo JS, com as classes do Davi)

// Card da vitrine. O botão comprar-<id> só aparece se a conta não for o
// importador e o item tiver estoque.
function cardItemVitrine(it) {
  const id = Number(it.id);
  const podeComprar = conta && Number(it.estoque) > 0 &&
    it.importador.toLowerCase() !== conta.toLowerCase();
  return `
    <div class="card card-item">
      <h3>${escaparHtml(it.nome)}</h3>
      <p class="categoria">${CATEGORIAS[Number(it.categoria)]} · Item #${id}</p>
      <p>Preço: <strong>${formatarEth(it.preco)} ETH</strong></p>
      <p>Estoque: ${it.estoque.toString()}</p>
      <p>Importador: <span class="endereco-curto" title="${escaparHtml(it.importador)}">${abreviar(it.importador)}</span></p>
      ${podeComprar ? `<button id="comprar-${id}" class="btn btn-primario">Comprar</button>` : ""}
    </div>`;
}

// Card de "Meus itens": botão ativar-<id> ou desativar-<id>
function cardMeuItem(it) {
  const id = Number(it.id);
  const botao = it.ativo
    ? `<button id="desativar-${id}" class="btn btn-perigo">Desativar</button>`
    : `<button id="ativar-${id}" class="btn">Ativar</button>`;
  return `
    <div class="card card-item">
      <h3>${escaparHtml(it.nome)}</h3>
      <p class="categoria">${CATEGORIAS[Number(it.categoria)]} · Item #${id} · ${it.ativo ? "Ativo" : "Inativo"}</p>
      <p>Preço: <strong>${formatarEth(it.preco)} ETH</strong> · Estoque: ${it.estoque.toString()}</p>
      ${botao}
    </div>`;
}

// Card de pedido. Os botões dependem de quem olha (papel) e do status:
//   importador + Pago      → hash-<id> + embarcar-<id>
//   comprador  + Pago      → cancelar-<id>
//   comprador  + Liberado  → confirmar-<id>
//   alfandega  (Embarcado) → conferir-<id> + liberar-<id>
function cardPedido(p, papel) {
  const id = Number(p.id);
  const st = Number(p.status);
  const item = itensCache[Number(p.itemId)];
  const nomeItem = item ? item.nome : `Item #${p.itemId}`;

  let acoes = "";
  if (papel === "importador" && st === 0) {
    acoes = `<input id="hash-${id}" class="input" placeholder="Chassi / lote / nº de série">
      <button id="embarcar-${id}" class="btn btn-primario">Registrar embarque</button>`;
  } else if (papel === "comprador" && st === 0) {
    acoes = `<button id="cancelar-${id}" class="btn btn-perigo">Cancelar pedido</button>`;
  } else if (papel === "comprador" && st === 2) {
    acoes = `<button id="confirmar-${id}" class="btn btn-primario">Confirmar entrega</button>`;
  } else if (papel === "alfandega") {
    acoes = `<input id="conferir-${id}" class="input" placeholder="Identificador conferido na alfândega">
      <button id="liberar-${id}" class="btn btn-primario">Liberar na alfândega</button>`;
  }

  return `
    <div class="card card-pedido">
      <h3>Pedido #${id} · ${escaparHtml(nomeItem)}</h3>
      <p><span class="badge ${CLASSE_STATUS[st]}">${STATUS[st]}</span></p>
      <p>Valor: <strong>${formatarEth(p.valor)} ETH</strong></p>
      <p>Comprador: <span class="endereco-curto" title="${escaparHtml(p.comprador)}">${abreviar(p.comprador)}</span>
         · Importador: <span class="endereco-curto" title="${escaparHtml(p.importador)}">${abreviar(p.importador)}</span></p>
      <p>Criado em: ${new Date(Number(p.criadoEm) * 1000).toLocaleString("pt-BR")}</p>
      ${acoes}
    </div>`;
}

// Escritas (.send(): abrem a MetaMask)

// Função ÚNICA para todas as escritas.
// 1) confere a rede; 2) confere se a carteira cobre o value;
// 3) simula com .call() para pegar o revert (erro personalizado) sem abrir
//    a MetaMask e sem gastar gas; 4) envia com .send() e acompanha o estado
//    pelos eventos do PromiEvent: transactionHash (pendente) e receipt (confirmada).
// Devolve true se a transação foi confirmada.
async function enviarTx(metodo, opcoes = {}, descricao = "Transação") {
  esconderErro();
  if (!conta) { mostrarErro("Conecte a carteira primeiro."); return false; }
  const params = { from: conta, ...opcoes };

  // 1) Rede certa?
  if (!(await redeEhSepolia())) { mostrarErro("Troque para a rede Sepolia."); return false; }

  // 2) Saldo na carteira cobre o value? (BigInt com BigInt, sem Number)
  if (opcoes.value) {
    const saldo = await web3.eth.getBalance(conta);
    if (saldo < BigInt(opcoes.value)) {
      mostrarErro("Saldo de ETH insuficiente na carteira para pagar o valor + gas.");
      return false;
    }
  }

  // 3) Simula antes (call): se for reverter, mostra o erro e nem abre a MetaMask
  try {
    await metodo.call(params);
  } catch (err) {
    console.log("Simulação reverteu:", err);
    mostrarErro(traduzirErro(err));
    return false;
  }

  // 4) Envia de verdade
  try {
    await metodo.send(params)
      .on("transactionHash", (hash) => mostrarTx("pendente", hash, descricao))
      .on("receipt", (rec) => mostrarTx("confirmada", rec.transactionHash, descricao));
    await carregarTudo();   // atualiza a tela e o histórico de eventos
    return true;
  } catch (err) {
    console.log("Envio falhou:", err);
    mostrarTx("falhou", err?.receipt?.transactionHash, descricao);
    mostrarErro(traduzirErro(err));
    return false;
  }
}

// Cadastra um item. O preço digitado em ETH vira wei com toWei.
async function cadastrarItem() {
  const nome = $("inNome").value.trim();
  const categoria = Number($("inCategoria").value);
  const precoTexto = $("inPreco").value.trim().replace(",", ".");
  const estoqueTexto = $("inEstoque").value.trim();

  validar(nome, "Preencha o nome");
  validar(Number(precoTexto) > 0, "O preço precisa ser maior que zero");
  validar(/^\d+$/.test(estoqueTexto), "Informe o estoque (número inteiro)");

  const precoWei = web3.utils.toWei(precoTexto, "ether");
  const ok = await enviarTx(
    contrato.methods.cadastrarItem(nome, categoria, precoWei, estoqueTexto), {}, "Cadastro de item");
  if (ok) $("formItem").reset();
}

// Compra 1 unidade: o value é exatamente item.preco (BigInt direto, sem converter)
async function comprar(itemId) {
  const item = await contrato.methods.getItem(itemId).call();
  await enviarTx(contrato.methods.comprar(itemId), { value: item.preco }, `Compra do item #${itemId}`);
}

// Importador: registra o embarque com o hash do chassi/lote/série digitado
async function registrarEmbarque(pedidoId) {
  const hash = await hashDoTexto($(`hash-${pedidoId}`).value);
  await enviarTx(contrato.methods.registrarEmbarque(pedidoId, hash), {}, `Embarque do pedido #${pedidoId}`);
}

// Verificador: confere o identificador na alfândega (hash diferente → HashNaoConfere)
async function liberarAlfandega(pedidoId) {
  const hash = await hashDoTexto($(`conferir-${pedidoId}`).value);
  await enviarTx(contrato.methods.liberarAlfandega(pedidoId, hash), {}, `Alfândega do pedido #${pedidoId}`);
}

// Comprador: confirma a entrega (importador recebe 70% − taxa)
async function confirmarEntrega(pedidoId) {
  await enviarTx(contrato.methods.confirmarEntrega(pedidoId), {}, `Entrega do pedido #${pedidoId}`);
}

// Comprador: cancela antes do embarque (reembolso total em saldo sacável)
async function cancelarPedido(pedidoId) {
  await enviarTx(contrato.methods.cancelarPedido(pedidoId), {}, `Cancelamento do pedido #${pedidoId}`);
}

// Saca o valor digitado (em ETH). Se pedir mais do que tem, o contrato
// reverte com SaldoInsuficiente e a mensagem mostra os dois valores.
async function sacar() {
  const valorTexto = $("inSaque").value.trim().replace(",", ".");
  validar(Number(valorTexto) > 0, "Informe um valor maior que zero para sacar");
  const valorWei = web3.utils.toWei(valorTexto, "ether");
  const ok = await enviarTx(contrato.methods.sacar(valorWei), {}, "Saque");
  if (ok) $("inSaque").value = "";
}

// Saca todo o saldo sacável da conta
async function sacarTudo() {
  validar(conta, "Conecte a carteira primeiro.");
  const saldo = await contrato.methods.saldos(conta).call();
  validar(saldo > 0n, "Você não tem saldo sacável no contrato.");
  await enviarTx(contrato.methods.sacar(saldo), {}, "Saque de todo o saldo");
}

// Importador: ativa/desativa um item mantendo preço e estoque atuais
async function alternarItem(itemId, ativo) {
  const item = await contrato.methods.getItem(itemId).call();
  await enviarTx(
    contrato.methods.atualizarItem(itemId, item.preco, item.estoque, ativo), {},
    `${ativo ? "Ativação" : "Desativação"} do item #${itemId}`);
}

// Qualquer pessoa: confere se o identificador bate com o hash gravado no pedido (leitura, sem gas)
async function verificarAutenticidade() {
  $("resultadoAut").textContent = "";
  const pedidoTexto = $("inPedidoAut").value.trim();
  validar(/^\d+$/.test(pedidoTexto), "Informe o número do pedido");
  const hash = await hashDoTexto($("inTextoAut").value);
  const autentico = await contrato.methods.verificarAutenticidade(pedidoTexto, hash).call();
  $("resultadoAut").textContent = autentico ? "Autêntico ✅" : "Não confere ❌";
}

// ----- Funções do dono (o contrato reverte com NaoAutorizado para os demais) -----

async function pausar() {
  await enviarTx(contrato.methods.definirPausa(true), {}, "Pausar plataforma");
}

async function despausar() {
  await enviarTx(contrato.methods.definirPausa(false), {}, "Reativar plataforma");
}

// ativo = true nomeia, false remove o verificador
async function nomearVerificador(ativo) {
  const endereco = $("inVerificador").value.trim();
  validar(web3.utils.isAddress(endereco), "Informe um endereço válido (0x...)");
  await enviarTx(contrato.methods.nomearVerificador(endereco, ativo), {},
    `${ativo ? "Nomear" : "Remover"} verificador`);
}

// reembolsar = true devolve ao comprador (menos o adiantamento); false paga o importador
async function resolverDisputa(reembolsar) {
  const idTexto = $("inDisputaId").value.trim();
  validar(/^\d+$/.test(idTexto), "Informe o número do pedido");
  await enviarTx(contrato.methods.resolverDisputa(idTexto, reembolsar), {},
    `Disputa do pedido #${idTexto}`);
}

// Enquanto a ação roda, o botão fica desabilitado e com a classe
// "carregando"; qualquer erro vira mensagem em português.
async function comBotao(botao, acao) {
  if (botao.disabled) return;
  botao.disabled = true;
  botao.classList.add("carregando");
  try {
    await acao();
  } catch (err) {
    mostrarErro(traduzirErro(err));
  } finally {
    botao.disabled = false;
    botao.classList.remove("carregando");
  }
}

// Tradução de erros

// Textos dos require do contrato → mensagem para o usuário
const MENSAGENS_REQUIRE = {
  "Plataforma pausada": "A plataforma está pausada pelo administrador.",
  "Nome vazio": "Preencha o nome",
  "Preco zero": "O preço precisa ser maior que zero",
  "Hash vazio": "Informe o identificador do item",
  "Item inexistente": "Esse item não existe.",
  "Pedido inexistente": "Esse pedido não existe.",
};

// Converte qualquer erro em uma mensagem em português claro.
// O formato do erro muda entre Web3.js e MetaMask, então procuramos em
// vários lugares (err, innerError, cause, error, data...).
function traduzirErro(err) {
  if (err instanceof ErroValidacao) return err.message;
  const achados = vasculharErro(err);
  const texto = achados.textos.join(" | ");

  // 1) usuário clicou em Rejeitar na MetaMask
  if (achados.codigos.includes(4001) || /denied|rejected/i.test(texto)) {
    return "Você cancelou a transação na MetaMask.";
  }

  // 2) erro personalizado já decodificado pela Web3.js com a ABI (errorName + errorArgs)
  for (const e of achados.decodificados) {
    const m = mensagemDoErro(e.errorName, e.errorArgs);
    if (m) return m;
  }

  // 3) não veio decodificado: compara o seletor (4 primeiros bytes do data) com os erros da ABI
  for (const dados of achados.dados) {
    const m = decodificarPorSeletor(dados);
    if (m) return m;
  }

  // 4) require com texto que apareceu em alguma mensagem
  const doRequire = mensagemDoRequire(texto);
  if (doRequire) return doRequire;

  // 5) falta de ETH para valor + gas
  if (/insufficient funds/i.test(texto)) return "Saldo de ETH insuficiente na carteira para pagar o valor + gas.";

  return "Erro inesperado: " + (achados.textos[0] || String(err)).slice(0, 140);
}

// Percorre o objeto de erro (até 5 níveis) juntando códigos, mensagens,
// erros já decodificados e dados de revert em hexadecimal.
function vasculharErro(err) {
  const achados = { codigos: [], textos: [], decodificados: [], dados: [] };
  const visitados = new Set();
  (function visitar(o, nivel) {
    if (!o || typeof o !== "object" || visitados.has(o) || nivel > 5) return;
    visitados.add(o);
    if (typeof o.code === "number") achados.codigos.push(o.code);
    if (typeof o.message === "string") achados.textos.push(o.message);
    if (typeof o.reason === "string") achados.textos.push(o.reason);
    if (o.errorName) achados.decodificados.push(o);
    if (typeof o.data === "string" && /^0x[0-9a-fA-F]{8}/.test(o.data)) achados.dados.push(o.data);
    for (const chave of ["innerError", "cause", "error", "data", "originalError"]) visitar(o[chave], nivel + 1);
  })(err, 0);
  return achados;
}

// Decodifica o revert pelo seletor: Error(string) = require com texto;
// os demais são comparados com os erros personalizados da ABI.
function decodificarPorSeletor(dados) {
  const seletor = dados.slice(0, 10).toLowerCase();
  const corpo = "0x" + dados.slice(10);
  if (seletor === "0x08c379a0") {
    return mensagemDoRequire(web3.eth.abi.decodeParameter("string", corpo));
  }
  for (const item of CONTRATO.abi) {
    if (item.type !== "error") continue;
    const assinatura = `${item.name}(${item.inputs.map((i) => i.type).join(",")})`;
    if (web3.eth.abi.encodeFunctionSignature(assinatura).toLowerCase() === seletor) {
      return mensagemDoErro(item.name, web3.eth.abi.decodeParameters(item.inputs, corpo));
    }
  }
  return null;
}

// Erros personalizados do contrato → mensagem com os valores
function mensagemDoErro(nome, args) {
  const a = (campo, i) => args?.[campo] ?? args?.[i];
  switch (nome) {
    case "NaoAutorizado":
      return "Sua conta não tem permissão para esta ação.";
    case "ValorIncorreto":
      return `Valor incorreto: o item custa ${formatarEth(a("esperado", 0))} ETH, mas foram enviados ${formatarEth(a("enviado", 1))} ETH.`;
    case "ItemIndisponivel":
      return `O item #${a("itemId", 0)} está sem estoque ou desativado.`;
    case "SaldoInsuficiente":
      return `Saldo insuficiente no contrato: você tem ${formatarEth(a("disponivel", 0))} ETH e pediu ${formatarEth(a("solicitado", 1))} ETH.`;
    case "StatusInvalido":
      return `Ação inválida: o pedido está em '${STATUS[Number(a("atual", 0))]}', mas precisava estar em '${STATUS[Number(a("esperado", 1))]}'.`;
    case "HashNaoConfere":
      return "⚠️ O identificador não confere com o registrado no embarque. Possível falsificação!";
    case "LimiteItensAtingido":
      return `Você atingiu o limite de ${a("limite", 0)} itens cadastrados.`;
    case "Error":   // require com texto, quando a Web3.js decodifica como Error(string)
      return mensagemDoRequire(String(a("message", 0) ?? ""));
    default:
      return null;
  }
}

// Procura o texto de algum require conhecido dentro da mensagem
function mensagemDoRequire(texto) {
  for (const [original, traducao] of Object.entries(MENSAGENS_REQUIRE)) {
    if (texto.includes(original)) return traducao;
  }
  return null;
}

// Utilidades

// O hash precisa ser gerado do MESMO jeito pelo importador, pelo verificador
// e por quem confere a autenticidade: normaliza (trim + maiúsculas) e usa o
// gerarHash do próprio contrato (mesmo keccak256 que o Solidity calcula).
async function hashDoTexto(texto) {
  const normalizado = texto.trim().toUpperCase();
  validar(normalizado, "Informe o identificador do item");
  return await contrato.methods.gerarHash(normalizado).call();
}

// Erro de validação do formulário (a mensagem já está em português)
class ErroValidacao extends Error {}

function validar(condicao, mensagem) {
  if (!condicao) throw new ErroValidacao(mensagem);
}

function mostrarErro(msg) {
  const alerta = $("alertaErro");
  alerta.textContent = msg;
  alerta.classList.remove("oculto");
}

function esconderErro() {
  $("alertaErro").classList.add("oculto");
}

// Painel da transação: estado (pendente/confirmada/falhou) + hash com link para o Etherscan
function mostrarTx(estado, hash, descricao) {
  $("txPainel").classList.remove("oculto");

  const status = $("txStatus");
  status.textContent = `${descricao}: ${estado}`;
  status.classList.remove("tx-pendente", "tx-confirmada", "tx-falhou");
  status.classList.add(`tx-${estado}`);

  const campoHash = $("txHash");
  if (!hash) {
    campoHash.textContent = "—";
    if (campoHash.tagName === "A") campoHash.removeAttribute("href");
    return;
  }
  const url = `${CONTRATO.etherscan}/tx/${hash}`;
  const texto = `${hash.slice(0, 10)}…${hash.slice(-8)} (ver no Etherscan)`;
  if (campoHash.tagName === "A") {
    campoHash.href = url;
    campoHash.target = "_blank";
    campoHash.rel = "noopener";
    campoHash.textContent = texto;
  } else {
    campoHash.innerHTML = `<a href="${escaparHtml(url)}" target="_blank" rel="noopener">${escaparHtml(texto)}</a>`;
  }
}

// 0x12ab34cd... → 0x12ab…9f3c
function abreviar(endereco) {
  if (!endereco) return "—";
  return `${endereco.slice(0, 6)}…${endereco.slice(-4)}`;
}

// wei (BigInt) → texto em ETH, sem perder precisão
function formatarEth(wei) {
  return web3.utils.fromWei(wei, "ether");
}

// Evita XSS: dados vindos do contrato (ex.: nome do item) nunca entram crus no innerHTML
function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Desenha uma lista de cards; se estiver vazia, mostra a mensagem com a classe .vazio
function renderizarLista(lista, dados, montarCard, textoVazio) {
  if (dados.length === 0) { listaVazia(lista, textoVazio); return; }
  lista.innerHTML = dados.map(montarCard).join("");
}

function listaVazia(lista, texto) {
  lista.innerHTML = `<p class="vazio">${escaparHtml(texto)}</p>`;
}

// Listeners da MetaMask

// Troca de conta: lista vazia = desconectou; senão usa a nova conta
async function aoTrocarConta(contas) {
  esconderErro();
  if (contas.length === 0) mostrarDesconectado();
  else conta = contas[0];
  await carregarTudo();
}

// Troca de rede: recarregar a página é o jeito mais seguro de recomeçar
function aoTrocarRede() {
  window.location.reload();
}

// Inicia quando o HTML estiver pronto
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
