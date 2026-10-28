// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
/// TEST FIXTURE ONLY — minimal standard ERC-20 used by the e2e scanner test. Never deployed to a public network.
/// Like most real tokens, transferFrom(victim, x, 0) succeeds without allowance (enables the zero-value spoof).
contract TestToken {
    string public name; string public symbol; uint8 public decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    constructor(string memory n, string memory s, uint8 d) { name = n; symbol = s; decimals = d; }
    function mint(address to, uint256 v) external { balanceOf[to] += v; emit Transfer(address(0), to, v); }
    function transfer(address to, uint256 v) external returns (bool) { _move(msg.sender, to, v); return true; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; emit Approval(msg.sender, s, v); return true; }
    function transferFrom(address f, address t, uint256 v) external returns (bool) {
        uint256 a = allowance[f][msg.sender];
        require(a >= v, "allowance");
        if (a != type(uint256).max) allowance[f][msg.sender] = a - v;
        _move(f, t, v); return true;
    }
    function _move(address f, address t, uint256 v) internal { require(balanceOf[f] >= v, "balance"); balanceOf[f] -= v; balanceOf[t] += v; emit Transfer(f, t, v); }
}
