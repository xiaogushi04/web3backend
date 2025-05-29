// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PlatformToken is ERC20, Ownable {
    // 交易量奖励比例（以基点计算，1基点 = 0.01%）
    uint256 public constant REWARD_RATE = 50; // 0.5%
    
    // 最小交易量阈值（以wei为单位）
    uint256 public constant MIN_VOLUME_THRESHOLD = 0.1 ether;
    
    // 创作者地址到其总交易量的映射
    mapping(address => uint256) public creatorVolumes;
    
    // 创作者地址到其已领取奖励的映射
    mapping(address => uint256) public claimedRewards;
    
    // 创作者等级映射
    mapping(address => uint8) public creatorLevels;
    
    // 等级对应的额外奖励倍数（以基点计算，1基点 = 0.01%）
    mapping(uint8 => uint256) public levelBonusRates;
    
    // 等级升级所需交易量（以wei为单位）
    mapping(uint8 => uint256) public levelThresholds;
    
    // 事件
    event RewardClaimed(address indexed creator, uint256 amount);
    event CreatorLevelUp(address indexed creator, uint8 newLevel);
    event LevelBonusRateUpdated(uint8 level, uint256 newRate);
    event LevelThresholdUpdated(uint8 level, uint256 newThreshold);
    
    constructor() ERC20("Platform Token", "PLT") Ownable() {
        // 初始铸造1000000个代币给合约部署者
        _mint(msg.sender, 1000000 * 10 ** decimals());
        
        // 初始化等级奖励倍数
        levelBonusRates[1] = 0;    // 基础等级无额外奖励
        levelBonusRates[2] = 100;  // 2级额外1%
        levelBonusRates[3] = 300;  // 3级额外3%
        levelBonusRates[4] = 600;  // 4级额外6%
        levelBonusRates[5] = 1000; // 5级额外10%
        
        // 初始化等级阈值
        levelThresholds[1] = 0.1 ether;    // 1级：0.1 ETH
        levelThresholds[2] = 1 ether;      // 2级：1 ETH
        levelThresholds[3] = 5 ether;      // 3级：5 ETH
        levelThresholds[4] = 20 ether;     // 4级：20 ETH
        levelThresholds[5] = 50 ether;     // 5级：50 ETH
    }
    
    // 更新创作者交易量并计算奖励
    function updateCreatorVolume(address creator, uint256 volume) external onlyOwner {
        require(creator != address(0), "Invalid creator address");
        require(volume > 0, "Volume must be greater than 0");
        
        creatorVolumes[creator] += volume;
        
        // 检查是否需要升级
        _checkAndUpdateLevel(creator);
    }
    
    // 检查并更新创作者等级
    function _checkAndUpdateLevel(address creator) internal {
        uint256 totalVolume = creatorVolumes[creator];
        uint8 currentLevel = creatorLevels[creator];
        
        // 从最高等级开始检查
        for (uint8 level = 5; level > currentLevel; level--) {
            if (totalVolume >= levelThresholds[level]) {
                creatorLevels[creator] = level;
                emit CreatorLevelUp(creator, level);
                break;
            }
        }
    }
    
    // 计算创作者可领取的奖励
    function calculateReward(address creator) public view returns (uint256) {
        uint256 totalVolume = creatorVolumes[creator];
        if (totalVolume < MIN_VOLUME_THRESHOLD) {
            return 0;
        }
        
        // 基础奖励
        uint256 baseReward = (totalVolume * REWARD_RATE) / 10000;
        
        // 等级额外奖励
        uint8 level = creatorLevels[creator];
        uint256 bonusRate = levelBonusRates[level];
        uint256 bonusReward = (baseReward * bonusRate) / 10000;
        
        uint256 totalReward = baseReward + bonusReward;
        return totalReward - claimedRewards[creator];
    }
    
    // 领取奖励
    function claimReward() external {
        uint256 reward = calculateReward(msg.sender);
        require(reward > 0, "No reward available");
        
        claimedRewards[msg.sender] += reward;
        _mint(msg.sender, reward);
        
        emit RewardClaimed(msg.sender, reward);
    }
    
    // 更新等级奖励倍数（仅限所有者）
    function updateLevelBonusRate(uint8 level, uint256 newRate) external onlyOwner {
        require(level > 0 && level <= 5, "Invalid level");
        levelBonusRates[level] = newRate;
        emit LevelBonusRateUpdated(level, newRate);
    }
    
    // 更新等级阈值（仅限所有者）
    function updateLevelThreshold(uint8 level, uint256 newThreshold) external onlyOwner {
        require(level > 0 && level <= 5, "Invalid level");
        require(newThreshold > 0, "Invalid threshold");
        levelThresholds[level] = newThreshold;
        emit LevelThresholdUpdated(level, newThreshold);
    }
    
    // 获取创作者等级信息
    function getCreatorLevelInfo(address creator) external view returns (
        uint8 level,
        uint256 totalVolume,
        uint256 nextLevelThreshold,
        uint256 currentBonusRate
    ) {
        level = creatorLevels[creator];
        totalVolume = creatorVolumes[creator];
        currentBonusRate = levelBonusRates[level];
        
        if (level < 5) {
            nextLevelThreshold = levelThresholds[level + 1];
        } else {
            nextLevelThreshold = 0; // 已经是最高等级
        }
        
        return (level, totalVolume, nextLevelThreshold, currentBonusRate);
    }
} 