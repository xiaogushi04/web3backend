import { handleError } from '../utils/error.js';
import logger from '../utils/logger.js';

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常:', err);
  process.exit(1);
});

// 处理未处理的 Promise 拒绝
process.on('unhandledRejection', (err) => {
  logger.error('未处理的 Promise 拒绝:', err);
  process.exit(1);
});

export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
}; 