const env = require('./config/env');
const express = require('express');
const telegramService = require('./services/TelegramService');
const GlobalConfig = require('./models/globalConfig');

const app = express();

async function initServices() {
    try {
        const config = await GlobalConfig.get();
        if (config.auto_grab_enabled) {
            await telegramService.init();
        }
    } catch (error) {
        console.error('服务初始化失败:', error);
    }
}

// 启动服务器
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
    console.log(`Telegram 服务运行在端口 ${PORT}`);
    initServices();
});

// 优雅关闭
process.on('SIGTERM', async () => {
    console.log('收到 SIGTERM 信号，准备关闭服务器');
    await telegramService.close();
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('未处理的 Promise 拒绝:', reason);
});