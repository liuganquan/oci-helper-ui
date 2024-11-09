const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { redis } = require('../config/redis');
const input = require('input');

class TelegramService {
    constructor() {
        if (!TelegramService.instance) {
            this.redis = redis;
            this.client = null;
            this.stringSession = new StringSession(process.env.TELEGRAM_STRING_SESSION || '');
            TelegramService.instance = this;
        }
        return TelegramService.instance;
    }

    async init() {
        if (!process.env.TELEGRAM_API_ID) {
            console.log('Telegram配置未设置，跳过初始化');
            return;
        }

        if (this.client) {
            console.log('Telegram客户端已初始化');
            return;
        }

        try {
            this.client = new TelegramClient(
                this.stringSession,
                parseInt(process.env.TELEGRAM_API_ID),
                process.env.TELEGRAM_API_HASH,
                { connectionRetries: 5 }
            );

            await this.client.start({
                phoneNumber: async () => process.env.TELEGRAM_PHONE,
                password: async () => await input.text('请输入二次验证密码:'),
                phoneCode: async () => await input.text('请输入验证码:'),
                onError: (err) => console.error('Telegram连接错误:', err),
            });
            
            // 保存 session 字符串
            const sessionString = this.client.session.save();
            console.log('请保存此 session 字符串到环境变量 TELEGRAM_STRING_SESSION:', sessionString);
            
            await this.startMonitoring(process.env.TELEGRAM_CHANNEL_ID);
            console.log('Telegram客户端初始化成功');
        } catch (error) {
            console.error('Telegram初始化失败:', error);
            throw error;
        }
    }

    async startMonitoring(channelId) {
        if (!this.client) return;
        
        this.client.addEventHandler(async (event) => {
            try {
                if (event.message && 
                    event.message.peerId && 
                    event.message.peerId.channelId && 
                    event.message.peerId.channelId.toString() === channelId) {
                    const message = event.message.message;
                    await this.redis.publish('stock_notification', message);
                    console.log('发布消息到Redis:', message);
                }
            } catch (error) {
                console.error('处理Telegram消息时出错:', error);
            }
        });
        
        console.log('开始监听Telegram频道:', channelId);
    }

    async close() {
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
            console.log('Telegram客户端已关闭');
        }
    }
}

module.exports = new TelegramService();