import React, { useEffect, useState, useCallback } from "react";
import { useAccount, useContractRead } from "wagmi";
import { PLATFORM_TOKEN_ABI } from "../config/contracts";
import { blockchainConfig } from "../config/blockchain";
import { NFTService } from "../services/nftApi";
import { ethers } from "ethers";
import { useToast } from "../hooks/useToast";

const BalancePage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { showToast } = useToast();
  const [claimableReward, setClaimableReward] = useState<string>("0");
  const [levelInfo, setLevelInfo] = useState<{
    level: number;
    totalVolume: string;
    nextLevelThreshold: string;
    currentBonusRate: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const { data: balance, isLoading: isBalanceLoading } = useContractRead({
    address: blockchainConfig.contracts.platformToken.address as `0x${string}`,
    abi: PLATFORM_TOKEN_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  // 加载可领取奖励和等级信息
  const loadRewardInfo = useCallback(async () => {
    try {
      setIsLoading(true);

      // 获取可领取奖励
      const rewardResponse = await NFTService.getClaimableReward();
      if (rewardResponse.success && rewardResponse.data) {
        setClaimableReward(ethers.utils.formatEther(rewardResponse.data.reward));
      }

      // 获取等级信息
      const levelResponse = await NFTService.getCreatorLevelInfo();
      if (levelResponse.success && levelResponse.data) {
        setLevelInfo({
          level: Number(levelResponse.data.level),
          totalVolume: ethers.utils.formatEther(levelResponse.data.totalVolume),
          nextLevelThreshold: ethers.utils.formatEther(levelResponse.data.nextLevelThreshold),
          currentBonusRate: (Number(levelResponse.data.currentBonusRate) / 100).toString() + "%"
        });
      }
    } catch (err) {
      console.error('加载奖励信息失败:', err);
      showToast('加载奖励信息失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // 领取奖励
  const handleClaimReward = async () => {
    try {
      setIsClaiming(true);
      const response = await NFTService.claimPlatformToken();
      
      if (response.success) {
        showToast('领取奖励成功！', 'success');
        // 重新加载奖励信息
        await loadRewardInfo();
      } else {
        throw new Error(response.message || '领取失败');
      }
    } catch (error: any) {
      console.error('领取奖励失败:', error);
      showToast(error.message || '领取奖励失败', 'error');
    } finally {
      setIsClaiming(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadRewardInfo();
    }
  }, [isConnected, loadRewardInfo]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">平台代币</h1>
      
      {!isConnected ? (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
          <p>请先连接钱包</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 余额卡片 */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-700">当前余额</h2>
                {isBalanceLoading ? (
                  <p className="text-gray-500">加载中...</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-blue-600">
                      {balance ? ethers.utils.formatEther(balance.toString()) : "0.00"} PLT
                    </p>
                    {levelInfo && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">当前等级:</span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                          Level {levelInfo.level}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500">
                钱包地址: {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            </div>
          </div>

          {/* 奖励卡片 */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">可领取奖励</h2>
            {isLoading ? (
              <p className="text-gray-500">加载中...</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">可领取数量</span>
                  <span className="text-xl font-bold text-green-600">{claimableReward} PLT</span>
                </div>
                <button
                  onClick={handleClaimReward}
                  disabled={isClaiming || Number(claimableReward) <= 0}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                >
                  {isClaiming ? '领取中...' : '领取奖励'}
                </button>
              </div>
            )}
          </div>

          {/* 等级信息卡片 */}
          {levelInfo && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">创作者等级</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">总交易量</span>
                  <span className="text-gray-800">{levelInfo.totalVolume} ETH</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">当前奖励加成</span>
                  <span className="text-green-600">{levelInfo.currentBonusRate}</span>
                </div>
                {levelInfo.level < 5 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">升级所需交易量</span>
                    <span className="text-blue-600">{levelInfo.nextLevelThreshold} ETH</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BalancePage; 