# worktest-audit

## Description

### ERC20 Token
The `Token` contract defines a fully-compliant [ERC20](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md) mintable token that is initialized with an initial supply.

### Timelock
Besides the usual ERC20 operations, users can transfer tokens to a timelock contract that is intended to hold the tokens during a specific period of time, and only the beneficiary of those tokens is allowed to release the tokens. This can be done by any user, calling the `timelockTransfer` function.

Minting of tokens can also be done to a timelock contract by calling the `timelockMint` function of `Token`. This last operation, however, is restricted to the owner of the `Token` contract.

### Token distribution
The `TokenDistributor` contract is a mechanism through which tokens can be distributed to multiple addresses (a.k.a `beneficiaries`). After deploying the contract, the owner of the `TokenDistributor` is allowed to add as many beneficiaries as they want via the `registerBeneficiary` function.

At any moment, the owner can also decrease the amount of tokens that a certain beneficiary will receive by calling the `decreaseBenefit` function. Finally, `payAllBeneficiaries` should be called by the owner to execute the payment of the tokens for all the registered beneficiaries.

It is important to highlight that the `TokenDistributor` contract does not hold any amount of tokens initially, so after its deployment, it should be sent as many tokens as needed to succesfully distribute them among beneficiaries.
