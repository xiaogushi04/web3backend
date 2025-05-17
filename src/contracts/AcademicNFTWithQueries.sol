// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AcademicNFTWithQueries
 * @dev 增强版学术资源NFT合约，添加了有效的查询功能
 * 使用ERC721Enumerable扩展，支持高效的token枚举
 */
contract AcademicNFTWithQueries is ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    
    // Token ID 计数器
    Counters.Counter private _tokenIdCounter;
    
    // 资源类型枚举
    enum ResourceType { Paper, Dataset, Code, Other }
    
    // 资源元数据结构
    struct ResourceMetadata {
        string title;
        string description;
        string ipfsHash;
        ResourceType resourceType;
        address[] authors;
        uint256 timestamp;
    }
    
    // 引用记录结构
    struct Reference {
        uint256 sourceTokenId;
        uint256 targetTokenId;
        string description;
        uint256 timestamp;
    }
    
    // 市场列表结构
    struct Listing {
        address seller;
        uint256 price;
        bool isActive;
    }
    
    // 每个tokenId对应的元数据
    mapping(uint256 => ResourceMetadata) private _resourceMetadata;
    
    // 引用ID计数器
    Counters.Counter private _referenceIdCounter;
    
    // 引用记录
    mapping(uint256 => Reference) private _references;
    
    // 市场列表
    mapping(uint256 => Listing) private _listings;
    
    // 事件定义
    event ResourceMinted(address indexed owner, uint256 indexed tokenId);
    event ReferenceCreated(uint256 indexed referenceId, uint256 sourceTokenId, uint256 targetTokenId);
    event TokenListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event TokenSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    
    constructor() ERC721("AcademicResource", "ACAD") Ownable() {}
    
    /**
     * @dev 铸造新的学术资源NFT
     */
    function mintResource(
        address to,
        string memory title,
        string memory description,
        string memory ipfsHash,
        uint8 resourceType,
        address[] memory authors
    ) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(to, tokenId);
        
        _resourceMetadata[tokenId] = ResourceMetadata({
            title: title,
            description: description,
            ipfsHash: ipfsHash,
            resourceType: ResourceType(resourceType),
            authors: authors,
            timestamp: block.timestamp
        });
        
        emit ResourceMinted(to, tokenId);
        
        return tokenId;
    }
    
    /**
     * @dev 获取资源元数据
     */
    function getResourceMetadata(uint256 tokenId) public view returns (
        string memory title,
        string memory description,
        string memory ipfsHash,
        uint8 resourceType,
        address[] memory authors
    ) {
        _requireMinted(tokenId);
        ResourceMetadata storage metadata = _resourceMetadata[tokenId];
        
        return (
            metadata.title,
            metadata.description,
            metadata.ipfsHash,
            uint8(metadata.resourceType),
            metadata.authors
        );
    }
    
    /**
     * @dev 创建资源引用关系
     */
    function createReference(
        uint256 sourceTokenId,
        uint256 targetTokenId,
        string memory description
    ) public returns (uint256) {
        _requireMinted(sourceTokenId);
        _requireMinted(targetTokenId);
        
        uint256 referenceId = _referenceIdCounter.current();
        _referenceIdCounter.increment();
        
        _references[referenceId] = Reference({
            sourceTokenId: sourceTokenId,
            targetTokenId: targetTokenId,
            description: description,
            timestamp: block.timestamp
        });
        
        emit ReferenceCreated(referenceId, sourceTokenId, targetTokenId);
        
        return referenceId;
    }
    
    /**
     * @dev 获取引用详情
     */
    function getReference(uint256 referenceId) public view returns (
        uint256 sourceTokenId,
        uint256 targetTokenId,
        string memory description,
        uint256 timestamp
    ) {
        require(referenceId < _referenceIdCounter.current(), "Reference does not exist");
        Reference storage ref = _references[referenceId];
        
        return (
            ref.sourceTokenId,
            ref.targetTokenId,
            ref.description,
            ref.timestamp
        );
    }
    
    /**
     * @dev 上架NFT
     */
    function listToken(uint256 tokenId, uint256 price) public {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(price > 0, "Price must be greater than zero");
        
        _listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            isActive: true
        });
        
        emit TokenListed(tokenId, msg.sender, price);
    }
    
    /**
     * @dev 购买NFT
     */
    function buyToken(uint256 tokenId) public payable {
        Listing storage listing = _listings[tokenId];
        require(listing.isActive, "Token not for sale");
        require(msg.value >= listing.price, "Insufficient payment");
        
        address seller = listing.seller;
        uint256 price = listing.price;
        
        // 清除上架信息
        listing.isActive = false;
        
        // 转移NFT所有权
        _transfer(seller, msg.sender, tokenId);
        
        // 支付卖家
        payable(seller).transfer(price);
        
        // 如果买家支付了超过价格的金额，退回多余部分
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit TokenSold(tokenId, msg.sender, seller, price);
    }
    
    /**
     * @dev 获取上架信息
     */
    function getListing(uint256 tokenId) public view returns (
        address seller,
        uint256 price,
        bool isActive
    ) {
        _requireMinted(tokenId);
        Listing storage listing = _listings[tokenId];
        
        return (
            listing.seller,
            listing.price,
            listing.isActive
        );
    }
    
    /**
     * @dev 获取资源总数
     * 由ERC721Enumerable提供的新功能
     */
    function getResourceCount() public view returns (uint256) {
        return totalSupply();
    }
    
    /**
     * @dev 获取指定索引处的tokenId
     * 由ERC721Enumerable提供的新功能
     */
    function getTokenByIndex(uint256 index) public view returns (uint256) {
        return tokenByIndex(index);
    }
    
    /**
     * @dev 获取用户拥有的token数量 
     * 由ERC721Enumerable提供的新功能
     */
    function getUserTokenCount(address owner) public view returns (uint256) {
        return balanceOf(owner);
    }
    
    /**
     * @dev 获取用户拥有的指定索引处的tokenId
     * 由ERC721Enumerable提供的新功能
     */
    function getUserTokenByIndex(address owner, uint256 index) public view returns (uint256) {
        return tokenOfOwnerByIndex(owner, index);
    }
    
    /**
     * @dev 获取指定页的资源列表
     */
    function getResourcesPage(uint256 offset, uint256 limit) public view returns (
        uint256[] memory tokenIds,
        uint256 total
    ) {
        uint256 totalTokens = totalSupply();
        
        if (offset >= totalTokens) {
            // 如果偏移量超出范围，返回空数组
            return (new uint256[](0), totalTokens);
        }
        
        // 计算实际要返回的token数量
        uint256 itemsToReturn = (offset + limit > totalTokens) ? (totalTokens - offset) : limit;
        
        tokenIds = new uint256[](itemsToReturn);
        
        for (uint256 i = 0; i < itemsToReturn; i++) {
            tokenIds[i] = tokenByIndex(offset + i);
        }
        
        return (tokenIds, totalTokens);
    }
    
    /**
     * @dev 获取用户拥有的资源列表
     */
    function getUserResources(address owner, uint256 offset, uint256 limit) public view returns (
        uint256[] memory tokenIds,
        uint256 total
    ) {
        uint256 totalUserTokens = balanceOf(owner);
        
        if (offset >= totalUserTokens) {
            // 如果偏移量超出范围，返回空数组
            return (new uint256[](0), totalUserTokens);
        }
        
        // 计算实际要返回的token数量
        uint256 itemsToReturn = (offset + limit > totalUserTokens) ? (totalUserTokens - offset) : limit;
        
        tokenIds = new uint256[](itemsToReturn);
        
        for (uint256 i = 0; i < itemsToReturn; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, offset + i);
        }
        
        return (tokenIds, totalUserTokens);
    }
    
    /**
     * @dev 获取当前在市场上架的资源列表
     */
    function getMarketListings(uint256 offset, uint256 limit) public view returns (
        uint256[] memory tokenIds,
        uint256 total
    ) {
        // 首先计算在市场上架的token总数
        uint256 totalListings = 0;
        uint256 totalTokens = totalSupply();
        
        // 临时数组，用于存储所有上架的tokenId
        uint256[] memory allListings = new uint256[](totalTokens);
        
        for (uint256 i = 0; i < totalTokens; i++) {
            uint256 tokenId = tokenByIndex(i);
            if (_listings[tokenId].isActive) {
                allListings[totalListings] = tokenId;
                totalListings++;
            }
        }
        
        if (offset >= totalListings) {
            // 如果偏移量超出范围，返回空数组
            return (new uint256[](0), totalListings);
        }
        
        // 计算实际要返回的token数量
        uint256 itemsToReturn = (offset + limit > totalListings) ? (totalListings - offset) : limit;
        
        tokenIds = new uint256[](itemsToReturn);
        
        for (uint256 i = 0; i < itemsToReturn; i++) {
            tokenIds[i] = allListings[offset + i];
        }
        
        return (tokenIds, totalListings);
    }
} 