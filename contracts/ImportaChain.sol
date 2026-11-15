// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ImportaChain
/// @notice dApp de importação de itens de alto valor (carros, bebidas, relógios) com custódia
///         do pagamento em etapas e registro de autenticidade por hash.
/// @dev Trabalho acadêmico para a rede de teste Sepolia. O comprador paga 100% ao contrato;
///      o importador recebe 30% no embarque e o restante (menos 2% de taxa) na entrega.
///      Todo ETH só sai do contrato pela função sacar (pull payment).
contract ImportaChain {
    // =====================================================================
    // TIPOS DE DADOS, CONSTANTES E ESTADO
    // =====================================================================

    // [Recurso: TiposDeDados] address + immutable: o dono é definido no deploy e nunca muda
    /// @notice Endereço do dono da plataforma (quem implantou o contrato)
    address public immutable dono;

    // [Recurso: TiposDeDados] uint256 + constant: taxa de 2% em pontos-base (200 / 10000)
    /// @notice Taxa da plataforma em pontos-base (200 = 2%)
    uint256 public constant TAXA_BPS = 200;

    // [Recurso: TiposDeDados] uint256 + constant: adiantamento de 30% liberado no embarque
    /// @notice Percentual do adiantamento ao importador no embarque, em pontos-base (3000 = 30%)
    uint256 public constant ADIANTAMENTO_BPS = 3000;

    // [Recurso: TiposDeDados] [Recurso: EstruturasDeControle] limite usado no cadastro de itens
    /// @notice Máximo de itens que um mesmo importador pode cadastrar
    uint256 public constant MAX_ITENS_POR_IMPORTADOR = 20;

    // [Recurso: TiposDeDados] [Recurso: EstruturasDeControle] limite do laço de listagem de pedidos
    /// @notice Máximo de pedidos devolvidos por listarPedidosDoComprador (os mais recentes)
    uint256 public constant MAX_LISTAGEM = 50;

    // [Recurso: TiposDeDados] string
    /// @notice Nome da plataforma
    string public nomePlataforma;

    // [Recurso: TiposDeDados] bool
    /// @notice Se verdadeiro, cadastro de itens e compras ficam bloqueados
    bool public pausado;

    // =====================================================================
    // ENUMS E STRUCTS
    // =====================================================================

    // [Recurso: StructsEEnums] enum de categoria do item
    enum Categoria { Veiculo, Bebida, Relogio, Outro }

    // [Recurso: StructsEEnums] enum que representa os estados do pedido
    enum Status { Pago, Embarcado, Liberado, Entregue, Cancelado }

    // [Recurso: StructsEEnums] struct com 7 campos; usa address payable, string, enum, bool
    struct Item {
        uint256 id;
        address payable importador;
        string nome;
        Categoria categoria;
        uint256 preco; // wei por unidade
        uint256 estoque;
        bool ativo;
    }

    // [Recurso: StructsEEnums] struct com 9 campos; usa bytes32 e enum
    struct Pedido {
        uint256 id;
        uint256 itemId;
        address comprador;
        address payable importador;
        uint256 valor; // wei pago pelo comprador (1 unidade)
        uint256 adiantamentoPago; // wei já creditado ao importador no embarque
        bytes32 hashAutenticidade; // keccak256 do chassi/lote/número de série
        Status status;
        uint256 criadoEm; // block.timestamp da compra
    }

    // =====================================================================
    // ARRAYS E MAPPINGS
    // =====================================================================

    // [Recurso: ArraysEMappings] array dinâmico: o índice é o id do item
    Item[] private itens;

    // [Recurso: ArraysEMappings] array dinâmico: o índice é o id do pedido
    Pedido[] private pedidos;

    // [Recurso: ArraysEMappings] mapping simples: ETH que cada conta pode sacar
    /// @notice Saldo (em wei) que cada conta pode sacar do contrato
    mapping(address => uint256) public saldos;

    // [Recurso: TiposDeDados] [Recurso: ArraysEMappings] int256: a reputação pode ficar negativa
    /// @notice Reputação do importador (+1 por entrega concluída, -1 por disputa perdida)
    mapping(address => int256) public reputacao;

    // [Recurso: ArraysEMappings] mapping simples: quem é verificador (perito/despachante)
    /// @notice Indica se a conta pode liberar pedidos na alfândega
    mapping(address => bool) public verificadores;

    // [Recurso: ArraysEMappings] mapping para array: ids de itens por importador
    mapping(address => uint256[]) private itensDoImportador;

    // [Recurso: ArraysEMappings] mapping para array: ids de pedidos por comprador
    mapping(address => uint256[]) private pedidosDoComprador;

    // [Recurso: ArraysEMappings] mapping aninhado: pedidoId => verificador => conferiu?
    /// @notice Registra qual verificador conferiu cada pedido na alfândega
    mapping(uint256 => mapping(address => bool)) public conferiu;

    // =====================================================================
    // EVENTOS (todos com parâmetros indexed, exceto PausaAlterada)
    // =====================================================================

    // [Recurso: EventosEErros] evento com 2 parâmetros indexed
    /// @notice Emitido quando um importador cadastra um item
    /// @param itemId Id do item
    /// @param importador Quem cadastrou
    /// @param nome Nome do item
    /// @param categoria Categoria do item
    /// @param preco Preço em wei
    event ItemCadastrado(uint256 indexed itemId, address indexed importador, string nome, Categoria categoria, uint256 preco);

    // [Recurso: EventosEErros] evento com 1 parâmetro indexed
    /// @notice Emitido quando o importador atualiza preço, estoque ou ativação do item
    /// @param itemId Id do item
    /// @param preco Novo preço em wei
    /// @param estoque Novo estoque
    /// @param ativo Se o item está à venda
    event ItemAtualizado(uint256 indexed itemId, uint256 preco, uint256 estoque, bool ativo);

    // [Recurso: EventosEErros] evento com 3 parâmetros indexed
    /// @notice Emitido quando um comprador cria um pedido
    /// @param pedidoId Id do pedido
    /// @param itemId Id do item comprado
    /// @param comprador Quem comprou
    /// @param valor Valor pago em wei
    event PedidoCriado(uint256 indexed pedidoId, uint256 indexed itemId, address indexed comprador, uint256 valor);

    // [Recurso: EventosEErros] evento com 2 parâmetros indexed
    /// @notice Emitido a cada mudança de status de um pedido
    /// @param pedidoId Id do pedido
    /// @param novoStatus Novo status
    /// @param por Quem executou a mudança
    event EtapaAvancada(uint256 indexed pedidoId, Status novoStatus, address indexed por);

    // [Recurso: EventosEErros] evento com 2 parâmetros indexed (inclui bytes32)
    /// @notice Emitido quando o importador registra o hash de autenticidade no embarque
    /// @param pedidoId Id do pedido
    /// @param hashAutenticidade Hash keccak256 do identificador do item
    event AutenticidadeRegistrada(uint256 indexed pedidoId, bytes32 indexed hashAutenticidade);

    // [Recurso: EventosEErros] evento com 2 parâmetros indexed
    /// @notice Emitido quando um pagamento é creditado ao importador na entrega
    /// @param pedidoId Id do pedido
    /// @param para Quem recebeu o crédito
    /// @param valor Valor creditado em wei
    event PagamentoLiberado(uint256 indexed pedidoId, address indexed para, uint256 valor);

    // [Recurso: EventosEErros] evento com 1 parâmetro indexed
    /// @notice Emitido quando alguém saca seu saldo
    /// @param conta Quem sacou
    /// @param valor Valor sacado em wei
    event Saque(address indexed conta, uint256 valor);

    // [Recurso: EventosEErros] evento com 1 parâmetro indexed
    /// @notice Emitido quando o dono nomeia ou remove um verificador
    /// @param conta Conta afetada
    /// @param ativo Se passou a ser verificador
    event VerificadorAlterado(address indexed conta, bool ativo);

    // [Recurso: EventosEErros] evento simples
    /// @notice Emitido quando o dono pausa ou despausa a plataforma
    /// @param pausado Novo estado
    event PausaAlterada(bool pausado);

    // =====================================================================
    // ERROS PERSONALIZADOS
    // =====================================================================

    // [Recurso: EventosEErros] erros personalizados (usados com revert)
    /// @notice A conta não tem permissão para a ação
    /// @param chamador Conta que tentou executar
    error NaoAutorizado(address chamador);

    /// @notice O valor enviado não é o preço do item
    /// @param esperado Valor exigido em wei
    /// @param enviado Valor recebido em wei
    error ValorIncorreto(uint256 esperado, uint256 enviado);

    /// @notice O item está desativado ou sem estoque
    /// @param itemId Id do item
    error ItemIndisponivel(uint256 itemId);

    /// @notice Saldo sacável insuficiente (ou valor zero)
    /// @param disponivel Saldo atual em wei
    /// @param solicitado Valor pedido em wei
    error SaldoInsuficiente(uint256 disponivel, uint256 solicitado);

    /// @notice O pedido não está no status exigido pela ação
    /// @param atual Status atual do pedido
    /// @param esperado Status exigido
    error StatusInvalido(Status atual, Status esperado);

    /// @notice O identificador informado na alfândega não bate com o registrado no embarque
    /// @param esperado Hash registrado no embarque
    /// @param informado Hash conferido pelo verificador
    error HashNaoConfere(bytes32 esperado, bytes32 informado);

    /// @notice O importador atingiu o limite de itens cadastrados
    /// @param limite Limite máximo
    error LimiteItensAtingido(uint256 limite);

    // =====================================================================
    // MODIFICADORES
    // =====================================================================

    // [Recurso: Modificadores] sem parâmetro: restringe ao dono
    /// @dev Só o dono do contrato pode executar
    modifier apenasDono() {
        if (msg.sender != dono) revert NaoAutorizado(msg.sender);
        _;
    }

    // [Recurso: Modificadores] sem parâmetro: restringe a verificadores nomeados
    /// @dev Só contas marcadas como verificadores podem executar
    modifier apenasVerificador() {
        if (!verificadores[msg.sender]) revert NaoAutorizado(msg.sender);
        _;
    }

    // [Recurso: Modificadores] sem parâmetro: bloqueia a função quando pausado
    /// @dev Bloqueia a função enquanto a plataforma estiver pausada
    modifier naoPausado() {
        require(!pausado, "Plataforma pausada");
        _;
    }

    // [Recurso: Modificadores] COM parâmetro: valida o id do item
    /// @dev Garante que o item existe
    modifier itemExiste(uint256 itemId) {
        require(itemId < itens.length, "Item inexistente");
        _;
    }

    // [Recurso: Modificadores] COM parâmetro: valida o id do pedido
    /// @dev Garante que o pedido existe
    modifier pedidoExiste(uint256 pedidoId) {
        require(pedidoId < pedidos.length, "Pedido inexistente");
        _;
    }

    // [Recurso: Modificadores] COM 2 parâmetros: exige um status específico do pedido
    /// @dev Exige que o pedido esteja no status esperado (usar depois de pedidoExiste)
    modifier noStatus(uint256 pedidoId, Status esperado) {
        if (pedidos[pedidoId].status != esperado) revert StatusInvalido(pedidos[pedidoId].status, esperado);
        _;
    }

    // =====================================================================
    // CONSTRUCTOR
    // =====================================================================

    // [Recurso: Funcoes] constructor
    constructor() {
        dono = msg.sender;
        nomePlataforma = "ImportaChain";
        verificadores[msg.sender] = true; // o dono já nasce verificador
    }

    // =====================================================================
    // FUNÇÕES COM REGRA DE NEGÓCIO
    // =====================================================================

    /// @notice Cadastra um item à venda; quem cadastra passa a ser o importador do item
    /// @param nome Nome do item (ex.: "Porsche 911 1990")
    /// @param categoria Categoria do item
    /// @param preco Preço em wei (maior que zero)
    /// @param estoque Quantidade disponível
    /// @return itemId Id do item criado
    // [Recurso: Funcoes] external; [Recurso: Modificadores] naoPausado
    function cadastrarItem(string calldata nome, Categoria categoria, uint256 preco, uint256 estoque)
        external
        naoPausado
        returns (uint256 itemId)
    {
        // [Recurso: EstruturasDeControle] require e if com revert de erro personalizado
        require(bytes(nome).length > 0, "Nome vazio");
        require(preco > 0, "Preco zero");
        if (itensDoImportador[msg.sender].length >= MAX_ITENS_POR_IMPORTADOR) {
            revert LimiteItensAtingido(MAX_ITENS_POR_IMPORTADOR);
        }

        itemId = itens.length;
        itens.push(
            Item({
                id: itemId,
                importador: payable(msg.sender),
                nome: nome,
                categoria: categoria,
                preco: preco,
                estoque: estoque,
                ativo: true
            })
        );
        itensDoImportador[msg.sender].push(itemId);

        emit ItemCadastrado(itemId, msg.sender, nome, categoria, preco);
    }

    /// @notice Atualiza preço, estoque e ativação de um item (só o importador do item)
    /// @param itemId Id do item
    /// @param preco Novo preço em wei (maior que zero)
    /// @param estoque Novo estoque
    /// @param ativo Se o item continua à venda
    // [Recurso: Funcoes] external; [Recurso: Modificadores] itemExiste(itemId)
    function atualizarItem(uint256 itemId, uint256 preco, uint256 estoque, bool ativo)
        external
        itemExiste(itemId)
    {
        Item storage item = itens[itemId];
        if (msg.sender != item.importador) revert NaoAutorizado(msg.sender);
        require(preco > 0, "Preco zero");

        item.preco = preco;
        item.estoque = estoque;
        item.ativo = ativo;

        emit ItemAtualizado(itemId, preco, estoque, ativo);
    }

    /// @notice Compra 1 unidade de um item; o ETH enviado fica em custódia no contrato
    /// @param itemId Id do item
    /// @return pedidoId Id do pedido criado (status Pago)
    // [Recurso: Funcoes] external payable; [Recurso: Modificadores] naoPausado, itemExiste
    function comprar(uint256 itemId)
        external
        payable
        naoPausado
        itemExiste(itemId)
        returns (uint256 pedidoId)
    {
        Item storage item = itens[itemId];

        if (!item.ativo || item.estoque == 0) revert ItemIndisponivel(itemId);
        if (msg.sender == item.importador) revert NaoAutorizado(msg.sender);
        if (msg.value != item.preco) revert ValorIncorreto(item.preco, msg.value);

        item.estoque -= 1;

        pedidoId = pedidos.length;
        pedidos.push(
            Pedido({
                id: pedidoId,
                itemId: itemId,
                comprador: msg.sender,
                importador: item.importador,
                valor: msg.value,
                adiantamentoPago: 0,
                hashAutenticidade: bytes32(0),
                status: Status.Pago,
                criadoEm: block.timestamp
            })
        );
        pedidosDoComprador[msg.sender].push(pedidoId);

        emit PedidoCriado(pedidoId, itemId, msg.sender, msg.value);
    }

    /// @notice O importador registra o embarque e o hash de autenticidade; recebe 30% de adiantamento
    /// @param pedidoId Id do pedido
    /// @param hashAutenticidade keccak256 do chassi/lote/série (use gerarHash)
    // [Recurso: Funcoes] external; [Recurso: Modificadores] pedidoExiste + noStatus(Pago)
    function registrarEmbarque(uint256 pedidoId, bytes32 hashAutenticidade)
        external
        pedidoExiste(pedidoId)
        noStatus(pedidoId, Status.Pago)
    {
        Pedido storage p = pedidos[pedidoId];
        if (msg.sender != p.importador) revert NaoAutorizado(msg.sender);
        require(hashAutenticidade != bytes32(0), "Hash vazio");

        p.hashAutenticidade = hashAutenticidade;

        uint256 adiantamento = calcularAdiantamento(p.valor);
        p.adiantamentoPago = adiantamento;
        _creditar(p.importador, adiantamento);

        emit AutenticidadeRegistrada(pedidoId, hashAutenticidade);
        _mudarStatus(p, Status.Embarcado);
    }

    /// @notice O verificador confere o item na alfândega; o hash precisa bater com o do embarque
    /// @param pedidoId Id do pedido
    /// @param hashConferido keccak256 do identificador digitado pelo verificador
    // [Recurso: Funcoes] external; [Recurso: Modificadores] apenasVerificador + pedidoExiste + noStatus
    function liberarAlfandega(uint256 pedidoId, bytes32 hashConferido)
        external
        apenasVerificador
        pedidoExiste(pedidoId)
        noStatus(pedidoId, Status.Embarcado)
    {
        Pedido storage p = pedidos[pedidoId];
        // o verificador não pode liberar o próprio item
        if (msg.sender == p.importador) revert NaoAutorizado(msg.sender);
        if (hashConferido != p.hashAutenticidade) revert HashNaoConfere(p.hashAutenticidade, hashConferido);

        conferiu[pedidoId][msg.sender] = true;
        _mudarStatus(p, Status.Liberado);
    }

    /// @notice O comprador confirma o recebimento; o importador recebe o restante menos a taxa
    /// @param pedidoId Id do pedido
    // [Recurso: Funcoes] external; [Recurso: Modificadores] pedidoExiste + noStatus(Liberado)
    function confirmarEntrega(uint256 pedidoId)
        external
        pedidoExiste(pedidoId)
        noStatus(pedidoId, Status.Liberado)
    {
        Pedido storage p = pedidos[pedidoId];
        if (msg.sender != p.comprador) revert NaoAutorizado(msg.sender);

        _liquidarEntrega(p);
        reputacao[p.importador] += 1;
        _mudarStatus(p, Status.Entregue);
    }

    /// @notice O comprador cancela antes do embarque e recebe 100% do valor como saldo sacável
    /// @param pedidoId Id do pedido
    // [Recurso: Funcoes] external; [Recurso: Modificadores] pedidoExiste + noStatus(Pago)
    function cancelarPedido(uint256 pedidoId)
        external
        pedidoExiste(pedidoId)
        noStatus(pedidoId, Status.Pago)
    {
        Pedido storage p = pedidos[pedidoId];
        if (msg.sender != p.comprador) revert NaoAutorizado(msg.sender);

        itens[p.itemId].estoque += 1;
        _creditar(p.comprador, p.valor);
        _mudarStatus(p, Status.Cancelado);
    }

    /// @notice O dono resolve uma disputa de um pedido já embarcado ou liberado
    /// @dev Se reembolsar, o comprador recebe o valor menos o adiantamento (frete já gasto)
    /// @param pedidoId Id do pedido
    /// @param reembolsarComprador true = reembolsa o comprador; false = paga o importador
    // [Recurso: Funcoes] external; [Recurso: Modificadores] apenasDono + pedidoExiste
    function resolverDisputa(uint256 pedidoId, bool reembolsarComprador)
        external
        apenasDono
        pedidoExiste(pedidoId)
    {
        Pedido storage p = pedidos[pedidoId];
        if (p.status != Status.Embarcado && p.status != Status.Liberado) {
            revert StatusInvalido(p.status, Status.Embarcado);
        }

        // [Recurso: EstruturasDeControle] if/else: decide para quem vai o ETH em custódia
        if (reembolsarComprador) {
            _creditar(p.comprador, p.valor - p.adiantamentoPago);
            reputacao[p.importador] -= 1;
            _mudarStatus(p, Status.Cancelado);
        } else {
            _liquidarEntrega(p);
            _mudarStatus(p, Status.Entregue);
        }
    }

    /// @notice Saca ETH do saldo da conta (único ponto de saída de ETH do contrato)
    /// @dev Checks-effects-interactions: o saldo é reduzido ANTES de enviar o ETH
    /// @param valor Valor a sacar em wei
    // [Recurso: Funcoes] external
    function sacar(uint256 valor) external {
        // checks
        uint256 disponivel = saldos[msg.sender];
        if (valor == 0 || valor > disponivel) revert SaldoInsuficiente(disponivel, valor);

        // effects
        saldos[msg.sender] = disponivel - valor;

        // interactions
        (bool ok, ) = payable(msg.sender).call{value: valor}("");
        require(ok, "Falha no envio");

        emit Saque(msg.sender, valor);
    }

    /// @notice O dono nomeia ou remove um verificador
    /// @param conta Endereço da conta
    /// @param ativo true para nomear, false para remover
    // [Recurso: Funcoes] external; [Recurso: Modificadores] apenasDono
    function nomearVerificador(address conta, bool ativo) external apenasDono {
        require(conta != address(0), "Endereco zero");
        verificadores[conta] = ativo;
        emit VerificadorAlterado(conta, ativo);
    }

    /// @notice O dono pausa ou despausa cadastro de itens e compras
    /// @param _pausado true para pausar
    // [Recurso: Funcoes] external; [Recurso: Modificadores] apenasDono
    function definirPausa(bool _pausado) external apenasDono {
        pausado = _pausado;
        emit PausaAlterada(_pausado);
    }

    // =====================================================================
    // FUNÇÕES DE CÁLCULO E LEITURA
    // =====================================================================

    /// @notice Calcula a taxa da plataforma sobre um valor
    /// @param valor Valor em wei
    /// @return Taxa em wei (2%)
    // [Recurso: Funcoes] public pure
    function calcularTaxa(uint256 valor) public pure returns (uint256) {
        return (valor * TAXA_BPS) / 10000;
    }

    /// @notice Calcula o adiantamento de embarque sobre um valor
    /// @param valor Valor em wei
    /// @return Adiantamento em wei (30%)
    // [Recurso: Funcoes] public pure
    function calcularAdiantamento(uint256 valor) public pure returns (uint256) {
        return (valor * ADIANTAMENTO_BPS) / 10000;
    }

    /// @notice Transforma um identificador (chassi, lote, série) em hash bytes32
    /// @param texto Identificador do item (o frontend normaliza em MAIÚSCULAS antes de chamar)
    /// @return Hash keccak256 do texto
    // [Recurso: Funcoes] external pure; [Recurso: TiposDeDados] bytes32
    function gerarHash(string calldata texto) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(texto));
    }

    /// @notice Confere se um hash é o registrado para o pedido (qualquer pessoa pode chamar)
    /// @param pedidoId Id do pedido
    /// @param hash Hash do identificador a conferir
    /// @return true se for autêntico
    // [Recurso: Funcoes] external view; [Recurso: Modificadores] pedidoExiste
    function verificarAutenticidade(uint256 pedidoId, bytes32 hash)
        external
        view
        pedidoExiste(pedidoId)
        returns (bool)
    {
        return pedidos[pedidoId].hashAutenticidade == hash && hash != bytes32(0);
    }

    /// @notice Retorna os dados de um item
    /// @param itemId Id do item
    /// @return O item
    // [Recurso: Funcoes] external view
    function getItem(uint256 itemId) external view itemExiste(itemId) returns (Item memory) {
        return itens[itemId];
    }

    /// @notice Retorna os dados de um pedido
    /// @param pedidoId Id do pedido
    /// @return O pedido
    // [Recurso: Funcoes] external view
    function getPedido(uint256 pedidoId) external view pedidoExiste(pedidoId) returns (Pedido memory) {
        return pedidos[pedidoId];
    }

    /// @notice Total de itens cadastrados
    /// @return Quantidade de itens
    // [Recurso: Funcoes] external view
    function totalItens() external view returns (uint256) {
        return itens.length;
    }

    /// @notice Total de pedidos criados
    /// @return Quantidade de pedidos
    // [Recurso: Funcoes] external view
    function totalPedidos() external view returns (uint256) {
        return pedidos.length;
    }

    /// @notice Lista os itens cadastrados por um importador (no máximo 20)
    /// @param imp Endereço do importador
    /// @return Lista de itens
    // [Recurso: Funcoes] external view; [Recurso: EstruturasDeControle] laço for limitado
    function listarItensDoImportador(address imp) external view returns (Item[] memory) {
        uint256[] storage ids = itensDoImportador[imp];
        Item[] memory lista = new Item[](ids.length);
        // laço limitado: ids.length nunca passa de MAX_ITENS_POR_IMPORTADOR (20)
        for (uint256 i = 0; i < ids.length; i++) {
            lista[i] = itens[ids[i]];
        }
        return lista;
    }

    /// @notice Lista os pedidos mais recentes de um comprador (no máximo 50)
    /// @param c Endereço do comprador
    /// @return Lista de pedidos, do mais antigo para o mais recente dentro da janela
    // [Recurso: Funcoes] external view; [Recurso: EstruturasDeControle] laço for limitado
    function listarPedidosDoComprador(address c) external view returns (Pedido[] memory) {
        uint256[] storage ids = pedidosDoComprador[c];
        uint256 total = ids.length;
        uint256 inicio = 0;
        // [Recurso: EstruturasDeControle] if/else: só os MAX_LISTAGEM mais recentes
        if (total > MAX_LISTAGEM) {
            inicio = total - MAX_LISTAGEM;
        } else {
            inicio = 0;
        }

        Pedido[] memory lista = new Pedido[](total - inicio);
        // laço limitado a MAX_LISTAGEM iterações
        for (uint256 i = inicio; i < total; i++) {
            lista[i - inicio] = pedidos[ids[i]];
        }
        return lista;
    }

    // =====================================================================
    // FUNÇÕES INTERNAS E PRIVADAS
    // =====================================================================

    /// @dev Credita saldo sacável a uma conta
    // [Recurso: Funcoes] internal
    function _creditar(address conta, uint256 valor) internal {
        saldos[conta] += valor;
    }

    /// @dev Converte o restante do pagamento em saldo: importador recebe (restante - taxa), dono recebe a taxa
    // [Recurso: Funcoes] internal
    function _liquidarEntrega(Pedido storage p) internal {
        uint256 restante = p.valor - p.adiantamentoPago;
        uint256 taxa = calcularTaxa(p.valor);
        uint256 paraImportador = restante - taxa;

        _creditar(p.importador, paraImportador);
        _creditar(dono, taxa);

        emit PagamentoLiberado(p.id, p.importador, paraImportador);
    }

    /// @dev Muda o status do pedido e emite o evento
    // [Recurso: Funcoes] private
    function _mudarStatus(Pedido storage p, Status novo) private {
        p.status = novo;
        emit EtapaAvancada(p.id, novo, msg.sender);
    }
}
