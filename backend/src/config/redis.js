require('dotenv').config();

const Redis = require('ioredis');

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

class RedisClient {
    constructor() {
        if (!RedisClient.instance) {
            console.log('Redis配置:', {
                host: redisConfig.host,
                port: redisConfig.port,
                hasPassword: !!redisConfig.password
            });
            
            this.client = new Redis(redisConfig);
            
            this.client.on('error', (err) => {
                console.error('Redis连接错误:', err);
            });

            this.client.on('connect', () => {
                console.log('Redis连接成功，地址:', redisConfig.host);
            });

            RedisClient.instance = this;
        }
        return RedisClient.instance;
    }

    getClient() {
        return this.client;
    }
}

const redisInstance = new RedisClient();

module.exports = {
    redis: redisInstance.getClient(),
    redisConfig
}; 