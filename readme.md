# OCI 实例管理系统

一个用于管理和抢占 Oracle Cloud 实例的工具，支持多配置管理、自动抢占和 Telegram 通知功能。

## 功能特点

- 🔑 多配置管理：支持管理多个 OCI 配置
- 💻 实例管理：创建、启动、停止、调整实例配置
- 🤖 自动抢机：支持自动抢机任务
- 📱 Telegram 通知自动抢机：可通过监控放货频道来开启抢机任务
- 📊 任务日志：详细的抢占任务日志记录

## 1. 系统要求
- Node.js 18.x 或更高版本
- Redis 6.x 或更高版本
- PM2 (进程管理工具)
- Git

## 2. 环境部署

安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
重新加载 shell 配置
source ~/.bashrc
安装 Node.js 18
nvm install 18
nvm use 18

安装 PM2
npm install -g pm2
安装项目依赖
npm run install:all

拉取所有代码到vps
修改根目录env文件http://your-ip:20021 中your-ip为你的vps ip
ADMIN_USERNAME ,ADMIN_PASSWORD为登录用户名密码，可以修改
redis服务配置地址默认为我部署的，可以修改成用自己的

如果要使用自己的电报监听，就需要修改telegram-service中的env，
TELEGRAM_API_ID，TELEGRAM_API_HASH，TELEGRAM_PHONE，TELEGRAM_STRING_SESSION都修改成自己的
TELEGRAM_CHANNEL_ID一般监听的频道都是 https://t.me/agentONE_R, id为1796453976

然后使用命令pm2 start ecosystemnotele.config.js启动没有电报监听的
或者pm2 start ecosystem.config.js启动有电报监听的(需要配置好对应的电报配置)