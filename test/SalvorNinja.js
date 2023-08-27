const {
  loadFixture,
  setBalance,
} = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');
const { expect } = require('chai');


const { formatEther, parseEther, provider, ZeroAddress } = ethers;

describe('SalvorNinja', () => {
  const deployFixture = async () => {
    const [owner, addr1, addr2, devFund, rewardsFund] = await ethers.getSigners();

    const devFundPercentage = 90;
    const rewardsFundPercentage = 10;

    const payments = await ethers.deployContract(
      'Payments',
      [[devFund.address, rewardsFund.address], [devFundPercentage, rewardsFundPercentage]],
    );
    const salvorNinja = await ethers.deployContract('SalvorNinja', [await payments.getAddress()]);

    const subscriptionPrice = parseFloat(formatEther(await salvorNinja.subscriptionPrice()));
    const sniperCreditsPrice = parseFloat(formatEther(await salvorNinja.sniperCreditsPrice()));

    return { addr1, addr2 , devFund, devFundPercentage, owner, payments, rewardsFund, rewardsFundPercentage, salvorNinja, sniperCreditsPrice, subscriptionPrice };
  }

  describe('Payments deployment', () => {
    it.skip('Should set the right owner', async () => {
      const { owner, payments } = await loadFixture(deployFixture);

      // console.log(payments)
      console.log(payments.signer)
      expect(await payments.owner()).to.equal(owner.address);
    });

    it('Should set the right addresses and shares', async () => {
      const { devFund, devFundPercentage, payments, rewardsFund, rewardsFundPercentage } = await loadFixture(deployFixture);

      expect(await payments.payee(0)).to.equal(devFund.address);
      expect(await payments.payee(1)).to.equal(rewardsFund.address);

      expect(await payments.shares(devFund.address)).to.equal(devFundPercentage);
      expect(await payments.shares(rewardsFund.address)).to.equal(rewardsFundPercentage);
    });
  });

  describe('SalvorNinja deployment', () => {
    it('Should set the right owner', async () => {
      const { salvorNinja, owner } = await loadFixture(deployFixture);

      expect(await salvorNinja.owner()).to.equal(owner.address);
    });

    it('Should set the right payment processor address', async () => {
      const { payments, salvorNinja } = await loadFixture(deployFixture);

      expect(await salvorNinja.payments()).to.equal(await payments.getAddress());
    });
  });

  describe('Pausing', () => {
    it('Should be un/pausable by owner', async () => {
      const { salvorNinja, addr1, rewardsFund, subscriptionPrice, sniperCreditsPrice } = await loadFixture(deployFixture);

      await expect(salvorNinja.pause()).to.be.ok;
      await expect(salvorNinja.connect(addr1).subscribe(1, { value: parseEther(subscriptionPrice.toString()) }))
        .to.be.revertedWith('Pausable: paused');
      await expect(salvorNinja.connect(addr1).getSniperCredits(1, { value: parseEther(subscriptionPrice.toString()) }))
        .to.be.revertedWith('Pausable: paused');
      await expect(salvorNinja.connect(rewardsFund).distributeRewards(addr1.address, { value: 1 }))
        .to.be.revertedWith('Pausable: paused');

      await expect(salvorNinja.unpause()).to.be.ok;
      await expect(salvorNinja.connect(addr1).subscribe(1, { value: parseEther(subscriptionPrice.toString()) }))
        .to.be.ok
      await expect(salvorNinja.connect(addr1).getSniperCredits(1, { value: parseEther(sniperCreditsPrice.toString()) }))
        .to.be.ok
    });

    it('Should not be un/pausable publicly', async () => {
      const { salvorNinja, addr1 } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).pause())
        .to.be.revertedWith('Ownable: caller is not the owner');
      await expect(salvorNinja.connect(addr1).unpause())
        .to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Payments', () => {
    it('Should split the funds after subscription', async () => {
      const {
        salvorNinja,
        addr1,
        devFund,
        devFundPercentage,
        payments,
        rewardsFund,
        rewardsFundPercentage,
        subscriptionPrice,
      } = await loadFixture(deployFixture);

      const price = await salvorNinja.subscriptionPrice();
      const expectedDevFundReleasable = (formatEther(price) * (devFundPercentage / 100)).toFixed(2);
      const expectedRewardsFundReleasable = (formatEther(price) * (rewardsFundPercentage / 100)).toFixed(2);

      await salvorNinja.connect(addr1).subscribe(1, { value: parseEther(subscriptionPrice.toString()) });
      expect(await payments['releasable(address)'](devFund.address)).to.eq(parseEther(expectedDevFundReleasable));
      expect(await payments['releasable(address)'](rewardsFund.address)).to.eq(parseEther(expectedRewardsFundReleasable));
    });

    it('Should split the funds after purchasing credits', async () => {
      const {
        salvorNinja,
        addr1,
        devFund,
        devFundPercentage,
        payments,
        rewardsFund,
        rewardsFundPercentage,
        sniperCreditsPrice,
      } = await loadFixture(deployFixture);

      const price = await salvorNinja.sniperCreditsPrice();
      const expectedDevFundReleasable = (formatEther(price) * (devFundPercentage / 100)).toFixed(2);
      const expectedRewardsFundReleasable = (formatEther(price) * (rewardsFundPercentage / 100)).toFixed(2);

      await salvorNinja.connect(addr1).getSniperCredits(1, { value: parseEther(sniperCreditsPrice.toString()) });
      expect(await payments['releasable(address)'](devFund.address)).to.eq(parseEther(expectedDevFundReleasable));
      expect(await payments['releasable(address)'](rewardsFund.address)).to.eq(parseEther(expectedRewardsFundReleasable));
    });

    it('Should be distributed to proper addresses in defined proportions', async () => {
      const {
        salvorNinja,
        addr1,
        devFund,
        devFundPercentage,
        payments,
        rewardsFund,
        rewardsFundPercentage,
        subscriptionPrice,
      } = await loadFixture(deployFixture);

      // Reset payees' balances
      await setBalance(devFund.address, 0);
      await setBalance(rewardsFund.address, 0);

      const price = await salvorNinja.subscriptionPrice();
      const months = 10;
      const expectedDevFundReleasable = (formatEther(price) * months * (devFundPercentage / 100)).toFixed(2);
      const expectedRewardsFundReleasable = (formatEther(price) * months * (rewardsFundPercentage / 100)).toFixed(2);

      await salvorNinja.connect(addr1).subscribe(months, { value: parseEther((subscriptionPrice * months).toString()) });

      expect(await payments['release(address)'](devFund.address)).to.be.ok;
      expect(await payments['release(address)'](rewardsFund.address)).to.be.ok;

      // Check releasable amounts
      expect(await payments['releasable(address)'](devFund.address)).to.eq(0);
      expect(await payments['releasable(address)'](rewardsFund.address)).to.eq(0);

      // Check payees' balances
      expect(await provider.getBalance(devFund.address)).to.eq(parseEther(expectedDevFundReleasable));
      expect(await provider.getBalance(rewardsFund.address)).to.eq(parseEther(expectedRewardsFundReleasable));
    });

    it('Should be able to extend subscription for more than 1 month', async () => {
      const { salvorNinja, addr1, subscriptionPrice } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).subscribe(6, { value: parseEther((6 * subscriptionPrice).toString()) }))
        .to.be.ok;
      await expect(salvorNinja.connect(addr1).subscribe(24, { value: parseEther((24 * subscriptionPrice).toString()) }))
        .to.be.ok;
    });

    it('Should be able to purchase multiple credits packs', async () => {
      const { salvorNinja, addr1, sniperCreditsPrice } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).getSniperCredits(6, { value: parseEther((6 * sniperCreditsPrice).toString()) }))
        .to.be.ok;
      await expect(salvorNinja.connect(addr1).getSniperCredits(50, { value: parseEther((50 * sniperCreditsPrice).toString()) }))
        .to.be.ok;
    });

    it('Should fail for incorrect subscription price', async () => {
      const { salvorNinja, addr1 } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).subscribe(1, { value: 1 }))
        .to.be.revertedWith('Invalid amount');
    });

    it('Should fail for incorrect credits price', async () => {
      const { salvorNinja, addr1 } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).getSniperCredits(1, { value: 1 }))
        .to.be.revertedWith('Invalid amount');
    });

    it('Should fail for zero values', async () => {
      const { salvorNinja, addr1 } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).subscribe(0, { value: 0 }))
        .to.be.revertedWith('Invalid parameter');

      await expect(salvorNinja.connect(addr1).getSniperCredits(0, { value: 0 }))
        .to.be.revertedWith('Invalid parameter');
    });
  });

  describe('Payments Splitter', () => {
    it('Should be modifiable by owner', async () => {
      const {
        salvorNinja,
        addr1,
        devFund,
        rewardsFund,
        subscriptionPrice,
      } = await loadFixture(deployFixture);

      // Deploy Payments v2 contract with different percentages
      const devFundPercentage = 60;
      const rewardsFundPercentage = 40;
      const payments = await ethers.deployContract(
        'Payments',
        [[devFund.address, rewardsFund.address], [devFundPercentage, rewardsFundPercentage]],
      );

      // Set Payments v2 contract address
      await salvorNinja.setPaymentsContract(await payments.getAddress());

      // Check newly set Payments address
      expect(await salvorNinja.payments()).to.equal(await payments.getAddress());

      // Reset payees' balances
      await setBalance(devFund.address, 0);
      await setBalance(rewardsFund.address, 0);

      const price = await salvorNinja.subscriptionPrice();
      const months = 10;
      const expectedDevFundReleasable = (formatEther(price) * months * (devFundPercentage / 100)).toFixed(2);
      const expectedRewardsFundReleasable = (formatEther(price) * months * (rewardsFundPercentage / 100)).toFixed(2);

      await salvorNinja.connect(addr1).subscribe(months, { value: parseEther((subscriptionPrice * months).toString()) });

      expect(await payments['release(address)'](devFund.address)).to.be.ok;
      expect(await payments['release(address)'](rewardsFund.address)).to.be.ok;

      // Check releasable amounts
      expect(await payments['releasable(address)'](devFund.address)).to.eq(0);
      expect(await payments['releasable(address)'](rewardsFund.address)).to.eq(0);

      // Check payees' balances
      expect(await provider.getBalance(devFund.address)).to.eq(parseEther(expectedDevFundReleasable));
      expect(await provider.getBalance(rewardsFund.address)).to.eq(parseEther(expectedRewardsFundReleasable));
    });

    it('Should not be publicly modifiable', async () => {
      const { addr1, payments, salvorNinja } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).setPaymentsContract(await payments.getAddress())).to.be.revertedWith('Ownable: caller is not the owner');
    });

  });

  describe('Rewards', () => {
    it('Should be able to set rewards address for owner', async () => {
      const { salvorNinja, rewardsFund } = await loadFixture(deployFixture);
      expect(await salvorNinja.setRewardsAddress(rewardsFund.address)).to.be.ok;
      expect(await salvorNinja.rewardsAddress()).to.eq(rewardsFund.address);
    });

    it('Should not be able to set rewards address publicly', async () => {
      const { salvorNinja, addr1, rewardsFund } = await loadFixture(deployFixture);
      await expect(salvorNinja.connect(addr1).setRewardsAddress(rewardsFund.address))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should be sendable by owner and correctly update amounts', async () => {
      const {
        salvorNinja,
        addr1,
        addr2,
        payments,
        rewardsFund,
        rewardsFundPercentage,
        subscriptionPrice,
      } = await loadFixture(deployFixture);

      const price = await salvorNinja.subscriptionPrice();
      const months = Math.floor(Math.random() * 10000);
      const expectedRewardsFundReleasable = (formatEther(price) * months * (rewardsFundPercentage / 100)).toFixed(2);
      const rewardAmount = Math.random() * 10;

      await setBalance(addr2.address, 0);
      await setBalance(rewardsFund.address, 0);

      // Set rewards address
      expect(await salvorNinja.setRewardsAddress(rewardsFund.address)).to.be.ok;

      // Purchase subscription
      expect(await salvorNinja.connect(addr1).subscribe(months, { value: parseEther((subscriptionPrice * months).toString()) }))
        .to.be.ok;

      // Release and check funds
      expect(await payments['release(address)'](rewardsFund.address)).to.be.ok;
      expect(await provider.getBalance(rewardsFund.address)).to.eq(parseEther(expectedRewardsFundReleasable));

      // Send reward to a different address
      const tx = await salvorNinja.connect(rewardsFund).distributeRewards(addr2.address, { value: parseEther(rewardAmount.toString()) });
      expect(tx).to.be.ok;

      const txReceipt = await provider.getTransactionReceipt(tx.hash);
      const gasAmount = parseFloat(formatEther(txReceipt.gasUsed * txReceipt.gasPrice));
      const remainingBalance = (parseFloat(expectedRewardsFundReleasable) - rewardAmount - gasAmount).toFixed(8);
      const rewardsFundBalance = await provider.getBalance(rewardsFund.address);

      // Check balances
      expect(await provider.getBalance(addr2.address)).to.eq(parseEther(rewardAmount.toString()));
      expect(parseFloat(formatEther(rewardsFundBalance)).toFixed(8)).to.eq(remainingBalance);
    });

    it('Should not be sendable if rewards address is not set', async () => {
      const {
        salvorNinja,
        addr1,
        rewardsFund,
      } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(rewardsFund).distributeRewards(addr1.address, { value: 1 }))
        .to.be.revertedWith('Invalid address');
    });

    it('Should not be sendable by non-rewards address', async () => {
      const {
        salvorNinja,
        addr1,
        owner,
        rewardsFund,
      } = await loadFixture(deployFixture);

      // Set rewards address
      expect(await salvorNinja.setRewardsAddress(rewardsFund.address)).to.be.ok;

      await expect(salvorNinja.connect(owner).distributeRewards(addr1.address, { value: 1 }))
        .to.be.revertedWith('Invalid address');
    });

    it('Should fail for incorrect address', async () => {
      const { salvorNinja, rewardsFund } = await loadFixture(deployFixture);

      // Set rewards address
      expect(await salvorNinja.setRewardsAddress(rewardsFund.address)).to.be.ok;

      await expect(salvorNinja.connect(rewardsFund).distributeRewards(ZeroAddress, { value: 1 }))
        .to.be.revertedWith('Invalid address');
    });

    it('Should fail for incorrect amount', async () => {
      const { salvorNinja, addr1, rewardsFund } = await loadFixture(deployFixture);

      // Set rewards address
      expect(await salvorNinja.setRewardsAddress(rewardsFund.address)).to.be.ok;

      await expect(salvorNinja.connect(rewardsFund).distributeRewards(addr1.address, { value: 0 }))
        .to.be.revertedWith('Invalid amount');
    });
  });

  describe('Prices', () => {
    it('Should be settable for subscription by owner', async () => {
      const { salvorNinja, addr1 } = await loadFixture(deployFixture);

      const newPrice = 0.5;
      expect(await salvorNinja.setSubscriptionPrice(parseEther(newPrice.toString()))).to.be.ok;
      expect(await salvorNinja.subscriptionPrice()).to.equal(parseEther(newPrice.toString()));
      await expect(salvorNinja.connect(addr1).subscribe(24, { value: parseEther((24 * newPrice).toString()) }))
        .to.be.ok;
    });

    it('Should be settable for credits by owner', async () => {
      const { salvorNinja, addr1 } = await loadFixture(deployFixture);

      const newPrice = 0.5;
      expect(await salvorNinja.setSniperCreditsPrice(parseEther(newPrice.toString()))).to.be.ok;
      expect(await salvorNinja.sniperCreditsPrice()).to.equal(parseEther(newPrice.toString()));
      await expect(salvorNinja.connect(addr1).getSniperCredits(50, { value: parseEther((50 * newPrice).toString()) }))
        .to.be.ok;
    });

    it('Should not be settable publicly', async () => {
      const { salvorNinja, addr1 } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).setSubscriptionPrice(parseEther('1')))
        .to.be.revertedWith('Ownable: caller is not the owner');

      await expect(salvorNinja.connect(addr1).setSniperCreditsPrice(parseEther('1')))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Events', () => {
    it('Should emit an event on subscription', async () => {
      const { salvorNinja, addr1, subscriptionPrice } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).subscribe(1, { value: parseEther(subscriptionPrice.toString()) }))
        .to.emit(salvorNinja, 'Subscription')
        .withArgs(addr1.address, 1, anyValue);
    });

    it('Should emit an event on purchasing snipe credits', async () => {
      const { salvorNinja, addr1, sniperCreditsPrice } = await loadFixture(deployFixture);

      await expect(salvorNinja.connect(addr1).getSniperCredits(1, { value: parseEther(sniperCreditsPrice.toString()) }))
        .to.emit(salvorNinja, 'SniperCredits')
        .withArgs(addr1.address, 1);
    });

    it('Should emit an event on sending rewards', async () => {
      const {
        salvorNinja,
        addr1,
        addr2,
        payments,
        rewardsFund,
        rewardsFundPercentage,
        subscriptionPrice,
      } = await loadFixture(deployFixture);

      const price = await salvorNinja.subscriptionPrice();
      const months = Math.floor(Math.random() * 10000);
      const expectedRewardsFundReleasable = (formatEther(price) * months * (rewardsFundPercentage / 100)).toFixed(2);
      const rewardAmount = Math.random() * 10;

      await setBalance(addr2.address, 0);
      await setBalance(rewardsFund.address, 0);

      // Set rewards address
      expect(await salvorNinja.setRewardsAddress(rewardsFund.address)).to.be.ok;

      // Purchase subscription
      expect(await salvorNinja.connect(addr1).subscribe(months, { value: parseEther((subscriptionPrice * months).toString()) }))
        .to.be.ok;

      // Release and check funds
      expect(await payments['release(address)'](rewardsFund.address)).to.be.ok;
      expect(await provider.getBalance(rewardsFund.address)).to.eq(parseEther(expectedRewardsFundReleasable));

      // Send reward
      await expect(salvorNinja.connect(rewardsFund).distributeRewards(addr2.address, { value: parseEther(rewardAmount.toString()) }))
        .to.emit(salvorNinja, 'SalvorNinjaRewardsDistribution')
        .withArgs(addr2.address);
    });
  });
});
