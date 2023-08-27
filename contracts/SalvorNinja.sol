// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";


contract SalvorNinja is Ownable, Pausable {
    address payable public payments;
    address payable public rewardsAddress;
    uint256 public subscriptionPrice = 1000000000 gwei;
    uint256 public sniperCreditsPrice = 100000000 gwei;

    event Subscription(address subscriber, uint256 months, uint256 timestamp);
    event SniperCredits(address subscriber, uint256 packs);
    event SalvorNinjaRewardsDistribution(address to);

    constructor(address _payments) {
        payments = payable(_payments);
    }

    function subscribe(uint256 months) public payable whenNotPaused {
        require(address(payments) != address(0), "Payments address not set");
        require(months > 0, "Invalid parameter");
        require(msg.value == (subscriptionPrice * months), "Invalid amount");
        (bool success,) = payable(payments).call{value: msg.value}("");
        require(success, "Payment processor error");
        emit Subscription(msg.sender, months, block.timestamp);
    }

    function getSniperCredits(uint256 packs) public payable whenNotPaused {
        require(address(payments) != address(0), "Payments address not set");
        require(packs > 0, "Invalid parameter");
        require(msg.value == (sniperCreditsPrice * packs), "Invalid amount");
        (bool success,) = payable(payments).call{value: msg.value}("");
        require(success, "Payment processor error");
        emit SniperCredits(msg.sender, packs);
    }

    function distributeRewards(address to) public payable whenNotPaused {
        require(address(msg.sender) == rewardsAddress, "Invalid address");
        require(address(to) != address(0), "Invalid address");
        require(msg.value > 0, "Invalid amount");
        (bool success,) = payable(to).call{value: msg.value}("");
        require(success, "Error while sending rewards");
        emit SalvorNinjaRewardsDistribution(to);
    }

    function setPaymentsContract(address contractAddress) public onlyOwner {
        payments = payable(contractAddress);
    }

    function setSubscriptionPrice(uint256 _price) public onlyOwner {
        subscriptionPrice = _price;
    }

    function setSniperCreditsPrice(uint256 _price) public onlyOwner {
        sniperCreditsPrice = _price;
    }

    function setRewardsAddress(address _address) public onlyOwner {
        rewardsAddress = payable(_address);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
