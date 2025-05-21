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

    constructor(address _feeRecipient, address _nftContract) Ownable() {
        require(_feeRecipient != address(0), "Invalid fee recipient address");
        require(_nftContract != address(0), "Invalid NFT contract address");
        feeRecipient = _feeRecipient;
        nftContract = _nftContract;
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
} 