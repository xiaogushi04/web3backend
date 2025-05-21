const mongoose = require('mongoose');

const accessTokenSchema = new mongoose.Schema({
  tokenId: {
    type: String,
    required: true,
    unique: true
  },
  resourceId: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    required: true
  },
  accessType: {
    type: String,
    enum: ['Read', 'Write', 'Full'],
    required: true
  },
  expiryTime: {
    type: Date,
    required: true
  },
  maxUses: {
    type: Number,
    required: true
  },
  usedCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  price: {
    type: String,
    required: true
  },
  transactionHash: {
    type: String,
    required: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 更新 updatedAt 字段
accessTokenSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 索引
accessTokenSchema.index({ tokenId: 1 });
accessTokenSchema.index({ resourceId: 1 });
accessTokenSchema.index({ owner: 1 });
accessTokenSchema.index({ isActive: 1 });
accessTokenSchema.index({ expiryTime: 1 });

const AccessToken = mongoose.model('AccessToken', accessTokenSchema);

module.exports = AccessToken; 