// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AcademicMarket is ReentrancyGuard, Ownable {
    // 平台费用比例（百分比）
    uint256 public platformFeePercentage = 2;
    
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
    event FeeRecipientUpdated(address newFeeRecipient);
    event NFTContractUpdated(address newNFTContract);

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

    // 购买 NFT
    function buyToken(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "Listing not active");
        require(msg.value >= listing.price, "Insufficient payment");

        address seller = listing.seller;
        uint256 price = listing.price;
        
        // 计算平台费用
        uint256 platformFee = (price * platformFeePercentage) / 100;
        uint256 sellerAmount = price - platformFee;

        // 更新状态
        listing.isActive = false;

        // 转移 NFT
        IERC721(nftContract).transferFrom(seller, msg.sender, tokenId);

        // 转移资金
        (bool feeSuccess, ) = feeRecipient.call{value: platformFee}("");
        require(feeSuccess, "Fee transfer failed");

        (bool sellerSuccess, ) = seller.call{value: sellerAmount}("");
        require(sellerSuccess, "Seller transfer failed");

        // 如果有超额支付，返还给买家
        if (msg.value > price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - price}("");
            require(refundSuccess, "Refund failed");
        }

        emit TokenSold(tokenId, seller, msg.sender, price);
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
} 