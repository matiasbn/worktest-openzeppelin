pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/**
 * @title TokenDistributor
 * @notice Contract for token distribution.
 * @dev For this contract to work properly, it should be sent tokens first.
 */
contract TokenDistributor {
    using SafeMath for uint256;

    address private _owner;

    // Address of the token contract
    address private _tokenAddress;

    // Array to hold all addresses that will receive a payment
    address[] beneficiaries;

    // Total amount of tokens to distribute
    uint256 private _totalAmount;

    // Mapping to keep track of how many tokens each beneficiary will receive
    mapping (address => uint256) amountsByBeneficiary;
    
    modifier onlyOwner() {
        require(msg.sender == _owner);
        _;
    }   

    /**
     * Constructor
     */
    function TokenDistributor(address tokenAddress) public {
        require(tokenAddress != address(0));
        _tokenAddress = tokenAddress;
        _owner = msg.sender;
    }

    /**
     * Add the address of a beneficiary that will receive a certain amount of tokens.
     */
    function registerBeneficiary(address beneficiary, uint256 amount) onlyOwner external {
        require(amount > 0, "Amount must be greater than zero");

        _totalAmount += amount;
        beneficiaries.push(beneficiary);
        amountsByBeneficiary[beneficiary] += amount;
    }

    /**
     * Decrease, by the given amount, the number of tokens a beneficiary will receive.
     */
    function decreaseBenefit(address beneficiary, uint256 amount) public onlyOwner {
        require(amountsByBeneficiary[beneficiary] != 0, "Beneficiary does not exist");
        
        // Decrease total and beneficiary's amount
        _totalAmount -= amount;
        amountsByBeneficiary[beneficiary] -= amount;
    }

    function payAllBeneficiaries() external onlyOwner {
        for (uint8 index = 0; index < beneficiaries.length; index++) {
            _paySingleBeneficiary(beneficiaries[index]);
        }
    }

    /**
     * Private function to pay a single beneficiary
     */
    function _paySingleBeneficiary(address beneficiary) {        
        uint256 amount = amountsByBeneficiary[beneficiary];

        // Transfer tokens to beneficiary
        IERC20(_tokenAddress).transfer(beneficiary, amount);

        // Decrease total amount of tokens to be distributed
        _totalAmount -= amount;
    }

    // Getters

    function getNumberOfBeneficiaries() external view returns (uint256) {
        return beneficiaries.length;
    }

    function getAmount(address beneficiary) external view returns (uint256) {
        return amountsByBeneficiary[beneficiary];
    }

    function owner() external returns (address) {
        return _owner;
    }

    function tokenAddress() external returns (address) {
        return _tokenAddress;
    }
    
    function totalAmount() external view returns (uint256) {
        return _totalAmount;
    }
}