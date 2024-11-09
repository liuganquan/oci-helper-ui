const GrabTask = require('../models/grabTask');
const OciConfig = require('../models/ociConfig');
const InstanceController = require('../controllers/instanceController');

class GrabService {
    constructor() {
        this.runningTasks = new Set();
        this.taskCancelTokens = new Map();
        this.taskPromises = new Map();
    }

    // 启动任务
    async startTask(taskId) {
        if (this.runningTasks.has(taskId)) {
            throw new Error('Task is already running');
        }

        this.runningTasks.add(taskId);
        this.taskCancelTokens.set(taskId, { cancelled: false });

        const taskPromise = this.executeTask(taskId);
        this.taskPromises.set(taskId, taskPromise);

        try {
            await taskPromise;
        } catch (error) {
            console.error('Task execution error:', error);
            await GrabTask.updateStatus(taskId, 'failed');
            await GrabTask.addLog(taskId, 'ERROR', error.message);
            this.cleanup(taskId);
        }
    }

    // 停止任务
    async stopTask(taskId) {
        const cancelToken = this.taskCancelTokens.get(taskId);
        if (cancelToken) {
            cancelToken.cancelled = true;
        }

        const taskPromise = this.taskPromises.get(taskId);
        if (taskPromise) {
            try {
                await taskPromise;
            } catch (error) {
                console.error('Error waiting for task to stop:', error);
            }
        }

        this.cleanup(taskId);
        await GrabTask.updateStatus(taskId, 'stopped');
        await GrabTask.addLog(taskId, 'INFO', '任务已停止');
    }

    // 清理任务
    cleanup(taskId) {
        this.runningTasks.delete(taskId);
        this.taskCancelTokens.delete(taskId);
        this.taskPromises.delete(taskId);
    }

