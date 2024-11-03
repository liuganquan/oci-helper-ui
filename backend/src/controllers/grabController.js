const GrabTask = require('../models/grabTask');
const grabService = require('../services/GrabService');

class GrabController {
    async startTask(taskId) {
        try {
            const task = await GrabTask.findById(taskId);
            if (!task) {
                throw new Error('Task not found');
            }
            
            await GrabTask.updateStatus(taskId, 'running');
            await GrabTask.addLog(taskId, 'INFO', '任务开始运行');
            
            grabService.startTask(taskId).catch(async error => {
                console.error('Task execution error:', error);
                await GrabTask.updateStatus(taskId, 'failed');
                await GrabTask.addLog(taskId, 'ERROR', error.message);
            });
            
            return { message: 'Task started' };
        } catch (error) {
            throw error;
        }
    }

    async stopTask(taskId) {
        try {
            const task = await GrabTask.findById(taskId);
            if (!task) {
                throw new Error('Task not found');
            }
            
            await grabService.stopTask(taskId);
            return { message: 'Task stopped' };
        } catch (error) {
            throw error;
        }
    }
}

const grabController = new GrabController();
module.exports = grabController; 