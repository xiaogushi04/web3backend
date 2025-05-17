// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Reference is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _referenceIds;

    // 引用记录结构
    struct Reference {
        uint256 id;
        uint256 sourceTokenId;    // 被引用的资源ID
        uint256 targetTokenId;    // 引用者的资源ID
        address referencer;       // 引用者地址
        string description;       // 引用说明
        uint256 timestamp;        // 引用时间
        bool isValid;            // 引用是否有效
    }

    // 引用ID到引用记录的映射
    mapping(uint256 => Reference) private _references;
    
    // 资源ID到其被引用记录的映射
    mapping(uint256 => uint256[]) private _resourceReferences;
    
    // 用户地址到其引用记录的映射
    mapping(address => uint256[]) private _userReferences;

    // 事件
    event ReferenceCreated(
        uint256 indexed referenceId,
        uint256 indexed sourceTokenId,
        uint256 indexed targetTokenId,
        address referencer
    );
    event ReferenceInvalidated(uint256 indexed referenceId);
    event ReferenceValidated(uint256 indexed referenceId);

    // 创建新的引用记录
    function createReference(
        uint256 sourceTokenId,
        uint256 targetTokenId,
        string memory description
    ) public returns (uint256) {
        require(sourceTokenId != targetTokenId, "Cannot reference self");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(msg.sender != address(0), "Invalid sender address");
        
        _referenceIds.increment();
        uint256 newReferenceId = _referenceIds.current();

        Reference memory newRef = Reference({
            id: newReferenceId,
            sourceTokenId: sourceTokenId,
            targetTokenId: targetTokenId,
            referencer: msg.sender,
            description: description,
            timestamp: block.timestamp,
            isValid: true
        });

        _references[newReferenceId] = newRef;
        _resourceReferences[sourceTokenId].push(newReferenceId);
        _userReferences[msg.sender].push(newReferenceId);

        emit ReferenceCreated(newReferenceId, sourceTokenId, targetTokenId, msg.sender);
        return newReferenceId;
    }

    // 使引用记录失效
    function invalidateReference(uint256 referenceId) public {
        require(referenceId > 0 && referenceId <= _referenceIds.current(), "Invalid reference ID");
        Reference storage ref = _references[referenceId];
        require(ref.referencer == msg.sender || owner() == msg.sender, "Not authorized");
        require(ref.isValid, "Reference already invalid");
        
        ref.isValid = false;
        emit ReferenceInvalidated(referenceId);
    }

    // 使引用记录重新生效
    function validateReference(uint256 referenceId) public {
        require(referenceId > 0 && referenceId <= _referenceIds.current(), "Invalid reference ID");
        Reference storage ref = _references[referenceId];
        require(ref.referencer == msg.sender || owner() == msg.sender, "Not authorized");
        require(!ref.isValid, "Reference already valid");
        
        ref.isValid = true;
        emit ReferenceValidated(referenceId);
    }

    // 获取引用记录详情
    function getReference(uint256 referenceId) public view returns (
        uint256 id,
        uint256 sourceTokenId,
        uint256 targetTokenId,
        address referencer,
        string memory description,
        uint256 timestamp,
        bool isValid
    ) {
        require(referenceId > 0 && referenceId <= _referenceIds.current(), "Invalid reference ID");
        Reference memory ref = _references[referenceId];
        return (
            ref.id,
            ref.sourceTokenId,
            ref.targetTokenId,
            ref.referencer,
            ref.description,
            ref.timestamp,
            ref.isValid
        );
    }

    // 获取资源的所有引用记录ID
    function getResourceReferences(uint256 tokenId) public view returns (uint256[] memory) {
        return _resourceReferences[tokenId];
    }

    // 获取用户的所有引用记录ID
    function getUserReferences(address user) public view returns (uint256[] memory) {
        return _userReferences[user];
    }

    // 获取资源的有效引用数量
    function getValidReferenceCount(uint256 tokenId) public view returns (uint256) {
        uint256[] memory refs = _resourceReferences[tokenId];
        uint256 count = 0;
        
        for (uint i = 0; i < refs.length; i++) {
            if (_references[refs[i]].isValid) {
                count++;
            }
        }
        
        return count;
    }
} 