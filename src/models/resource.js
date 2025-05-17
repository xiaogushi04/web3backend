import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema({
  cid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  size: {
    type: Number,
    required: true
  },
  owner: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  filename: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  metadata: {
    title: {
      type: String,
      index: true
    },
    description: String,
    tags: [{
      type: String,
      index: true
    }],
    category: {
      type: String,
      index: true
    }
  },
  tokenId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  isPinned: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 更新时自动更新 updatedAt
resourceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 创建复合索引
resourceSchema.index({ owner: 1, createdAt: -1 });
resourceSchema.index({ 'metadata.tags': 1, createdAt: -1 });
resourceSchema.index({ 'metadata.category': 1, createdAt: -1 });

export default mongoose.model('Resource', resourceSchema); 