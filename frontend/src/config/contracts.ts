// ERC721 标准接口 ABI
export const ERC721_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function approve(address to, uint256 tokenId)"
];

// AcademicNFT 合约 ABI
export const ACADEMIC_NFT_ABI = [
  ...ERC721_ABI,
  "function mintResource(address to, string title, string description, string ipfsHash, uint8 resourceType, address[] authors) returns (uint256)",
  "function updateResourceIpfsHash(uint256 tokenId, string newIpfsHash)",
  "function getResourceMetadata(uint256 tokenId) view returns (string title, string description, string ipfsHash, uint8 resourceType, address[] authors, uint256 timestamp)",
  "function getAuthorResources(address author) view returns (uint256[])",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function totalResources() view returns (uint256)"
];

// Market 合约 ABI
export const MARKET_ABI = [
  ...ERC721_ABI,
  "function listToken(uint256 tokenId, uint256 price)",
  "function buyToken(uint256 tokenId) payable",
  "function cancelListing(uint256 tokenId)",
  "function getListing(uint256 tokenId) view returns (address seller, uint256 price, bool isActive, uint256 timestamp)",
  "function getUserListings(address user) view returns (uint256[])",
  "function getPurchaseBreakdown(uint256 tokenId) view returns (uint256 totalPrice, uint256 platformFee, uint256 royaltyFee, uint256 sellerReceives, address creator)",
  "function buyAccessToken(uint256 resourceId, uint256 duration, uint256 maxUses) payable",
  "function getAccessTokenBreakdown(uint256 resourceId) view returns (uint256 totalPrice, uint256 platformFee, uint256 royaltyFee, uint256 ownerReceives, address creator)",
  "function platformFeePercentage() view returns (uint256)",
  "function creatorRoyaltyPercentage() view returns (uint256)",
  "event AccessTokenSold(uint256 indexed resourceId, address indexed buyer, uint256 indexed accessTokenId, uint256 price)"
];

// AccessToken 合约 ABI
export const ACCESS_TOKEN_ABI = [
  ...ERC721_ABI,
  "function owner() view returns (address)",
  "function academicNFT() view returns (address)",
  "function setResourceAccessConfig(uint256 resourceId, uint256 maxAccessTokens, uint256 price, bool isActive)",
  "function mintAccessToken(uint256 resourceId, uint8 accessType, uint256 duration, uint256 maxUses) payable returns (uint256)",
  "function useAccessToken(uint256 tokenId)",
  "function burnAccessToken(uint256 tokenId)",
  "function getAccessMetadata(uint256 tokenId) view returns (uint256 resourceId, uint8 accessType, uint256 expiryTime, uint256 maxUses, uint256 usedCount, bool isActive)",
  "function getResourceAccessConfig(uint256 resourceId) view returns (uint256 maxAccessTokens, uint256 currentAccessTokens, uint256 price, bool isActive)",
  "function getUserAccessTokens(address user) view returns (uint256[])",
  "function isAccessValid(uint256 tokenId) view returns (bool)",
  "function withdraw()",
  "event AccessTokenMinted(uint256 indexed tokenId, uint256 indexed resourceId, address indexed owner, uint8 accessType, uint256 expiryTime, uint256 maxUses)",
  "event AccessTokenBurned(uint256 indexed tokenId, uint256 indexed resourceId, address indexed owner)",
  "event AccessTokenUsed(uint256 indexed tokenId, uint256 indexed resourceId, address indexed user)",
  "event ResourceAccessConfigUpdated(uint256 indexed resourceId, uint256 maxAccessTokens, uint256 price, bool isActive)"
];