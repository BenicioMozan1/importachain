// ABI e endereço do contrato ImportaChain implantado na Sepolia
// ATENÇÃO: depois do deploy, preencha "endereco" e "blocoDeploy" (veja tests/preencher-contrato.js).
// A ABI abaixo foi gerada pelo solc 0.8.24 a partir de contracts/ImportaChain.sol e inclui os 7 erros personalizados.
const CONTRATO = {
  endereco: "0x9Ca0D97075997a044Bc7e6bee87E69680d980919",
  blocoDeploy: 12141497, // número do bloco da transação de deploy
  chainIdHex: "0xaa36a7", // Sepolia (11155111)
  etherscan: "https://sepolia.etherscan.io",
  abi: [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "esperado",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "informado",
          "type": "bytes32"
        }
      ],
      "name": "HashNaoConfere",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "itemId",
          "type": "uint256"
        }
      ],
      "name": "ItemIndisponivel",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "limite",
          "type": "uint256"
        }
      ],
      "name": "LimiteItensAtingido",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "chamador",
          "type": "address"
        }
      ],
      "name": "NaoAutorizado",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "disponivel",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "solicitado",
          "type": "uint256"
        }
      ],
      "name": "SaldoInsuficiente",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "enum ImportaChain.Status",
          "name": "atual",
          "type": "uint8"
        },
        {
          "internalType": "enum ImportaChain.Status",
          "name": "esperado",
          "type": "uint8"
        }
      ],
      "name": "StatusInvalido",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "esperado",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "enviado",
          "type": "uint256"
        }
      ],
      "name": "ValorIncorreto",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "hashAutenticidade",
          "type": "bytes32"
        }
      ],
      "name": "AutenticidadeRegistrada",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "enum ImportaChain.Status",
          "name": "novoStatus",
          "type": "uint8"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "por",
          "type": "address"
        }
      ],
      "name": "EtapaAvancada",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "itemId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "preco",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "estoque",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "ativo",
          "type": "bool"
        }
      ],
      "name": "ItemAtualizado",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "itemId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "importador",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "nome",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "enum ImportaChain.Categoria",
          "name": "categoria",
          "type": "uint8"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "preco",
          "type": "uint256"
        }
      ],
      "name": "ItemCadastrado",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "para",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "valor",
          "type": "uint256"
        }
      ],
      "name": "PagamentoLiberado",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "bool",
          "name": "pausado",
          "type": "bool"
        }
      ],
      "name": "PausaAlterada",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "itemId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "comprador",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "valor",
          "type": "uint256"
        }
      ],
      "name": "PedidoCriado",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "conta",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "valor",
          "type": "uint256"
        }
      ],
      "name": "Saque",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "conta",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "ativo",
          "type": "bool"
        }
      ],
      "name": "VerificadorAlterado",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "ADIANTAMENTO_BPS",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_ITENS_POR_IMPORTADOR",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_LISTAGEM",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "TAXA_BPS",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "itemId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "preco",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "estoque",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "ativo",
          "type": "bool"
        }
      ],
      "name": "atualizarItem",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "nome",
          "type": "string"
        },
        {
          "internalType": "enum ImportaChain.Categoria",
          "name": "categoria",
          "type": "uint8"
        },
        {
          "internalType": "uint256",
          "name": "preco",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "estoque",
          "type": "uint256"
        }
      ],
      "name": "cadastrarItem",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "itemId",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "valor",
          "type": "uint256"
        }
      ],
      "name": "calcularAdiantamento",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "valor",
          "type": "uint256"
        }
      ],
      "name": "calcularTaxa",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        }
      ],
      "name": "cancelarPedido",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "itemId",
          "type": "uint256"
        }
      ],
      "name": "comprar",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "conferiu",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        }
      ],
      "name": "confirmarEntrega",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bool",
          "name": "_pausado",
          "type": "bool"
        }
      ],
      "name": "definirPausa",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "dono",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "texto",
          "type": "string"
        }
      ],
      "name": "gerarHash",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "itemId",
          "type": "uint256"
        }
      ],
      "name": "getItem",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "address payable",
              "name": "importador",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "nome",
              "type": "string"
            },
            {
              "internalType": "enum ImportaChain.Categoria",
              "name": "categoria",
              "type": "uint8"
            },
            {
              "internalType": "uint256",
              "name": "preco",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "estoque",
              "type": "uint256"
            },
            {
              "internalType": "bool",
              "name": "ativo",
              "type": "bool"
            }
          ],
          "internalType": "struct ImportaChain.Item",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        }
      ],
      "name": "getPedido",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "itemId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "comprador",
              "type": "address"
            },
            {
              "internalType": "address payable",
              "name": "importador",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "valor",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "adiantamentoPago",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "hashAutenticidade",
              "type": "bytes32"
            },
            {
              "internalType": "enum ImportaChain.Status",
              "name": "status",
              "type": "uint8"
            },
            {
              "internalType": "uint256",
              "name": "criadoEm",
              "type": "uint256"
            }
          ],
          "internalType": "struct ImportaChain.Pedido",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "hashConferido",
          "type": "bytes32"
        }
      ],
      "name": "liberarAlfandega",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "imp",
          "type": "address"
        }
      ],
      "name": "listarItensDoImportador",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "address payable",
              "name": "importador",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "nome",
              "type": "string"
            },
            {
              "internalType": "enum ImportaChain.Categoria",
              "name": "categoria",
              "type": "uint8"
            },
            {
              "internalType": "uint256",
              "name": "preco",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "estoque",
              "type": "uint256"
            },
            {
              "internalType": "bool",
              "name": "ativo",
              "type": "bool"
            }
          ],
          "internalType": "struct ImportaChain.Item[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "c",
          "type": "address"
        }
      ],
      "name": "listarPedidosDoComprador",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "itemId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "comprador",
              "type": "address"
            },
            {
              "internalType": "address payable",
              "name": "importador",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "valor",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "adiantamentoPago",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "hashAutenticidade",
              "type": "bytes32"
            },
            {
              "internalType": "enum ImportaChain.Status",
              "name": "status",
              "type": "uint8"
            },
            {
              "internalType": "uint256",
              "name": "criadoEm",
              "type": "uint256"
            }
          ],
          "internalType": "struct ImportaChain.Pedido[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "nomePlataforma",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "conta",
          "type": "address"
        },
        {
          "internalType": "bool",
          "name": "ativo",
          "type": "bool"
        }
      ],
      "name": "nomearVerificador",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "pausado",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "hashAutenticidade",
          "type": "bytes32"
        }
      ],
      "name": "registrarEmbarque",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "reputacao",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "reembolsarComprador",
          "type": "bool"
        }
      ],
      "name": "resolverDisputa",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "valor",
          "type": "uint256"
        }
      ],
      "name": "sacar",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "saldos",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalItens",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalPedidos",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "verificadores",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "pedidoId",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "hash",
          "type": "bytes32"
        }
      ],
      "name": "verificarAutenticidade",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
};
