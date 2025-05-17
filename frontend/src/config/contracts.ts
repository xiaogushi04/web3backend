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
  "function getResourceMetadata(uint256 tokenId) view returns (string title, string description, string ipfsHash, uint8 resourceType, address[] authors, uint256 timestamp)",
  "function getAuthorResources(address author) view returns (uint256[])",
  "function totalResources() view returns (uint256)"
];

// Market 合约 ABI
export const MARKET_ABI = [
  "function listToken(uint256 tokenId, uint256 price)",
  "function buyToken(uint256 tokenId) payable",
  "function cancelListing(uint256 tokenId)",
  "function getListing(uint256 tokenId) view returns (address seller, uint256 price, bool isActive, uint256 timestamp)",
  "function getUserListings(address user) view returns (uint256[])"
]; 