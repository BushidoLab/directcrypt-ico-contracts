const DirectCryptToken = artifacts.require("DirectCryptToken");
const DirectCryptTokenPreSale = artifacts.require("DirectCryptTokenPreSale");
const InvestorWhiteList = artifacts.require("InvestorWhiteList");

const assertJump = function(error) {
  assert.isAbove(error.message.search('VM Exception while processing transaction: revert'), -1, 'Invalid opcode error must be returned');
};

const hardCap = 100; //in ETH
const softCap = 30; //in ETH
const beneficiary = web3.eth.accounts[0];
const baseEthUsdPrice = 50000; //in cents
const baseBtcUsdPrice = 100000; //in cents
const ethPriceProvider = web3.eth.accounts[8];
const btcPriceProvider = web3.eth.accounts[7];
const tokenPriceUsd = 100; //in cents
const totalTokens = 30000; //NOT in wei, converted by contract

async function increaseTimestampBy(seconds) {
  const jsonrpc = '2.0';
  const id = 0;
  const send = (method, params = []) => web3.currentProvider.send({id, jsonrpc, method, params});
  await send('evm_increaseTime', [seconds]);
  await send('evm_mine');
}

contract('DirectCryptTokenPresale', function (accounts) {
  beforeEach(async function () {
    this.block = await web3.eth.getBlock(await web3.eth.blockNumber);
    this.startTime = this.block.timestamp;
    this.endTime = this.startTime + 3600 * 24;

    this.whiteList = await InvestorWhiteList.new();

    this.token = await DirectCryptToken.new();

    this.crowdsale = await DirectCryptTokenPreSale.new(
      hardCap,
      softCap,
      this.token.address,
      beneficiary,
      this.whiteList.address,

      totalTokens,
      tokenPriceUsd,

      baseEthUsdPrice,
      baseBtcUsdPrice,

      this.startTime,
      this.endTime
    );

    this.token.setTransferAgent(this.token.address, true);
    this.token.setTransferAgent(this.crowdsale.address, true);
    this.token.setTransferAgent(accounts[0], true);

    await this.crowdsale.setEthPriceProvider(ethPriceProvider);
    await this.crowdsale.setBtcPriceProvider(btcPriceProvider);

    //transfer more than totalTokens to test hardcap reach properly
    this.token.transfer(this.crowdsale.address, web3.toWei(totalTokens, "ether"));
  });

  it('should allow to halt by owner', async function () {
    await this.crowdsale.halt();

    const halted = await this.crowdsale.halted();

    assert.equal(halted, true);
  });

  it('should not allow to halt by not owner', async function () {
    try {
      await this.crowdsale.halt({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to halt if already halted', async function () {
    await this.crowdsale.halt();

    try {
      await this.crowdsale.halt();
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to unhalt by owner', async function () {
    await this.crowdsale.halt();

    await this.crowdsale.unhalt();
    const halted = await this.crowdsale.halted();

    assert.equal(halted, false);
  });

  it('should not allow to unhalt when not halted', async function () {
    try {
      await this.crowdsale.unhalt();
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to unhalt by not owner', async function () {
    await this.crowdsale.halt();

    try {
      await this.crowdsale.unhalt({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to update ETH price by ETH price provider', async function () {
    await this.crowdsale.receiveEthPrice(25000, {from: ethPriceProvider});

    const ethUsdRate = await this.crowdsale.ethUsdRate();

    assert.equal(ethUsdRate, 25000);
  });

  it('should allow to update BTC price by BTC price provider', async function () {
    await this.crowdsale.receiveBtcPrice(420000, {from: btcPriceProvider});

    const btcUsdRate = await this.crowdsale.btcUsdRate();

    assert.equal(btcUsdRate, 420000);
  });

  it('should not allow to update ETH price by not ETH price provider', async function () {
    try {
      await this.crowdsale.receiveEthPrice(25000, {from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to update BTC price by not BTC price provider', async function () {
    try {
      await this.crowdsale.receiveBtcPrice(420000, {from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow to set BTC price provider by owner', async function () {
    await this.crowdsale.setBtcPriceProvider(accounts[2], {from: accounts[0]});

    const newPriceProvider = await this.crowdsale.btcPriceProvider();

    assert.equal(accounts[2], newPriceProvider);
  });

  it('should allow to set ETH price provider by owner', async function () {
    await this.crowdsale.setEthPriceProvider(accounts[2], {from: accounts[0]});

    const newPriceProvider = await this.crowdsale.ethPriceProvider();

    assert.equal(accounts[2], newPriceProvider);
  });

  it('should not allow to set BTC price provider by not owner', async function () {
    try {
      await this.crowdsale.setBtcPriceProvider(accounts[2], {from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to set ETH price provider by not owner', async function () {
    try {
      await this.crowdsale.setEthPriceProvider(accounts[2], {from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to update eth price with zero value', async function () {
    try {
      await this.crowdsale.receiveEthPrice(0, {from: ethPriceProvider});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to update btc price with zero value', async function () {
    try {
      await this.crowdsale.receiveBtcPrice(0, {from: btcPriceProvider});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to set new whitelist with zero value', async function () {
    try {
      await this.crowdsale.setNewWhiteList(0x0);
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to set new whitelist by not owner', async function () {
    try {
      await this.crowdsale.setNewWhiteList(0x0, { from: accounts[1] });
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should set new whitelist', async function () {
    const newWhiteList = await InvestorWhiteList.new();
    await this.crowdsale.setNewWhiteList(newWhiteList.address);

    const actual = await this.crowdsale.investorWhiteList();
    assert.equal(newWhiteList.address, actual);
  });

  it('should send tokens to purchaser', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 0.0001 * 10 ** 18, from: accounts[2]});

    const balance = await this.token.balanceOf(accounts[2]);
    assert.equal(balance.valueOf(), 0.05 * 10 ** 18);

    const crowdsaleBalance = await this.token.balanceOf(this.crowdsale.address);
    assert.equal(crowdsaleBalance.valueOf(), (totalTokens - 0.05) * 10 ** 18);

    const collected = await this.crowdsale.collected();
    assert.equal(collected.valueOf(), 0.0001 * 10 ** 18);

    const investorCount = await this.crowdsale.investorCount();
    assert.equal(investorCount, 1);

    const tokensSold = await this.crowdsale.tokensSold();
    assert.equal(tokensSold.valueOf(), 0.05 * 10 ** 18);
  });

  it('should send tokens to purchaser without bonus', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 0.0001 * 10 ** 18, from: accounts[2]});
    const balance = await this.token.balanceOf(accounts[2]);
    assert.equal(balance.valueOf(), 0.05 * 10**18);

    const crowdsaleBalance = await this.token.balanceOf(this.crowdsale.address);
    assert.equal(crowdsaleBalance.valueOf(), (totalTokens - 0.05) * 10 ** 18);

    const collected = await this.crowdsale.collected();
    assert.equal(collected.valueOf(), 0.0001 * 10 ** 18);

    const investorCount = await this.crowdsale.investorCount();
    assert.equal(investorCount, 1);
    
    const tokensSold = await this.crowdsale.tokensSold();
    assert.equal(tokensSold.valueOf(), 0.05 * 10 ** 18);
  });

  it('should send tokens to purchaser with 5% bonus', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 0.001 * 10 ** 18, from: accounts[2]});
    const balance = await this.token.balanceOf(accounts[2]);
    assert(balance.eq(web3.toBigNumber('525000000000000000')), 'Balance: account[2]', balance);

    const crowdsaleBalance = await this.token.balanceOf(this.crowdsale.address);
    assert(crowdsaleBalance.eq(web3.toBigNumber(totalTokens - 0.525).times(10 ** 18)), 'Balance: crowdsale', crowdsaleBalance);

    const collected = await this.crowdsale.collected();
    assert(collected.eq(0.001 * 10 ** 18), 'Collected:', collected);

    const investorCount = await this.crowdsale.investorCount();
    assert.equal(investorCount, 1);
    
    const tokensSold = await this.crowdsale.tokensSold();
    assert(tokensSold.eq('525000000000000000'), 'TokenSold:', tokensSold);
  });

  it('should send tokens to purchaser with 25% bonus', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    const tokens = 0.01 * baseEthUsdPrice / tokenPriceUsd;

    await this.crowdsale.sendTransaction({value: 0.01 * 10 ** 18, from: accounts[2]});
    const balance = await this.token.balanceOf(accounts[2]);
    assert(balance.eq(web3.toBigNumber(tokens).plus(tokens * 0.25).times(10**18)), 'Balance: account[2]', balance);

    const crowdsaleBalance = await this.token.balanceOf(this.crowdsale.address);
    assert(crowdsaleBalance.eq(web3.toBigNumber(totalTokens).minus(web3.toBigNumber(tokens).plus(tokens * 0.25)).times(10 ** 18)), 'Balance: crowdsale', crowdsaleBalance);

    const collected = await this.crowdsale.collected();
    assert(collected.eq(0.01 * 10 ** 18), 'Collected:', collected);

    const investorCount = await this.crowdsale.investorCount();
    assert.equal(investorCount, 1);
    
    const tokensSold = await this.crowdsale.tokensSold();
    assert(tokensSold.eq(web3.toBigNumber(tokens).plus(tokens * 0.25).times(10**18)), 'TokenSold:', tokensSold);
  });

  it('should send tokens to purchaser with 50% bonus', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    const tokens = 1 * baseEthUsdPrice / tokenPriceUsd;

    await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[2]});
    const balance = await this.token.balanceOf(accounts[2]);
    assert(balance.eq(web3.toBigNumber(tokens).plus(tokens * 0.50).times(10**18)), 'Balance: account[2]', balance);

    const crowdsaleBalance = await this.token.balanceOf(this.crowdsale.address);
    assert(crowdsaleBalance.eq(web3.toBigNumber(totalTokens).minus(web3.toBigNumber(tokens).plus(tokens * 0.50)).times(10 ** 18)), 'Balance: crowdsale', crowdsaleBalance);

    const collected = await this.crowdsale.collected();
    assert(collected.eq(1 * 10 ** 18), 'Collected:', collected);

    const investorCount = await this.crowdsale.investorCount();
    assert.equal(investorCount, 1);
    
    const tokensSold = await this.crowdsale.tokensSold();
    assert(tokensSold.eq(web3.toBigNumber(tokens).plus(tokens * 0.50).times(10**18)), 'TokenSold:', tokensSold);
  });

  it('should send tokens to purchaser with 60% bonus', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    const tokens = 10 * baseEthUsdPrice / tokenPriceUsd;

    await this.crowdsale.sendTransaction({value: 10 * 10 ** 18, from: accounts[2]});
    const balance = await this.token.balanceOf(accounts[2]);
    assert(balance.eq(web3.toBigNumber(tokens).plus(tokens * 0.60).times(10**18)), 'Balance: account[2]', balance);

    const crowdsaleBalance = await this.token.balanceOf(this.crowdsale.address);
    assert(crowdsaleBalance.eq(web3.toBigNumber(totalTokens).minus(web3.toBigNumber(tokens).plus(tokens * 0.60)).times(10 ** 18)), 'Balance: crowdsale', crowdsaleBalance);

    const collected = await this.crowdsale.collected();
    assert(collected.eq(10 * 10 ** 18), 'Collected:', collected);

    const investorCount = await this.crowdsale.investorCount();
    assert.equal(investorCount, 1);
    
    const tokensSold = await this.crowdsale.tokensSold();
    assert(tokensSold.eq(web3.toBigNumber(tokens).plus(tokens * 0.60).times(10**18)), 'TokenSold:', tokensSold);
  });

  it('should send tokens to purchaser with 70% bonus', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    const tokens = 20 * baseEthUsdPrice / tokenPriceUsd;

    await this.crowdsale.sendTransaction({value: 20 * 10 ** 18, from: accounts[2]});
    const balance = await this.token.balanceOf(accounts[2]);
    assert(balance.eq(web3.toBigNumber(tokens).plus(tokens * 0.70).times(10**18)), 'Balance: account[2]', balance);

    const crowdsaleBalance = await this.token.balanceOf(this.crowdsale.address);
    assert(crowdsaleBalance.eq(web3.toBigNumber(totalTokens).minus(web3.toBigNumber(tokens).plus(tokens * 0.70)).times(10 ** 18)), 'Balance: crowdsale', crowdsaleBalance);

    const collected = await this.crowdsale.collected();
    assert(collected.eq(20 * 10 ** 18), 'Collected:', collected);

    const investorCount = await this.crowdsale.investorCount();
    assert.equal(investorCount, 1);
    
    const tokensSold = await this.crowdsale.tokensSold();
    assert(tokensSold.eq(web3.toBigNumber(tokens).plus(tokens * 0.70).times(10**18)), 'TokenSold:', tokensSold);
  });

  it('should not allow purchase when pre sale is halted', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.halt();

    try {
      await this.crowdsale.sendTransaction({value: 0.11 * 10 ** 18, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to exceed purchase limit token', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    const amount = tokenPriceUsd/baseEthUsdPrice * (totalTokens + 1) * 10 ** 18;

    try {
      await this.crowdsale.sendTransaction({value: amount, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should set flag when softcap is reached', async function () {
    
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 30 * 10 ** 18, from: accounts[1]});

    const softCapReached = await this.crowdsale.softCapReached();
    assert.equal(softCapReached, true);
  });

  it('should not allow purchase after withdraw', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 15 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 15 * 10 ** 18, from: accounts[2]});
    await this.crowdsale.withdraw();

    try {
      await this.crowdsale.sendTransaction({value: 0.11 * 10 ** 18, from: accounts[3]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow to exceed hard cap', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[2]});

    try {
      await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[4]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should allow withdraw only for owner', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[2]});

    try {
      await this.crowdsale.withdraw({from: accounts[1]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow withdraw when softcap is not reached', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);

    await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[1]});

    try {
      await this.crowdsale.withdraw();
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should withdraw - send all not distributed tokens and collected ETH to beneficiary', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 15 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 15 * 10 ** 18, from: accounts[2]});

    const oldBenBalanceEth = await web3.eth.getBalance(beneficiary);
    const oldBenBalancePza = await this.token.balanceOf(beneficiary);

    await this.crowdsale.withdraw();

    const newBenBalanceEth = await web3.eth.getBalance(beneficiary);
    const newBenBalancePza = await this.token.balanceOf(beneficiary);

    const preSaleContractBalancePza = await this.token.balanceOf(this.crowdsale.address);
    const preSaleContractBalanceEth = await web3.eth.getBalance(this.crowdsale.address);

    assert.equal(newBenBalanceEth.gt(oldBenBalanceEth), true);
    assert.equal(newBenBalancePza.gt(oldBenBalancePza), true);
    assert.equal(preSaleContractBalancePza, 0);
    assert.equal(preSaleContractBalanceEth, 0);
  });

  it('should not allow purchase if pre sale is ended', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await increaseTimestampBy(3600*24);

    try {
      await this.crowdsale.sendTransaction({value: 0.1 * 10 ** 18, from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow refund if pre sale is not ended', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);

    await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[2]});

    try {
      await this.crowdsale.refund({from: accounts[2]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow refund if cap is reached', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);
    await this.whiteList.addInvestorToWhiteList(accounts[3]);

    await this.crowdsale.sendTransaction({value: 15 * 10 ** 18, from: accounts[1]});
    await this.crowdsale.sendTransaction({value: 15 * 10 ** 18, from: accounts[3]});

    await increaseTimestampBy(3600*24);

    try {
      await this.crowdsale.refund({from: accounts[3]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should not allow refund if pre sale is halted', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[1]);

    await this.crowdsale.sendTransaction({value: 25 * 10 ** 18, from: accounts[1]});

    await increaseTimestampBy(3600*24);

    await this.crowdsale.halt();

    try {
      await this.crowdsale.refund({from: accounts[1]});
    } catch (error) {
      return assertJump(error);
    }
    assert.fail('should have thrown before');
  });

  it('should refund if cap is not reached and pre sale is ended', async function () {
    await this.whiteList.addInvestorToWhiteList(accounts[2]);
    
    await this.crowdsale.sendTransaction({value: 1 * 10 ** 18, from: accounts[2]});

    await increaseTimestampBy(3600*24);

    const balanceBefore = web3.eth.getBalance(accounts[2]);
    await this.crowdsale.refund({from: accounts[2]});

    const balanceAfter = web3.eth.getBalance(accounts[2]);
    assert.equal(balanceAfter > balanceBefore, true);

    const weiRefunded = await this.crowdsale.weiRefunded();
    assert.equal(weiRefunded, 1 * 10 ** 18);

    //should not refund 1 more time
    try {
      await this.crowdsale.refund({from: accounts[2]});
    } catch (error) {
     return assertJump(error);
    }
    assert.fail('should have thrown before');
  });
});