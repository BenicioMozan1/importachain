# ImportaChain

> dApp de importação de itens de alto valor (carros, bebidas, relógios) com custódia do pagamento em etapas e certificado de autenticidade por hash, na rede de teste Ethereum Sepolia.

🔗 **dApp (Vercel):** https://importachain-frontend.vercel.app
📜 **Contrato (Sepolia):** [0x9Ca0D97075997a044Bc7e6bee87E69680d980919](https://sepolia.etherscan.io/address/0x9Ca0D97075997a044Bc7e6bee87E69680d980919)
🎥 **Vídeo de demonstração:** <<PREENCHER: link>>

> **Guia de preenchimento:** as seções 5 a 8 são do Benicio (já escritas, falta só preencher os dados do deploy na seção 5). As seções 1 a 4, 13, 14 e 15 são do Davi. As seções 9 a 12 são do Thiago. Apague esta nota e os marcadores `<<PREENCHER>>` antes da entrega.

---

## 1. Tema e problema resolvido
<<DAVI>>

## 2. Integrantes e papéis
<<DAVI>>

## 3. Arquitetura
<<DAVI: diagrama>>

## 4. Diagrama de estados do pedido
<<DAVI: diagrama>>

---

## 5. Dados do deploy

| Item | Valor |
| --- | --- |
| Rede | Ethereum Sepolia (Chain ID 11155111 / 0xaa36a7) |
| Endereço do contrato | `0x9Ca0D97075997a044Bc7e6bee87E69680d980919` |
| Link no Etherscan | https://sepolia.etherscan.io/address/0x9Ca0D97075997a044Bc7e6bee87E69680d980919 |
| Hash da transação de deploy | [`0x0156ba0757f3c30f8f208956dfc0393d833d36f76f3f851368c159391152a29e`](https://sepolia.etherscan.io/tx/0x0156ba0757f3c30f8f208956dfc0393d833d36f76f3f851368c159391152a29e) |
| Bloco do deploy | [12141497](https://sepolia.etherscan.io/block/12141497) |
| Compilador | Solidity 0.8.24 (`0.8.24+commit.e11b9ed9`), otimização desligada |
| Gás usado no deploy (Sepolia) | 28.427.216 (taxa 0,04264 ETH de teste, preço 1,5 gwei) |
| Verificado no Etherscan | Sim ([código-fonte](https://sepolia.etherscan.io/address/0x9Ca0D97075997a044Bc7e6bee87E69680d980919#code)); também verificado no Sourcify, Blockscout e Routescan |
| Conta do dono (deployer) | `0x5Dd22d9718B458f11A4C719908149651aFCf43ac` |

## 6. Funções do contrato

O contrato `ImportaChain` tem **11 funções externas com regra de negócio** (o mínimo exigido é 6), além das funções de leitura e das internas. As permissões estão em 4 papéis: **importador** (quem cadastrou o item), **comprador**, **verificador** (perito/despachante nomeado pelo dono) e **dono**.

### 6.1 Funções com regra de negócio

| Função | O que faz | Quem pode chamar | Eventos | Erros possíveis |
| --- | --- | --- | --- | --- |
| `cadastrarItem(nome, categoria, preco, estoque)` | Cadastra um item à venda; quem cadastra vira o importador. Limite de 20 itens por importador. | Qualquer conta | `ItemCadastrado` | `LimiteItensAtingido`; require: "Plataforma pausada", "Nome vazio", "Preco zero" |
| `atualizarItem(itemId, preco, estoque, ativo)` | Atualiza preço, estoque e se o item está à venda. | Só o importador do item | `ItemAtualizado` | `NaoAutorizado`; require: "Item inexistente", "Preco zero" |
| `comprar(itemId)` **payable** | Compra 1 unidade; o ETH enviado fica em custódia no contrato. Cria o pedido em `Pago`. | Qualquer conta, menos o importador do item | `PedidoCriado` | `ItemIndisponivel`, `NaoAutorizado`, `ValorIncorreto`; require: "Plataforma pausada", "Item inexistente" |
| `registrarEmbarque(pedidoId, hash)` | Importador registra o hash do chassi/lote/série e recebe 30% de adiantamento (como saldo). Status `Pago` → `Embarcado`. | Só o importador do pedido | `AutenticidadeRegistrada`, `EtapaAvancada` | `NaoAutorizado`, `StatusInvalido`; require: "Hash vazio", "Pedido inexistente" |
| `liberarAlfandega(pedidoId, hashConferido)` | Verificador confere o identificador; só passa se o hash bater. `Embarcado` → `Liberado`. | Só verificador, e nunca o próprio importador do pedido | `EtapaAvancada` | `NaoAutorizado`, `HashNaoConfere`, `StatusInvalido`; require: "Pedido inexistente" |
| `confirmarEntrega(pedidoId)` | Comprador confirma o recebimento. Importador recebe o restante (70%) menos a taxa de 2%; a taxa vai para o dono. `Liberado` → `Entregue`; reputação do importador +1. | Só o comprador do pedido | `PagamentoLiberado`, `EtapaAvancada` | `NaoAutorizado`, `StatusInvalido`; require: "Pedido inexistente" |
| `cancelarPedido(pedidoId)` | Cancela antes do embarque; o comprador recebe 100% como saldo e o estoque volta. `Pago` → `Cancelado`. | Só o comprador do pedido | `EtapaAvancada` | `NaoAutorizado`, `StatusInvalido`; require: "Pedido inexistente" |
| `resolverDisputa(pedidoId, reembolsarComprador)` | Resolve pedido já embarcado/liberado. Se reembolsar: comprador recebe o valor menos o adiantamento (frete já gasto), reputação do importador −1 e status `Cancelado`. Senão: importador recebe como numa entrega e status `Entregue`. | **Só o dono** | `EtapaAvancada` (+ `PagamentoLiberado` se pagar o importador) | `NaoAutorizado`, `StatusInvalido`; require: "Pedido inexistente" |
| `sacar(valor)` | Único ponto de saída de ETH do contrato (pull payment). Usa checks-effects-interactions. | Qualquer conta com saldo | `Saque` | `SaldoInsuficiente`; require: "Falha no envio" |
| `nomearVerificador(conta, ativo)` | Nomeia ou remove um verificador. | **Só o dono** | `VerificadorAlterado` | `NaoAutorizado`; require: "Endereco zero" |
| `definirPausa(pausado)` | Pausa ou despausa cadastro de itens e compras. | **Só o dono** | `PausaAlterada` | `NaoAutorizado` |

### 6.2 Funções de leitura e auxiliares

| Função | Tipo | O que faz |
| --- | --- | --- |
| `calcularTaxa(valor)` | public pure | Taxa de 2% (`valor * 200 / 10000`) |
| `calcularAdiantamento(valor)` | public pure | Adiantamento de 30% (`valor * 3000 / 10000`) |
| `gerarHash(texto)` | external pure | `keccak256` do identificador (o frontend normaliza em maiúsculas antes) |
| `verificarAutenticidade(pedidoId, hash)` | external view | `true` se o hash é o registrado no embarque; qualquer pessoa pode chamar |
| `getItem(itemId)` / `getPedido(pedidoId)` | external view | Dados do item / pedido |
| `totalItens()` / `totalPedidos()` | external view | Quantidades |
| `listarItensDoImportador(imp)` | external view | Itens de um importador (máx. 20) |
| `listarPedidosDoComprador(c)` | external view | Os 50 pedidos mais recentes de um comprador |
| `_creditar(conta, valor)` | internal | Soma saldo sacável |
| `_liquidarEntrega(p)` | internal | Converte o restante do pagamento em saldo: importador (restante − taxa) e dono (taxa) |
| `_mudarStatus(p, novo)` | private | Muda o status e emite `EtapaAvancada` |

### 6.3 Regras de dinheiro (exemplo com 1 finney = 0,001 ETH)

| Momento | Importador | Comprador | Dono | Em custódia |
| --- | --- | --- | --- | --- |
| Compra | — | −0,001 ETH pago | — | 0,001 |
| Embarque | +0,0003 (30%) como saldo | — | — | 0,0007 |
| Entrega | +0,00068 (70% − 2%) | — | +0,00002 (taxa 2%) | 0 |
| Cancelamento (antes do embarque) | — | +0,001 (100%) | — | 0 |
| Disputa a favor do comprador | fica com 0,0003 | +0,0007 | — | 0 |

## 7. Tabela de recursos de Solidity

Todas as linhas se referem a `contracts/ImportaChain.sol`. Cada uso está marcado no código com `// [Recurso: ...]`.

| Grupo | Onde aparece (linhas / funções) | Por que foi usado |
| --- | --- | --- |
| **TiposDeDados** | `address public immutable dono` (L17); `uint256 constant` TAXA_BPS, ADIANTAMENTO_BPS, MAX_ITENS_POR_IMPORTADOR, MAX_LISTAGEM (L21, 25, 29, 33); `string nomePlataforma` (L37); `bool pausado` (L41); `int256` em `reputacao` (L93); `address payable` em `Item.importador` e `Pedido.importador` (L56, L69) e `payable(msg.sender)` (L296); `bytes32` em `Pedido.hashAutenticidade` (L72), `registrarEmbarque` (L372), `liberarAlfandega` (L395), `gerarHash` (L529) | O dono é `immutable` porque nunca muda após o deploy. Taxa e limites são `constant` porque são regras fixas (leitura barata em gás). `int256` porque a reputação pode ficar negativa. `bytes32` guarda só o hash do chassi/lote, que protege o dado real e ocupa tamanho fixo. `address payable` marca quem recebe ETH. |
| **Funcoes** | `constructor` (L263); **external**: `cadastrarItem` (L280), `atualizarItem` (L315), `registrarEmbarque` (L372), `liberarAlfandega` (L395), `confirmarEntrega` (L413), `cancelarPedido` (L429), `resolverDisputa` (L447), `sacar` (L472), `nomearVerificador` (L491), `definirPausa` (L500); **external payable**: `comprar` (L334); **public pure**: `calcularTaxa` (L513), `calcularAdiantamento` (L521); **external pure**: `gerarHash` (L529); **external view**: `verificarAutenticidade` (L538), `getItem` (L551), `getPedido` (L559), `totalItens` (L566), `totalPedidos` (L573), `listarItensDoImportador` (L581), `listarPedidosDoComprador` (L595); **internal**: `_creditar` (L620), `_liquidarEntrega` (L626); **private**: `_mudarStatus` (L639) | `external` nas funções chamadas de fora (mais barato em gás). `public` em `calcularTaxa` porque é chamada de fora e por dentro. `internal` em `_creditar` e `_liquidarEntrega` (lógica compartilhada pelo contrato). `private` em `_mudarStatus` (detalhe que só este contrato usa). `payable` só em `comprar`, a única função que recebe ETH. `view`/`pure` nas leituras e cálculos, que não gastam gás quando chamadas de fora. |
| **EstruturasDeControle** | **if/else**: L453-455 (`if` de status em `resolverDisputa`), L458-465 (`if/else`: reembolsa o comprador ou paga o importador), L600-604 (`if/else` da janela de 50 pedidos em `listarPedidosDoComprador`); **if + revert**: L288, L320, L343-345, L378, L403-404, L419, L435, L475; **for**: L585 (limitado a 20 itens) e L608 (limitado a 50 pedidos); **require**: L233, L240, L247, L286-287, L321, L379, L482, L492 | O `if/else` decide para quem vai o ETH em custódia numa disputa. Os dois `for` percorrem listas com **limite explícito** (constantes de 20 e 50), para o gás nunca estourar. `require` valida entradas simples (texto vazio, preço zero, hash vazio, endereço zero). |
| **ArraysEMappings** | **array dinâmico**: `Item[] itens` (L82), `Pedido[] pedidos` (L85); **mapping simples**: `saldos` (L89), `reputacao` (L93), `verificadores` (L97); **mapping → array**: `itensDoImportador` (L100), `pedidosDoComprador` (L103); **mapping aninhado**: `conferiu[pedidoId][verificador]` (L107) | Os arrays guardam todos os itens e pedidos (o índice é o id). `saldos` implementa o pull payment. `verificadores` controla o papel de verificador. `conferiu` registra qual verificador conferiu cada pedido (usado em `liberarAlfandega`, L406). Os mappings para array permitem listar por importador e por comprador sem percorrer tudo. |
| **StructsEEnums** | **enum** `Categoria` (L48, 4 valores); **enum** `Status` (L51: Pago, Embarcado, Liberado, Entregue, Cancelado); **struct** `Item` (L54, 7 campos); **struct** `Pedido` (L65, 9 campos) | O `Status` modela o ciclo de vida do pedido (máquina de estados). `Pedido` junta tudo de uma compra (valor, adiantamento, hash, status). `Item` descreve o produto. `Categoria` classifica carro, bebida, relógio ou outro. |
| **Modificadores** | `apenasDono` (L218), `apenasVerificador` (L225), `naoPausado` (L232) **sem parâmetro**; `itemExiste(itemId)` (L239), `pedidoExiste(pedidoId)` (L246) **com 1 parâmetro**; `noStatus(pedidoId, esperado)` (L253) **com 2 parâmetros**. Usados, por exemplo, em `comprar` (L334-338), `registrarEmbarque` (L372-375), `liberarAlfandega` (L395-399) e `resolverDisputa` (L447-450) | Tiram a validação repetida das funções e deixam a regra de negócio legível. `noStatus` força a ordem do fluxo (não dá para confirmar entrega de um pedido que não foi liberado). `apenasDono` e `apenasVerificador` implementam o controle de acesso por papel. |
| **EventosEErros** | **9 eventos** (L120-173), 8 com parâmetros `indexed`: `ItemCadastrado`, `ItemAtualizado`, `PedidoCriado`, `EtapaAvancada`, `AutenticidadeRegistrada`, `PagamentoLiberado`, `Saque`, `VerificadorAlterado` (+ `PausaAlterada`); **7 erros personalizados** (L182-210): `NaoAutorizado`, `ValorIncorreto`, `ItemIndisponivel`, `SaldoInsuficiente`, `StatusInvalido`, `HashNaoConfere`, `LimiteItensAtingido`; usados com `revert` em L219, L226, L254, L289, L320, L343-345, L378, L403-404, L419, L435, L454, L475 | Os eventos formam o histórico on-chain que o frontend lê com `getPastEvents`; `indexed` permite filtrar por pedido, item, comprador ou importador. Os erros personalizados gastam menos gás que texto e **carregam parâmetros** (ex.: `ValorIncorreto(esperado, enviado)`), o que permite mensagens claras no frontend. `require` com texto fica para validações simples. |

## 8. Segurança

| Risco | Como o contrato trata | Onde |
| --- | --- | --- |
| Reentrância em `sacar` | Checks-effects-interactions: valida, **zera o saldo** e só depois envia o ETH. Testado com um contrato atacante (a reentrada é revertida e o atacante só recebe o que tinha). | L472-485 |
| Roubo de ETH por envio direto | Nenhuma função envia ETH, exceto `sacar`. Todo pagamento vira crédito em `saldos` (pull payment). Sem `receive`/`fallback`: ETH enviado direto é rejeitado. | `_creditar` (L620) |
| Pular etapas do fluxo | Modificador `noStatus` exige o status certo em cada passo. | L253, usado em L372-375, 395-399, 413-416, 429-432 |
| Verificador liberar o próprio item | `liberarAlfandega` reverte `NaoAutorizado` se o verificador é o importador do pedido. | L403 |
| Importador comprar o próprio item | `comprar` reverte `NaoAutorizado`. | L344 |
| Pagar valor errado | `comprar` exige `msg.value == preco` exato (`ValorIncorreto`). | L345 |
| Underflow | Solidity 0.8 reverte em overflow/underflow; além disso, `restante − taxa` é sempre positivo (70% > 2%), e o adiantamento arredonda para baixo. | L626-629 |
| Laços sem limite | Os dois `for` têm limite de 20 e 50. | L585, L608 |
| Privacidade do chassi/lote | Só o hash `keccak256` vai para a blockchain, nunca o identificador real. | L72, L529 |
| Controle de acesso | `apenasDono` (disputas, verificadores, pausa) e `apenasVerificador` (alfândega). | L218, L225 |

**Invariante de saldo.** Em qualquer momento, o ETH guardado no contrato é igual a: **soma de todos os `saldos`** + **valor dos pedidos em `Pago`** + **(valor − adiantamentoPago) dos pedidos em `Embarcado` ou `Liberado`**. Pedidos `Entregue` e `Cancelado` já viraram saldo sacável. A suíte de testes confere essa igualdade depois de cada operação.

**Testes.** (a) Roteiro de 24 testes no Remix VM e na Sepolia. (b) Suíte automatizada em `tests/` (EVM local com ganache e Web3.js 4): 88 verificações, incluindo os 24 do roteiro, o invariante de saldo, valores com arredondamento (1, 3, 7, 99 wei), o limite de 20 itens, a janela de 50 pedidos, o ataque de reentrância e o envio direto de ETH. Para rodar: `cd tests && npm install && npm test`.

**Gás medido na Sepolia** (transações reais do fluxo de demonstração, otimização desligada, preço ~1,5 gwei; links e prints em `docs/prints/`). Para comparação, a coluna "EVM local" traz o valor medido na suíte de testes:

| Operação | Gás na Sepolia | EVM local | Taxa paga (ETH de teste) |
| --- | --- | --- | --- |
| Deploy do contrato | 28.427.216 | ≈ 4.010.882 | 0,04264 |
| `cadastrarItem` | 919.960 – 929.984 | 192.312 | ≈ 0,0014 |
| `atualizarItem` | 39.982 | — | ≈ 0,00006 |
| `comprar` | 830.006 | 187.454 | ≈ 0,00125 |
| `registrarEmbarque` | 470.463 | 124.583 | ≈ 0,0007 |
| `liberarAlfandega` | 152.441 | 63.221 | ≈ 0,00023 |
| `confirmarEntrega` | 280.221 | 95.781 | ≈ 0,00042 |
| `sacar` | 31.458 | 31.022 | ≈ 0,00005 |

Observação: as operações que **criam armazenamento novo** (deploy, cadastro, compra, embarque) custaram de 3x a 7x mais na Sepolia do que na EVM local, enquanto as que só alteram valores existentes (`atualizarItem`, `sacar`) ficaram praticamente iguais. Ou seja, a rede de teste cobra bem mais caro para gravar dados novos do que o ambiente local de testes. Isso reforça as escolhas do contrato de guardar só o hash (32 bytes) e de limitar listas.

---

## 9. Frontend: funcionalidades
<<THIAGO>>

## 10. Como executar localmente
<<THIAGO>>

## 11. Como configurar a MetaMask na Sepolia
<<THIAGO>>

## 12. Roteiro de teste para o avaliador
<<THIAGO>>

---

## 13. Limitações conhecidas e melhorias futuras
<<DAVI>>

## 14. Declaração de uso de IA
<<DAVI>>

## 15. Estrutura do repositório
<<DAVI>>
