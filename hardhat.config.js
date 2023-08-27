require("@nomicfoundation/hardhat-toolbox");


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  mocha: {
    timeout: 15 * 60 * 1000,
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 1337,
      // blockGasLimit: 7_600_000,
      // blockGasLimit: 7_600_000,
      // blockGasLimit: 3_921_460,
    },
    testnet: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      accounts: [process.env.TESTNET_ACCOUNT],
    },
    mainnet: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      accounts: [process.env.MAINNET_ACCOUNT],
    },
  },
};
