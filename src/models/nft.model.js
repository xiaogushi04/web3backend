import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const NFTSchema = new mongoose.Schema({
    tokenId: {
        type: String,
        required: [true, 'tokenId 是必需的'],
        unique: true,
        index: true,
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'tokenId 不能为空'
        }
    },
    title: {
        type: String,
        required: [true, '标题是必需的'],
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: '标题不能为空'
        }
    },
    description: {
        type: String,
        default: '',
        validate: {
            validator: function(v) {
                return v !== null;
            },
            message: '描述不能为 null'
        }
    },
    ipfsHash: {
        type: String,
        required: [true, 'IPFS Hash 是必需的'],
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'IPFS Hash 不能为空'
        }
    },
    resourceType: {
        type: String,
        required: [true, '资源类型是必需的'],
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: '资源类型不能为空'
        }
    },
    authors: {
        type: [String],
        default: [],
        validate: {
            validator: function(v) {
                return Array.isArray(v);
            },
            message: '作者必须是数组'
        }
    },
    creator: {
        type: String,
        required: [true, '创建者是必需的'],
        index: true,
        set: v => v ? v.toLowerCase() : v,
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: '创建者地址不能为空'
        }
    },
    currentOwner: {
        type: String,
        required: [true, '当前所有者是必需的'],
        index: true,
        set: v => v ? v.toLowerCase() : v,
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: '当前所有者地址不能为空'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastTransferredAt: {
        type: Date,
        default: Date.now
    },
    listing: {
        isActive: {
            type: Boolean,
            default: false
        },
        price: {
            type: String,
            default: '0',
            validate: {
                validator: function(v) {
                    return v !== null && v !== undefined;
                },
                message: '价格不能为 null 或 undefined'
            }
        },
        seller: {
            type: String,
            default: null,
            set: v => v ? v.toLowerCase() : v,
            validate: {
                validator: function(v) {
                    return v === null || (v && v.length > 0);
                },
                message: '卖家地址不能为空字符串'
            }
        },
        listedAt: {
            type: Date,
            default: null
        }
    },
    royaltyPercentage: {
        type: Number,
        default: 5,
        min: 0,
        max: 15,
        validate: {
            validator: function(v) {
                return v >= 0 && v <= 15;
            },
            message: '版税比例必须在0-15%之间'
        }
    },
    references: [{
        referenceId: {
            type: String,
            required: true
        },
        sourceTokenId: {
            type: String,
            required: true
        },
        targetTokenId: {
            type: String,
            required: true
        },
        description: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    transfers: [{
        from: {
            type: String,
            required: true,
            set: v => v ? v.toLowerCase() : v,
            validate: {
                validator: function(v) {
                    return v && v.length > 0;
                },
                message: '转出地址不能为空'
            }
        },
        to: {
            type: String,
            required: true,
            set: v => v ? v.toLowerCase() : v,
            validate: {
                validator: function(v) {
                    return v && v.length > 0;
                },
                message: '转入地址不能为空'
            }
        },
        timestamp: {
            type: Date,
            required: true,
            default: Date.now
        },
        blockNumber: {
            type: Number,
            required: true
        },
        transactionHash: {
            type: String,
            required: true,
            validate: {
                validator: function(v) {
                    return v && v.length > 0;
                },
                message: '交易哈希不能为空'
            }
        }
    }]
});

// 索引优化
NFTSchema.index({ 'listing.isActive': 1, 'listing.listedAt': -1 });
NFTSchema.index({ createdAt: -1 });

// 确保地址保存前全部转为小写
NFTSchema.pre('save', function(next) {
    try {
        if (this.currentOwner) this.currentOwner = this.currentOwner.toLowerCase();
        if (this.creator) this.creator = this.creator.toLowerCase();
        if (this.listing && this.listing.seller) this.listing.seller = this.listing.seller.toLowerCase();
        
        // 处理transfers数组中的地址
        if (this.transfers && this.transfers.length) {
            this.transfers.forEach(transfer => {
                if (transfer.from) transfer.from = transfer.from.toLowerCase();
                if (transfer.to) transfer.to = transfer.to.toLowerCase();
            });
        }
        
        next();
    } catch (error) {
        logger.error('NFT 保存前处理错误:', error);
        next(error);
    }
});

// 添加保存后的钩子
NFTSchema.post('save', function(doc) {
    logger.info(`NFT ${doc.tokenId} 保存成功`);
});

NFTSchema.post('findOneAndUpdate', function(doc) {
    if (doc) {
        logger.info(`NFT ${doc.tokenId} 更新成功`);
    }
});

const NFT = mongoose.model('NFT', NFTSchema);

export default NFT; 