    // 生成随机密码
    generatePassword() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 32; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            password += chars[randomIndex];
        }
        return password;
    }

    // 获取随机等待时间
    getRandomWaitTime(baseTime) {
        const minTime = Math.max(baseTime - 5, 1);
        const maxTime = baseTime + 5;
        return Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    }

    // 等待指定时间
    wait(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    // 尝试创建实例
    async tryCreateInstance(task, config) {
        try {
            console.log('开始创建实例:', {
                taskId: task.id,
                profileId: config.id,
                shape: task.shape,
                authType: task.auth_type
            });

            const instanceController = new InstanceController(config);
            const password = task.auth_type === 'password' ? this.generatePassword() : null;
            console.log('认证信息:', {
                taskId: task.id,
                authType: task.auth_type,
                hasPassword: !!password
            });

            const metadata = task.auth_type === 'password' 
                ? this.getPasswordMetadata(password) 
                : this.getSshKeyMetadata(task.ssh_key);

            const instance = await instanceController.createInstance({
                ...task,
                metadata,
                shapeConfig: this.getShapeConfig(task)
            });

            console.log('实例创建成功:', {
                taskId: task.id,
                instanceId: instance.id
            });

            const publicIp = await instanceController.getInstanceIp(instance.id);
            console.log('获取公网IP成功:', {
                taskId: task.id,
                instanceId: instance.id,
                publicIp
            });

            try {
                await GrabTask.addInstanceInfo(task.id, instance.id, publicIp, password);
                console.log('实例信息保存成功:', {
                    taskId: task.id,
                    instanceId: instance.id,
                    publicIp,
                    hasPassword: !!password
                });
            } catch (error) {
                console.error('保存实例信息失败:', {
                    taskId: task.id,
                    instanceId: instance.id,
                    error: error.message,
                    stack: error.stack
                });
                throw error;
            }

            return {
                success: true,
                instanceId: instance.id,
                publicIp,
                password
            };
        } catch (error) {
            console.error('创建实例失败:', {
                taskId: task.id,
                error: error.message,
                stack: error.stack,
                details: error.details || '无详细信息'
            });
            return {
                success: false,
                error: error.message || '创建实例失败'
            };
        }
    }

    // 获取密码元数据
    getPasswordMetadata(password) {
        return {
            password,
            user_data: Buffer.from(`#!/bin/bash
echo root:${password} | chpasswd root
sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin yes/g' /etc/ssh/sshd_config
sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication yes/g' /etc/ssh/sshd_config
rm -rf /etc/ssh/sshd_config.d/* && rm -rf /etc/ssh/ssh_config.d/*
/etc/init.d/ssh* restart`).toString('base64')
        };
    }

    // 获取SSH密钥元数据
    getSshKeyMetadata(sshKey) {
        return {
            ssh_authorized_keys: sshKey
        };
    }

    // 获取实例配置
    getShapeConfig(task) {
        if (task.ocpus && task.memory_in_gbs) {
            return {
                ocpus: Number(task.ocpus),
                memoryInGBs: Number(task.memory_in_gbs)
            };
        }
        return undefined;
    }

    // 执行抢机任务
    async executeTask(taskId) {
        try {
            const task = await GrabTask.findById(taskId);
            const config = await OciConfig.findById(task.profile_id);
            
            // 检查当前实例数量
            if (task.current_count >= task.target_count) {
                await GrabTask.updateStatus(taskId, 'success');
                await GrabTask.addLog(taskId, 'SUCCESS', '已达到目标数量，任务完成');
                this.cleanup(taskId);
                return;
            }

            const initialWaitTime = this.getRandomWaitTime(task.wait_time);
            await GrabTask.addLog(taskId, 'INFO', `等待 ${initialWaitTime} 秒后开始抢机...`);
            await this.wait(initialWaitTime);
            
            while (this.runningTasks.has(taskId) && !this.taskCancelTokens.get(taskId).cancelled) {
                // 每次循环都重新检查数据库中的任务状态和实例数量
                const currentTask = await GrabTask.findById(taskId);
                if (currentTask.status !== 'running') {
                    console.log(`任务 ${taskId} 状态已变更为 ${currentTask.status}，停止抢机`);
                    this.cleanup(taskId);
                    break;
                }

                // 检查是否已达到目标数量
                if (currentTask.current_count >= currentTask.target_count) {
                    await GrabTask.updateStatus(taskId, 'success');
                    await GrabTask.addLog(taskId, 'SUCCESS', '已达到目标数量，任务完成');
                    this.cleanup(taskId);
                    break;
                }

                try {
                    const result = await this.tryCreateInstance(task, config);
                    
                    if (result.success) {
                        await GrabTask.addLog(taskId, 'SUCCESS', `成功抢到第 ${task.current_count + 1} 台机器`);
                        await GrabTask.incrementCount(taskId);
                        
                        const waitTime = this.getRandomWaitTime(task.wait_time);
                        await GrabTask.addLog(taskId, 'INFO', `等待 ${waitTime} 秒后继续抢下一台...`);
                        await this.wait(waitTime);
                    } else if (result.error.includes('Out of host capacity') || 
                             result.error.includes('Too many requests for the user')) {
                        const waitTime = this.getRandomWaitTime(task.wait_time);
                        await GrabTask.addLog(taskId, 'INFO', `${result.error}，等待 ${waitTime} 秒后重试...`);
                        await this.wait(waitTime);
                    } else {
                        await GrabTask.addLog(taskId, 'ERROR', `创建失败: ${result.error}`);
                        await GrabTask.updateStatus(taskId, 'failed');
                        this.cleanup(taskId);
                        break;
                    }
                } catch (error) {
                    throw error;
                }
            }
        } catch (error) {
            console.error('Execute task error:', error);
            throw error;
        }
    }

    async initializeRunningTasks() {
        try {
            // 获取所有状态为 running 的任务
            const runningTasks = await GrabTask.findByStatus('running');
            console.log(`找到 ${runningTasks.length} 个运行中的任务`);

            // 重新启动每个任务
            for (const task of runningTasks) {
                console.log(`正在恢复任务: ${task.id}`);
                await this.startTask(task.id);
            }
        } catch (error) {
            console.error('初始化运行中任务失败:', error);
        }
    }
}

// 创建单例
const grabService = new GrabService();
module.exports = grabService;