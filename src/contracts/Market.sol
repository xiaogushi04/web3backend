// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IAcademicNFT {
    function getResourceMetadata(uint256 tokenId) external view returns (
        string memory title,
        string memory description,
        string memory ipfsHash,
        uint8 resourceType,
        address[] memory authors,
        uint256 timestamp
    );
}

interface IPlatformToken {
    function updateCreatorVolume(address creator, uint256 volume) external;
}

contract AcademicMarket is ReentrancyGuard, Ownable {
    // 平台费用比例（百分比）
    uint256 public platformFeePercentage = 2;
    
    // 创作者版税比例（百分比）
    uint256 public creatorRoyaltyPercentage = 5;
    
    // 每个NFT的自定义版税比例
    mapping(uint256 => uint256) public customRoyaltyPercentages;
    
    // 平台费用接收地址
    address public feeRecipient;

    // NFT合约地址
    address public nftContract;

    // 访问权合约地址
    address public accessTokenContract;

    // 平台代币合约地址
    address public platformTokenContract;

    // 上架信息结构
    struct Listing {
        address seller;
        uint256 price;
        bool isActive;
        uint256 timestamp;
    }

    // tokenId 到上架信息的映射
    mapping(uint256 => Listing) public listings;
    
    // 用户地址到其上架的 tokenId 列表的映射
    mapping(address => uint256[]) public userListings;

    // 事件
    event TokenListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event TokenSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event PlatformFeeUpdated(uint256 newFeePercentage);
    event RoyaltyFeeUpdated(uint256 newRoyaltyPercentage);
    event CustomRoyaltySet(uint256 indexed tokenId, uint256 royaltyPercentage);
    event FeeRecipientUpdated(address newFeeRecipient);
    event NFTContractUpdated(address newNFTContract);
    event RoyaltyPaid(uint256 indexed tokenId, address indexed creator, uint256 amount);
    event AccessTokenSold(
        uint256 indexed resourceId,
        address indexed buyer,
        uint256 indexed accessTokenId,
        uint256 price
    );
    event PlatformTokenContractUpdated(address newPlatformTokenContract);

    constructor(
        address _feeRecipient,
        address _nftContract,
        address _accessTokenContract,
        address _platformTokenContract
    ) Ownable() {
        require(_feeRecipient != address(0), "Invalid fee recipient address");
        require(_nftContract != address(0), "Invalid NFT contract address");
        require(_accessTokenContract != address(0), "Invalid access token contract address");
        require(_platformTokenContract != address(0), "Invalid platform token contract address");
        feeRecipient = _feeRecipient;
        nftContract = _nftContract;
        accessTokenContract = _accessTokenContract;
        platformTokenContract = _platformTokenContract;
    }

    // 上架 NFT
    function listToken(uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "Price must be greater than 0");
        
        // 使用NFT合约地址检查所有权
        require(IERC721(nftContract).ownerOf(tokenId) == msg.sender, "Not token owner");
        require(IERC721(nftContract).isApprovedForAll(msg.sender, address(this)), "Market not approved");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            isActive: true,
            timestamp: block.timestamp
        });

        userListings[msg.sender].push(tokenId);
        emit TokenListed(tokenId, msg.sender, price);
    }

    // 获取NFT创建者
    function _getOriginalCreator(uint256 tokenId) internal view returns (address) {
        // 使用AcademicNFT接口获取资源元数据
        (,,,, address[] memory authors,) = IAcademicNFT(nftContract).getResourceMetadata(tokenId);
        // 假设第一个作者是创建者
        if (authors.length > 0) {
            return authors[0];
        }
        return address(0);
    }
    
    // 获取版税比例
    function getRoyaltyPercentage(uint256 tokenId) public view returns (uint256) {
        // 如果有自定义版税，使用自定义值
        if (customRoyaltyPercentages[tokenId] > 0) {
            return customRoyaltyPercentages[tokenId];
        }
        // 否则使用默认值
        return creatorRoyaltyPercentage;
    }

    // 购买 NFT
    function buyToken(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "Listing not active");
        require(msg.value >= listing.price, "Insufficient payment");

        address seller = listing.seller;
        uint256 price = listing.price;
        
        // 计算平台费用
        uint256 platformFee = (price * platformFeePercentage) / 100;
        
        // 计算版税
        uint256 royaltyPercentage = getRoyaltyPercentage(tokenId);
        address creator = _getOriginalCreator(tokenId);
        uint256 royaltyFee = (price * royaltyPercentage) / 100;
        
        // 计算卖家最终获得的金额
        uint256 sellerAmount = price - platformFee - royaltyFee;

        // 更新状态
        listing.isActive = false;

        // 转移 NFT
        IERC721(nftContract).transferFrom(seller, msg.sender, tokenId);

        // 转移平台费用
        (bool feeSuccess, ) = feeRecipient.call{value: platformFee}("");
        require(feeSuccess, "Fee transfer failed");

        // 如果有创建者且版税大于0，转移版税
        if (creator != address(0) && royaltyFee > 0) {
            // 确保创建者不是卖家自己，如果是，金额合并到卖家收入中
            if (creator != seller) {
                (bool royaltySuccess, ) = creator.call{value: royaltyFee}("");
                require(royaltySuccess, "Royalty transfer failed");
                emit RoyaltyPaid(tokenId, creator, royaltyFee);
            } else {
                // 如果创建者就是卖家，合并金额
                sellerAmount += royaltyFee;
            }
        } else {
            // 如果没有创建者或版税为0，金额归属卖家
            sellerAmount += royaltyFee;
        }

        // 转移给卖家
        (bool sellerSuccess, ) = seller.call{value: sellerAmount}("");
        require(sellerSuccess, "Seller transfer failed");

        // 如果有超额支付，返还给买家
        if (msg.value > price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - price}("");
            require(refundSuccess, "Refund failed");
        }
        
        // 更新创作者的交易量
        if (creator != address(0)) {
            IPlatformToken(platformTokenContract).updateCreatorVolume(creator, price);
        }

        emit TokenSold(tokenId, seller, msg.sender, price);
    }

    // 设置NFT的自定义版税比例（仅限所有者或原创者）
    function setCustomRoyaltyPercentage(uint256 tokenId, uint256 percentage) external {
        address creator = _getOriginalCreator(tokenId);
        require(msg.sender == owner() || msg.sender == creator, "Not authorized");
        require(percentage <= 15, "Royalty percentage too high");
        
        customRoyaltyPercentages[tokenId] = percentage;
        emit CustomRoyaltySet(tokenId, percentage);
    }

    // 更新默认版税比例（仅限所有者）
    function updateRoyaltyFee(uint256 newRoyaltyPercentage) external onlyOwner {
        require(newRoyaltyPercentage <= 15, "Royalty fee too high");
        creatorRoyaltyPercentage = newRoyaltyPercentage;
        emit RoyaltyFeeUpdated(newRoyaltyPercentage);
    }

    // 取消上架
    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");

        listing.isActive = false;
        emit ListingCancelled(tokenId, msg.sender);
    }

    // 更新平台费用比例（仅限所有者）
    function updatePlatformFee(uint256 newFeePercentage) external onlyOwner {
        require(newFeePercentage <= 10, "Fee too high");
        platformFeePercentage = newFeePercentage;
        emit PlatformFeeUpdated(newFeePercentage);
    }

    // 更新费用接收地址（仅限所有者）
    function updateFeeRecipient(address newFeeRecipient) external onlyOwner {
        require(newFeeRecipient != address(0), "Invalid fee recipient address");
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(newFeeRecipient);
    }

    // 更新NFT合约地址（仅限所有者）
    function updateNFTContract(address newNFTContract) external onlyOwner {
        require(newNFTContract != address(0), "Invalid NFT contract address");
        nftContract = newNFTContract;
        emit NFTContractUpdated(newNFTContract);
    }

    // 获取用户的所有上架
    function getUserListings(address user) external view returns (uint256[] memory) {
        return userListings[user];
    }

    // 获取上架详情
    function getListing(uint256 tokenId) external view returns (
        address seller,
        uint256 price,
        bool isActive,
        uint256 timestamp
    ) {
        Listing memory listing = listings[tokenId];
        return (
            listing.seller,
            listing.price,
            listing.isActive,
            listing.timestamp
        );
    }
    
    // 获取购买分配详情，用于前端展示
    function getPurchaseBreakdown(uint256 tokenId) external view returns (
        uint256 totalPrice,
        uint256 platformFee,
        uint256 royaltyFee,
        uint256 sellerReceives,
        address creator
    ) {
        require(listings[tokenId].isActive, "Listing not active");
        
        totalPrice = listings[tokenId].price;
        platformFee = (totalPrice * platformFeePercentage) / 100;
        
        creator = _getOriginalCreator(tokenId);
        uint256 royaltyPercentage = getRoyaltyPercentage(tokenId);
        royaltyFee = (totalPrice * royaltyPercentage) / 100;
        
        sellerReceives = totalPrice - platformFee - royaltyFee;
        
        // 如果创建者就是卖家，合并版税到卖家收入
        if (creator == listings[tokenId].seller) {
            sellerReceives += royaltyFee;
            royaltyFee = 0; // 重置版税为0，因为已经包含在卖家收入中
        }
        
        return (totalPrice, platformFee, royaltyFee, sellerReceives, creator);
    }

    // 购买NFT访问权
    function buyAccessToken(
        uint256 resourceId,
        uint256 duration,
        uint256 maxUses
    ) external payable nonReentrant {
        // 检查参数有效性
        require(duration > 0, "Duration must be greater than 0");
        require(maxUses > 0, "Max uses must be greater than 0");
        
        // 检查资源是否存在
        address resourceOwner = IERC721(nftContract).ownerOf(resourceId);
        require(resourceOwner != address(0), "Resource does not exist");
        
        // 获取访问权配置
        (uint256 maxAccessTokens, uint256 currentAccessTokens, uint256 price, bool isActive) = 
            IAccessToken(accessTokenContract).getResourceAccessConfig(resourceId);
            
        require(isActive, "Access token sales not active for this resource");
        require(currentAccessTokens < maxAccessTokens, "Maximum access tokens reached");
        require(msg.value >= price, "Insufficient payment");

        // 计算费用分配
        uint256 platformFee = (price * platformFeePercentage) / 100;
        uint256 royaltyFee = (price * getRoyaltyPercentage(resourceId)) / 100;
        uint256 ownerAmount = price - platformFee - royaltyFee;

        // 调用访问权合约铸造访问权（不发送 ETH）
        uint256 accessTokenId = IAccessToken(accessTokenContract).mintAccessToken(
            resourceId,
            IAccessToken.AccessType.Read,
            duration,
            maxUses
        );

        // 转移费用
        if (platformFee > 0) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: platformFee}("");
            require(feeSuccess, "Platform fee transfer failed");
        }

        address creator = _getOriginalCreator(resourceId);
        if (royaltyFee > 0 && creator != address(0)) {
            (bool royaltySuccess, ) = payable(creator).call{value: royaltyFee}("");
            require(royaltySuccess, "Royalty fee transfer failed");
            emit RoyaltyPaid(resourceId, creator, royaltyFee);
        }

        if (ownerAmount > 0) {
            (bool ownerSuccess, ) = payable(resourceOwner).call{value: ownerAmount}("");
            require(ownerSuccess, "Owner payment transfer failed");
        }

        // 退还多余的 ETH
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }

        emit AccessTokenSold(resourceId, msg.sender, accessTokenId, price);
    }

    // 更新访问权合约地址
    function updateAccessTokenContract(address newAccessTokenContract) external onlyOwner {
        require(newAccessTokenContract != address(0), "Invalid access token contract address");
        accessTokenContract = newAccessTokenContract;
    }

    // 获取访问权价格明细
    function getAccessTokenBreakdown(uint256 resourceId) external view returns (
        uint256 totalPrice,
        uint256 platformFee,
        uint256 royaltyFee,
        uint256 ownerReceives,
        address creator
    ) {
        (,,uint256 price,) = IAccessToken(accessTokenContract).getResourceAccessConfig(resourceId);
        
        platformFee = (price * platformFeePercentage) / 100;
        uint256 royaltyPercentage = getRoyaltyPercentage(resourceId);
        creator = _getOriginalCreator(resourceId);
        royaltyFee = (price * royaltyPercentage) / 100;
        ownerReceives = price - platformFee - royaltyFee;
        
        return (price, platformFee, royaltyFee, ownerReceives, creator);
    }

    // 更新平台代币合约地址（仅限所有者）
    function updatePlatformTokenContract(address newPlatformTokenContract) external onlyOwner {
        require(newPlatformTokenContract != address(0), "Invalid platform token contract address");
        platformTokenContract = newPlatformTokenContract;
        emit PlatformTokenContractUpdated(newPlatformTokenContract);
    }
}

// 访问权合约接口
interface IAccessToken {
    enum AccessType { Read, Write, Full }
    
    function mintAccessToken(
        uint256 resourceId,
        AccessType accessType,
        uint256 duration,
        uint256 maxUses
    ) external payable returns (uint256);
    
    function getResourceAccessConfig(uint256 resourceId) external view returns (
        uint256 maxAccessTokens,
        uint256 currentAccessTokens,
        uint256 price,
        bool isActive
    );
    
    function totalSupply() external view returns (uint256);
} 