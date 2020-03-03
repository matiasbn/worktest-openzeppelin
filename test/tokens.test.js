const Token = artifacts.require('Token');
const TokenDistributor = artifacts.require('TokenDistributor');
const TokenTimelock = artifacts.require('TokenTimelock');
const { catchRevert } = require('./exceptionsHelpers');


const mineBlock = () => new Promise((resolve, reject) => {
  web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
    id: new Date().getTime(),
  }, (err, result) => {
    if (err) { return reject(err); }
    const newBlockHash = web3.eth.getBlock('latest').hash;

    return resolve(newBlockHash);
  });
});

const advanceTime = (time) => new Promise((resolve, reject) => {
  web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [time],
    id: new Date().getTime(),
  }, (err, result) => {
    if (err) { return reject(err); }
    return resolve(result);
  });
});

contract('Token', (accounts) => {
  let token;

  beforeEach(async () => {
    token = await Token.new();
  });

  const owner = accounts[0];
  const user = accounts[1];

  it('should have a totalSupply of 0 on deployment', async () => {
    // contract deployed once again
    // This test aims to demonstrate that the 'minted' value at deployment is 0
    token = await Token.new();
    const transferEvent = await token.getPastEvents('Transfer', { fromBlock: 0 });
    assert.equal(transferEvent[0].returnValues.value, '0', 'Transfer event value is not 0');
    const ownerBalance = await token.balanceOf(owner, { from: owner });
    assert.equal(ownerBalance.toNumber(), 0, 'Owner balance is not 0');
    const totalSupply = await token.totalSupply();
    assert.equal(totalSupply.toNumber(), 0, 'Total supply is not 0');
  });

  it('should do a timelocked transfer from the owner account', async () => {
    // Mint some tokens to timelock them
    const amount = 1000;
    const transaction = await token.mint(owner, amount);
    const { event, args } = transaction.logs[0];
    assert.equal(event, 'Transfer', 'Transfer event not emitted.');
    const { from, to, value } = args;
    assert.equal(web3.utils.hexToNumber(from), 0, 'from address is not the 0x0 address');
    assert.equal(to, owner, 'to address is not the owner address');
    assert.equal(value.toNumber(), amount, 'value is not the same as amount');
    const totalSupply = await token.totalSupply();
    assert.equal(amount, totalSupply.toNumber(), 'totalSupply is not equal to amount');
    const blockNumber = await web3.eth.getBlockNumber();
    const block = await web3.eth.getBlock(blockNumber);
    const lockedvalue = 10;
    const timelockTransaction = await token.timelockTransfer(user, lockedvalue, block.timestamp + 100, { from: owner });
    const { event: event2, args: args2 } = timelockTransaction.logs[0];
    assert.equal(event2, 'Transfer', 'Transfer event not emitted.');
    assert.equal(lockedvalue, args2.value, 'Locked value is not the same as emitted at Transfer');
  });

  it('should let a non-minter account to mint new tokens', async () => {
    // Mint some tokens to timelock them
    const blockNumber = await web3.eth.getBlockNumber();
    const block = await web3.eth.getBlock(blockNumber);
    const lockedvalue = 10;
    // from not owner account, the releaseDate is the timestamp of the last block plus 1 second
    const timelockTransaction = await token.timelockMint(user, lockedvalue, block.timestamp + 1, { from: user });
    const { event, args } = timelockTransaction.logs[0];
    const { from, to, value } = args;
    assert.equal(event, 'Transfer', 'Transfer event not emitted.');
    assert.equal(lockedvalue, value.toNumber(), 'Locked value is not the same as emitted at Transfer');
    assert.equal(web3.utils.hexToNumber(from), 0, 'from address is not the 0x0 address');
    // TokenTimelock address
    const contractAddress = to;
    const contractBalance = await token.balanceOf(contractAddress);
    assert.equal(lockedvalue, contractBalance, 'balance not equal to lockedvalue');
    // Retrieve the beneficiary. the TokenTimelock is going to store the value until the 'next block'
    const tokenTimelock = await TokenTimelock.at(contractAddress);
    const beneficiary = await tokenTimelock.beneficiary();
    assert.equal(user, beneficiary, 'Beneficiary is not the user');
    const userBalance = await token.balanceOf(user);
    assert.equal(userBalance.toNumber(), 0, 'userBalance should be 0 at first');
    await advanceTime(100);
    await mineBlock();
    await tokenTimelock.release({ from: user });
    const userBalance2 = await token.balanceOf(user);
    assert.equal(userBalance2.toNumber(), lockedvalue, 'userBalance should be the lockedValue');
  });
});

