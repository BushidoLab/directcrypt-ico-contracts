pragma solidity ^0.4.11;

import "./Haltable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./DirectCryptToken.sol";
import "./InvestorWhiteList.sol";
import "./abstract/PriceReceiver.sol";


contract DirectCryptTokenPreSale is Haltable, PriceReceiver {
  using SafeMath for uint;

  string public constant name = "Direct Crypt Token PreSale";

  uint public VOLUME_70 = 20.00 ether;
  uint public VOLUME_60 = 10.00 ether;
  uint public VOLUME_50 = 1.00 ether;
  uint public VOLUME_25 = 0.01 ether;
  uint public VOLUME_05 = 0.001 ether;

  DirectCryptToken public token;
  InvestorWhiteList public investorWhiteList;

  address public beneficiary;

  uint public hardCap;
  uint public softCap;

  uint public ethUsdRate;

  uint public tokenPriceUsd;
  uint public totalTokens;//in wei

  uint public collected = 0;
  uint public tokensSold = 0;
  uint public investorCount = 0;
  uint public weiRefunded = 0;

  uint public startTime;
  uint public endTime;

  bool public softCapReached = false;
  bool public crowdsaleFinished = false;

  mapping (address => bool) refunded;
  mapping (address => uint) public deposited;

  event SoftCapReached(uint softCap);
  event NewContribution(address indexed holder, uint tokenAmount, uint etherAmount);
  event Refunded(address indexed holder, uint amount);
  event Deposited(address indexed holder, uint amount);
  event Amount(uint amount);
  event Timestamp(uint time);

  modifier preSaleActive() {
    require(now >= startTime && now < endTime);
    _;
  }

  modifier preSaleEnded() {
    require(now >= endTime);
    _;
  }

  modifier inWhiteList() {
    require(investorWhiteList.isAllowed(msg.sender));
    _;
  }

  function DirectCryptTokenPreSale(
    uint _hardCapETH,
    uint _softCapETH,

    address _token,
    address _beneficiary,
    address _investorWhiteList,

    uint _totalTokens,
    uint _tokenPriceUsd,

    uint _baseEthUsdPrice,

    uint _startTime,
    uint _endTime
  ) {
    ethUsdRate = _baseEthUsdPrice;
    tokenPriceUsd = _tokenPriceUsd;

    totalTokens = _totalTokens.mul(1 ether);

    hardCap = _hardCapETH.mul(1 ether);
    softCap = _softCapETH.mul(1 ether);

    token = DirectCryptToken(_token);
    investorWhiteList = InvestorWhiteList(_investorWhiteList);
    beneficiary = _beneficiary;

    startTime = _startTime;
    endTime = _endTime;
  }

  function() payable inWhiteList {
    doPurchase(msg.sender);
  }

  function refund() external preSaleEnded inNormalState {
    require(softCapReached == false);
    require(refunded[msg.sender] == false);

    uint refund = deposited[msg.sender];
    require(refund > 0);

    msg.sender.transfer(refund);
    deposited[msg.sender] = 0;
    refunded[msg.sender] = true;
    weiRefunded = weiRefunded.add(refund);
    Refunded(msg.sender, refund);
  }

  function withdraw() external onlyOwner {
    require(softCapReached);
    beneficiary.transfer(collected);
    token.transfer(beneficiary, token.balanceOf(this));
    crowdsaleFinished = true;
  }

  function receiveEthPrice(uint ethUsdPrice) external onlyEthPriceProvider {
    require(ethUsdPrice > 0);
    ethUsdRate = ethUsdPrice;
  }

  function setEthPriceProvider(address provider) external onlyOwner {
    require(provider != 0x0);
    ethPriceProvider = provider;
  }

  function setNewWhiteList(address newWhiteList) external onlyOwner {
    require(newWhiteList != 0x0);
    investorWhiteList = InvestorWhiteList(newWhiteList);
  }

  function doPurchase(address _owner) private preSaleActive inNormalState {
    require(!crowdsaleFinished);
    require(collected.add(msg.value) <= hardCap);
    require(totalTokens >= tokensSold + msg.value.mul(ethUsdRate).div(tokenPriceUsd));

    if (!softCapReached && collected < softCap && collected.add(msg.value) >= softCap) {
      softCapReached = true;
      SoftCapReached(softCap);
    }

    uint tokens = msg.value.mul(ethUsdRate).div(tokenPriceUsd);
    uint bonus = calculateBonus(msg.value);
    
    if (bonus > 0) {
      tokens = tokens + tokens.mul(bonus).div(100);
    }

    if (token.balanceOf(msg.sender) == 0) investorCount++;

    collected = collected.add(msg.value);

    token.transfer(msg.sender, tokens);

    tokensSold = tokensSold.add(tokens);
    deposited[msg.sender] = deposited[msg.sender].add(msg.value);
    
    NewContribution(_owner, tokens, msg.value);
  }

  function calculateBonus(uint value) private returns (uint bonus) {
    if (value >= VOLUME_70) {
      return 70;
    } else if (value >= VOLUME_60) {
      return 60;
    } else if (value >= VOLUME_50) {
      return 50;
    } else if (value >= VOLUME_25) {
      return 25;
    } else if (value >= VOLUME_05) {
      return 5;
    }

    return 0;
  }
}
