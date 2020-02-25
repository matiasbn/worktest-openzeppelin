pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/TokenTimelock.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Token
 * @notice Fully-compliant ERC20 mintable token
 */
contract Token is ERC20Mintable {
    string private constant _name = "Token";
    string private constant _symbol = "TKN";
    uint8 private constant _decimals = 18;

    constructor() public {
        uint8 base = 10;
        uint256 initialSupply = 1000 * (base**_decimals);
        // The account creating the token receives the whole initial supply
        _mint(msg.sender, initialSupply);
    }

    function timelockTransfer(
        address beneficiary,
        uint256 amount,
        uint256 releaseTime
    ) external {
        // Deploy timelock contract
        TokenTimelock newTimelock = new TokenTimelock(
            IERC20(address(this)),
            beneficiary,
            releaseTime
        );

        // Send tokens to timelock
        transfer(address(newTimelock), amount);
    }

    /**
     * Issue new tokens, but first keep them in a timelock contract for a specific period of time
     */

    function timelockMint(
        address beneficiary,
        uint256 amount,
        uint256 releaseTime
    ) external {
        // Deploy timelock contract
        TokenTimelock newTimelock = new TokenTimelock(
            IERC20(address(this)),
            beneficiary,
            releaseTime
        );

        /**
        * @dev this was supposed to be the 'mint' function, not the '_mint' function. '_mint' is an internal function at the
        ERC20.sol contract without access control i.e. anyone could mint tokens without being the minter.
        */
        // Mint tokens to timelock
        _mint(address(newTimelock), amount);
    }

    function name() public view returns (string _name) {
        return _name;
    }

    function symbol() public view returns (string _symbol) {
        return _symbol;
    }

    function decimals() public view returns (uint8 _decimals) {
        return _decimals;
    }
}
