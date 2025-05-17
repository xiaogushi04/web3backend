import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  username: {
    type: String,
    trim: true,
    index: true
  },
  did: {
    type: String,
    trim: true,
    sparse: true
  },
  uploads: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resource'
  }],
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
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 创建索引
userSchema.index({ address: 1, username: 1 });

export default mongoose.model('User', userSchema); 