// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

// 添加学术NFT接口，用于检查资源所有权
interface IAcademicNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract AccessToken is ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // 学术NFT合约
    IAcademicNFT public academicNFT;

    // 访问权类型
    enum AccessType { Read, Write, Full }
    
    // 访问权元数据结构
    struct AccessMetadata {
        uint256 resourceId;      // 关联的资源ID
        AccessType accessType;   // 访问类型
        uint256 expiryTime;      // 过期时间
        uint256 maxUses;         // 最大使用次数
        uint256 usedCount;       // 已使用次数
        bool isActive;           // 是否激活
    }

    // 资源访问权配置
    struct ResourceAccessConfig {
        uint256 maxAccessTokens;     // 最大访问权数量
        uint256 currentAccessTokens; // 当前已发行的访问权数量
        uint256 price;               // 访问权价格
        bool isActive;               // 是否允许发行访问权
    }

    // 访问权元数据映射
    mapping(uint256 => AccessMetadata) private _accessMetadata;
    
    // 资源访问权配置映射
    mapping(uint256 => ResourceAccessConfig) private _resourceConfigs;
    
    // 用户拥有的访问权映射
    mapping(address => uint256[]) private _userAccessTokens;

    // 事件
    event AccessTokenMinted(
        uint256 indexed tokenId,
        uint256 indexed resourceId,
        address indexed owner,
        AccessType accessType,
        uint256 expiryTime,
        uint256 maxUses
    );
    
    event AccessTokenBurned(
        uint256 indexed tokenId,
        uint256 indexed resourceId,
        address indexed owner
    );
    
    event AccessTokenUsed(
        uint256 indexed tokenId,
        uint256 indexed resourceId,
        address indexed user
    );
    
    event ResourceAccessConfigUpdated(
        uint256 indexed resourceId,
        uint256 maxAccessTokens,
        uint256 price,
        bool isActive
    );

    constructor(address _academicNFT) ERC721("Resource Access Token", "RAT") {
        require(_academicNFT != address(0), "Invalid Academic NFT address");
        academicNFT = IAcademicNFT(_academicNFT);
    }

    // 设置资源访问权配置
    // 修改为允许资源所有者设置配置
    function setResourceAccessConfig(
        uint256 resourceId,
        uint256 maxAccessTokens,
        uint256 price,
        bool isActive
    ) external {
        // 检查调用者是否为资源所有者或合约所有者
        address resourceOwner;
        try academicNFT.ownerOf(resourceId) returns (address owner) {
            resourceOwner = owner;
        } catch {
            // 如果查询失败（例如资源不存在），则要求调用者是合约所有者
            require(owner() == msg.sender, "Not resource owner or contract owner");
            resourceOwner = owner();
        }
        
        // 允许资源所有者或合约所有者设置配置
        require(
            resourceOwner == msg.sender || owner() == msg.sender,
            "Not resource owner or contract owner"
        );
        
        require(maxAccessTokens > 0, "Max access tokens must be greater than 0");
        require(price > 0, "Price must be greater than 0");

        _resourceConfigs[resourceId] = ResourceAccessConfig({
            maxAccessTokens: maxAccessTokens,
            currentAccessTokens: _resourceConfigs[resourceId].currentAccessTokens,
            price: price,
            isActive: isActive
        });

        emit ResourceAccessConfigUpdated(resourceId, maxAccessTokens, price, isActive);
    }

    // 铸造访问权
    function mintAccessToken(
        uint256 resourceId,
        AccessType accessType,
        uint256 duration,
        uint256 maxUses
    ) external returns (uint256) {
        // 检查调用者是否为Market合约
        require(msg.sender == owner(), "Only market contract can mint");

        // 检查资源配置
        ResourceAccessConfig storage config = _resourceConfigs[resourceId];
        require(config.isActive, "Resource access not active");
        require(config.currentAccessTokens < config.maxAccessTokens, "Max access tokens reached");
        require(maxUses > 0, "Max uses must be greater than 0");
        require(duration > 0, "Duration must be greater than 0");

        // 检查资源是否存在
        try academicNFT.ownerOf(resourceId) returns (address) {
            // 资源存在，继续处理
        } catch {
            revert("Resource does not exist");
        }

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _mint(tx.origin, newTokenId);
        
        _accessMetadata[newTokenId] = AccessMetadata({
            resourceId: resourceId,
            accessType: accessType,
            expiryTime: block.timestamp + duration,
            maxUses: maxUses,
            usedCount: 0,
            isActive: true
        });

        config.currentAccessTokens++;
        _userAccessTokens[tx.origin].push(newTokenId);

        emit AccessTokenMinted(
            newTokenId,
            resourceId,
            tx.origin,
            accessType,
            block.timestamp + duration,
            maxUses
        );

        return newTokenId;
    }

    // 使用访问权
    function useAccessToken(uint256 tokenId) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        
        AccessMetadata storage metadata = _accessMetadata[tokenId];
        require(metadata.isActive, "Token not active");
        require(block.timestamp <= metadata.expiryTime, "Token expired");
        require(metadata.usedCount < metadata.maxUses, "Max uses reached");

        metadata.usedCount++;
        
        emit AccessTokenUsed(tokenId, metadata.resourceId, msg.sender);
    }

    // 烧毁访问权
    function burnAccessToken(uint256 tokenId) external {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        
        AccessMetadata storage metadata = _accessMetadata[tokenId];
        require(metadata.isActive, "Token not active");

        metadata.isActive = false;
        _burn(tokenId);

        emit AccessTokenBurned(tokenId, metadata.resourceId, msg.sender);
    }

    // 获取访问权元数据
    function getAccessMetadata(uint256 tokenId) external view returns (
        uint256 resourceId,
        AccessType accessType,
        uint256 expiryTime,
        uint256 maxUses,
        uint256 usedCount,
        bool isActive
    ) {
        require(_exists(tokenId), "Token does not exist");
        AccessMetadata storage metadata = _accessMetadata[tokenId];
        
        return (
            metadata.resourceId,
            metadata.accessType,
            metadata.expiryTime,
            metadata.maxUses,
            metadata.usedCount,
            metadata.isActive
        );
    }

    // 获取资源访问权配置
    function getResourceAccessConfig(uint256 resourceId) external view returns (
        uint256 maxAccessTokens,
        uint256 currentAccessTokens,
        uint256 price,
        bool isActive
    ) {
        ResourceAccessConfig storage config = _resourceConfigs[resourceId];
        
        return (
            config.maxAccessTokens,
            config.currentAccessTokens,
            config.price,
            config.isActive
        );
    }

    // 获取用户的所有访问权
    function getUserAccessTokens(address user) external view returns (uint256[] memory) {
        return _userAccessTokens[user];
    }

    // 检查访问权是否有效
    function isAccessValid(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) return false;
        
        AccessMetadata storage metadata = _accessMetadata[tokenId];
        return metadata.isActive && 
               block.timestamp <= metadata.expiryTime && 
               metadata.usedCount < metadata.maxUses;
    }

    // 提取合约中的ETH
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // 设置学术NFT合约地址
    function setAcademicNFT(address _academicNFT) external onlyOwner {
        require(_academicNFT != address(0), "Invalid Academic NFT address");
        academicNFT = IAcademicNFT(_academicNFT);
    }
} 