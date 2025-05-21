import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 添加 BigInt 序列化处理
const stringify = (obj) => {
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    });
};

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
            let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
            if (Object.keys(metadata).length > 0) {
                msg += `\n${stringify(metadata)}`;
            }
            return msg;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/error.log'), 
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/combined.log'),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

export const requestLogger = (req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
        headers: req.headers,
        query: req.query,
        body: req.body,
        ip: req.ip
    });
    next();
};

export default logger; 