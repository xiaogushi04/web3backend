// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract AcademicNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

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

    // 资源ID到元数据的映射
    mapping(uint256 => ResourceMetadata) private _resourceMetadata;
    
    // 作者地址到其资源ID列表的映射
    mapping(address => uint256[]) private _authorResources;

    // 修正后的事件声明
    event ResourceMinted(
        address indexed creator,
        uint256 indexed tokenId,
        string title,
        string description,
        string ipfsHash,
        ResourceType resourceType,
        address[] authors
    );
    event ResourceUpdated(uint256 indexed tokenId, string newIpfsHash);
    event ResourceTransferred(uint256 indexed tokenId, address indexed from, address indexed to);

    constructor() ERC721("Academic Resource", "ACAD") {}

    // 铸造新的学术资源NFT
    function mintResource(
        address to,
        string memory title,
        string memory description,
        string memory ipfsHash,
        ResourceType resourceType,
        address[] memory authors
    ) public returns (uint256) {
        require(to != address(0), "Invalid recipient address");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(authors.length > 0, "Must have at least one author");
        
        for (uint i = 0; i < authors.length; i++) {
            require(authors[i] != address(0), "Invalid author address");
        }
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _mint(to, newTokenId);
        
        ResourceMetadata memory metadata = ResourceMetadata({
            title: title,
            description: description,
            ipfsHash: ipfsHash,
            resourceType: resourceType,
            authors: authors,
            timestamp: block.timestamp
        });

        _resourceMetadata[newTokenId] = metadata;
        
        // 记录作者资源
        for (uint i = 0; i < authors.length; i++) {
            _authorResources[authors[i]].push(newTokenId);
        }

        // 修正后的 emit
        emit ResourceMinted(
            to,
            newTokenId,
            title,
            description,
            ipfsHash,
            resourceType,
            authors
        );
        return newTokenId;
    }

    // 更新资源IPFS哈希
    function updateResourceIpfsHash(uint256 tokenId, string memory newIpfsHash) public {
        require(_exists(tokenId), "Token does not exist");
        require(bytes(newIpfsHash).length > 0, "IPFS hash cannot be empty");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner or approved");
        _resourceMetadata[tokenId].ipfsHash = newIpfsHash;
        emit ResourceUpdated(tokenId, newIpfsHash);
    }

    // 获取资源元数据
    function getResourceMetadata(uint256 tokenId) public view returns (
        string memory title,
        string memory description,
        string memory ipfsHash,
        ResourceType resourceType,
        address[] memory authors,
        uint256 timestamp
    ) {
        require(_exists(tokenId), "Token does not exist");
        ResourceMetadata memory metadata = _resourceMetadata[tokenId];
        return (
            metadata.title,
            metadata.description,
            metadata.ipfsHash,
            metadata.resourceType,
            metadata.authors,
            metadata.timestamp
        );
    }

    // 获取作者的所有资源ID
    function getAuthorResources(address author) public view returns (uint256[] memory) {
        return _authorResources[author];
    }

    // 重写tokenURI以返回IPFS哈希
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _resourceMetadata[tokenId].ipfsHash;
    }

    // 获取资源总数
    function totalResources() public view returns (uint256) {
        return _tokenIds.current();
    }
} 