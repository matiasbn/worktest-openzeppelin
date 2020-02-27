const Token = artifacts.require('Token');
const TokenDistributor = artifacts.require('TokenDistributor');
const TokenTimelock = artifacts.require('TokenTimelock');

contract('Token', (accounts) => {
  let token;
  let tokenDistributor;

  beforeEach(async () => {
    // token = await Token.new({ value: web3.utils.toWei('1'), from: owner });
    token = await Token.new();
    tokenDistributor = await TokenDistributor.new(token.address);
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
    // wait until the next block
    let currentBlockNumber = blockNumber;
    while (blockNumber === currentBlockNumber) {
      currentBlockNumber = await web3.eth.getBlockNumber();
      console.log(currentBlockNumber);
    }
    console.log(currentBlockNumber);
    await tokenTimelock.release();
    const userBalance2 = await token.balanceOf(user);
    assert.equal(userBalance2.toNumber(), lockedvalue, 'userBalance should be 0 at first');
  });
});
