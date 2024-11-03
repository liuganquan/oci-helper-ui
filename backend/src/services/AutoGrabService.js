const { redis } = require('../config/redis');
const GlobalConfig = require('../models/globalConfig');
const GrabTask = require('../models/grabTask');
const OciConfig = require('../models/ociConfig');
const grabController = require('../controllers/grabController');

class AutoGrabService {
    constructor() {
        this.redis = redis;
        this.subscribed = false;
    }

    async init() {
        const config = await GlobalConfig.get();
        if (!config.auto_grab_enabled) {
            console.log('自动抢机未启用，跳过初始化');
            return;
        }

        this.redis.subscribe('stock_notification', (err) => {
            if (err) {
                console.error('Redis订阅错误:', err);
                return;
            }
            this.subscribed = true;
            console.log('已订阅库存通知');
        });

        this.redis.on('message', async (channel, message) => {
            if (channel === 'stock_notification') {
                await this.handleStockNotification(message);
            }
        });
    }

    async close() {
        if (this.subscribed) {
            await this.redis.unsubscribe('stock_notification');
            this.subscribed = false;
            console.log('已取消订阅库存通知');
        }
    }

    async handleStockNotification(message) {
        try {
            // 解析消息内容
            const regionMatch = message.match(/开机地区：([a-zA-Z0-9-]+)/);
            const cpuMatch = message.match(/CPU类型：(\w+)/);
            
            if (!regionMatch) {
                console.log('消息中未找到区域信息:', message);
                return;
            }

            const messageInfo = {
                region: regionMatch[1].toLowerCase(),
                cpuType: cpuMatch ? cpuMatch[1] : null
            };

            console.log('解析到的消息信息:', messageInfo);

            const tasks = await GrabTask.findByStatus('stopped');
            for (const task of tasks) {
                // 获取配置信息
                const config = await OciConfig.findById(task.profile_id);
                if (!config) {
                    console.error(`找不到配置信息: profile_id=${task.profile_id}`);
                    continue;
                }

                // 判断区域是否匹配
                if (this.matchRegion(config.region, messageInfo.region) &&
                    this.matchCpuType(task.shape, messageInfo.cpuType)) {
                    console.log(`开始自动抢机任务: ${task.id}, 区域: ${messageInfo.region}, CPU类型: ${messageInfo.cpuType}`);
                    await grabController.startTask(task.id);
                }
            }
        } catch (error) {
            console.error('处理库存通知失败:', error);
        }
    }

    matchRegion(configRegion, messageRegion) {
        return configRegion.toLowerCase() === messageRegion;
    }

    matchCpuType(shape, cpuType) {
        if (!cpuType) return true;
        
        // 定义形状和CPU类型的映射关系
        const CPU_SHAPE_MAP = {
            'ARM': 'VM.Standard.A1.Flex',
            'AMD': 'VM.Standard.E2.1.Micro'
        };

        // 检查形状是否与CPU类型匹配
        return shape === CPU_SHAPE_MAP[cpuType];
    }
}

module.exports = new AutoGrabService(); 