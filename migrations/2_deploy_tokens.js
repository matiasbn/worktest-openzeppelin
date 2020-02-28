const Token = artifacts.require('Token');
const TokenDistributor = artifacts.require('TokenDistributor');

module.exports = (deployer) => {
  deployer.then(async () => {
    const token = await deployer.deploy(Token);
    const tokenDistributor = await deployer.deploy(TokenDistributor, token.address);
    // console.log(`Token contract address:${token.address}`);
    // console.log(`TokenDistributor contract address:${tokenDistributor.address}`);
  });
};
