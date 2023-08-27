const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  const paymentsContractName = 'Payments';
  const salvorNinjaContractName = 'SalvorNinja';

  const devFundPercentage = 90;
  const rewardsFundPercentage = 10;
  let devFund;
  let rewardsFund;

  switch (process.env.HARDHAT_NETWORK) {
    case 'hardhat':
      devFund = '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E';
      rewardsFund = '0xdD2FD4581271e230360230F9337D5c0430Bf44C0';
      break;
    case 'testnet':
      devFund = '0x2a549e5f473212829d4000305f27529c1ccbab9a';
      rewardsFund = '0xec818dFb4653C8Bcf6Cf1a61a45B8d6ED7AFCFFa';
      break;
    case 'mainnet':
      devFund = '0x2a549e5f473212829d4000305f27529c1ccbab9a';
      rewardsFund = '';
      break;
  }

  console.log('Deploying contracts with the account:', deployer.address);
  console.log('Account balance:', (hre.ethers.formatEther(balance.toString())));

  const payments = await hre.ethers.deployContract(
    paymentsContractName,
    [[devFund, rewardsFund], [devFundPercentage, rewardsFundPercentage]],
  );
  await payments.waitForDeployment();
  const paymentAddress = await payments.getAddress();
  console.log(`${paymentsContractName} address`, paymentAddress);

  const salvorNinja = await hre.ethers.deployContract(salvorNinjaContractName, [paymentAddress]);
  await salvorNinja.waitForDeployment();
  const salvorNinjaAddress = await salvorNinja.getAddress();
  console.log(`${salvorNinjaContractName} address`, salvorNinjaAddress);

  console.log(`Verifying ${paymentsContractName}...`);
  await run('verify:verify', {
    address: paymentAddress,
    contract: `contracts/${paymentsContractName}.sol:${paymentsContractName}`,
    constructorArguments: [
      [devFund, rewardsFund],
      [devFundPercentage, rewardsFundPercentage],
    ],
  });

  console.log(`Verifying ${salvorNinjaContractName}...`);
  await run('verify:verify', {
    address: salvorNinjaAddress,
    contract: `contracts/${salvorNinjaContractName}.sol:${salvorNinjaContractName}`,
    constructorArguments: [paymentAddress],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
