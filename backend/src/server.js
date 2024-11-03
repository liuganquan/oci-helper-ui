const env = require('./config/env');
const express = require('express');
const cors = require('cors');
const path = require('path');
const grabRouter = require('./routes/grab');
const ociConfigRouter = require('./routes/ociConfig');
const instanceRouter = require('./routes/instance');
const configRouter = require('./routes/config');
const autoGrabService = require('./services/AutoGrabService');
const GlobalConfig = require('./models/globalConfig');
const grabService = require('./services/GrabService');
const authRouter = require('./routes/auth');
const authMiddleware = require('./middleware/auth');

const app = express();


// 加载环境变量
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost'];

// 中间件配置
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
// 添加认证路由(不需要验证)
app.use('/api/auth', authRouter);

// 其他API路由需要验证
app.use('/api/grab', authMiddleware, grabRouter);
app.use('/api/oci-config', authMiddleware, ociConfigRouter);
app.use('/api/instances', authMiddleware, instanceRouter);
app.use('/api/config', authMiddleware, configRouter);

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('错误:', err);
    res.status(500).json({
        error: err.message || '服务器内部错误'
    });
});

// 处理 404
app.use((req, res) => {
    res.status(404).json({
        error: '未找到请求的资源'
    });
});

// 启动服务器
const PORT = process.env.PORT || 20021;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    initServices();
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，准备关闭服务器');
    app.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
});

async function initServices() {
    const config = await GlobalConfig.get();
    if (config.auto_grab_enabled) {
        await autoGrabService.init();
    }

    try {
        // 初始化运行中的抢机任务
        await grabService.initializeRunningTasks();
        console.log('已恢复运行中的抢机任务');
    } catch (error) {
        console.error('服务初始化失败:', error);
    }
}

module.exports = app;