contract('Token Distributor', (accounts) => {
  let token;
  let tokenDistributor;

  beforeEach(async () => {
    // token = await Token.new({ value: web3.utils.toWei('1'), from: owner });
    token = await Token.new();
    tokenDistributor = await TokenDistributor.new(token.address);
  });

  const owner = accounts[0];
  const user = accounts[1];

  it('beneficiaries registered multiple times receives not expected amount of tokens at payment time', async () => {
    // Mint tokens and transfer to the TokenDistributor contract
    const amount = 100;
    await token.mint(tokenDistributor.address, amount);
    const tokenDistributorBalance = await token.balanceOf(tokenDistributor.address);
    assert.equal(tokenDistributorBalance, amount, 'Amount not minted and assigned to TokenDistributor contract');
    // Assign a beneficiary twice, for a total of 50
    await tokenDistributor.registerBeneficiary(user, 25);
    await tokenDistributor.registerBeneficiary(user, 25);
    // Pay the beneficiaries
    await tokenDistributor.payAllBeneficiaries();
    // Check the new balances for the 'user' and the TokenDistributor contract
    // The user balance is 100 because it was registered twice with a value of 25 each
    const newBalance = await token.balanceOf(tokenDistributor.address);
    assert.equal(newBalance, 0, 'The new balance is not 0');
    const userBalance = await token.balanceOf(user);
    assert.equal(userBalance, amount, 'userBalance is not the same as amount');
  });

  it('should reverse if the balance of the contract is not enough to pay to users', async () => {
    // Mint tokens and transfer to the TokenDistributor contract
    const amount = 50;
    await token.mint(tokenDistributor.address, amount);
    const tokenDistributorBalance = await token.balanceOf(tokenDistributor.address);
    assert.equal(tokenDistributorBalance, amount, 'Amount not minted and assigned to TokenDistributor contract');
    // Assign a beneficiary twice, for a total of 50
    // In a regular workflow, this would not be expected to fail, because the contract have enough balance (2*25=50)
    // But this is supposed to fail, because the contract is going to try to transfer 50 tokens
    // 2 times, so it would revert.
    await tokenDistributor.registerBeneficiary(user, 25);
    await tokenDistributor.registerBeneficiary(user, 25);
    // Pay the beneficiaries, and expect an exception
    await catchRevert(tokenDistributor.payAllBeneficiaries());
    // Check the new balances for the 'user' and the TokenDistributor contract
    // Is expected to not have any changes
    const newBalance = await token.balanceOf(tokenDistributor.address);
    assert.equal(newBalance, amount, 'The new balance is not 0');
    const userBalance = await token.balanceOf(user);
    assert.equal(userBalance, 0, 'userBalance is not the same as amount');
  });

  it('any beneficiary can withdraw the amount assigned to them until contract balanace is 0', async () => {
    // Mint tokens and transfer to the TokenDistributor contract
    const amount = 100;
    await token.mint(tokenDistributor.address, amount);
    const tokenDistributorBalance = await token.balanceOf(tokenDistributor.address);
    assert.equal(tokenDistributorBalance, amount, 'Amount not minted and assigned to TokenDistributor contract');
    // Assign a beneficiary for a total of 25
    await tokenDistributor.registerBeneficiary(user, 25);
    // Current balance of user should be 0
    const userBalance = await token.balanceOf(user);
    assert.equal(userBalance, 0, 'initial user balance should be 0');
    // Beneficiary calls _paySingleBeneficiary and it balance should be 25, and the contract balance should be 100-25=75
    await tokenDistributor._paySingleBeneficiary(user, { from: user });
    const newUserBalance = await token.balanceOf(user);
    const newContractBalance = await token.balanceOf(tokenDistributor.address);
    assert.equal(newUserBalance, 25, 'user balance was not updated');
    assert.equal(newContractBalance, 75, 'contract balance was not updated');
    // Beneficiary calls _paySingleBeneficiary again, and balances should have to change
    await tokenDistributor._paySingleBeneficiary(user, { from: user });
    const newUserBalance2 = await token.balanceOf(user);
    const newContractBalance2 = await token.balanceOf(tokenDistributor.address);
    assert.equal(newUserBalance2, 50, 'user balance was not updated');
    assert.equal(newContractBalance2, 50, 'contract balance was not updated');
    // Beneficiary calls _paySingleBeneficiary again, and balances should have to change
    await tokenDistributor._paySingleBeneficiary(user, { from: user });
    const newUserBalance3 = await token.balanceOf(user);
    const newContractBalance3 = await token.balanceOf(tokenDistributor.address);
    assert.equal(newUserBalance3, 75, 'user balance was not updated');
    assert.equal(newContractBalance3, 25, 'contract balance was not updated');
    // Beneficiary calls _paySingleBeneficiary again, and balances should have to change
    // At this point the user owns all the tokens and the contract balance was emptied
    await tokenDistributor._paySingleBeneficiary(user, { from: user });
    const newUserBalance4 = await token.balanceOf(user);
    const newContractBalance4 = await token.balanceOf(tokenDistributor.address);
    assert.equal(newUserBalance4, 100, 'user balance was not updated');
    assert.equal(newContractBalance4, 0, 'contract balance was not updated');
  });
});
