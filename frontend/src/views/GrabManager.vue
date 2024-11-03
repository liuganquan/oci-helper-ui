<template>
  <div class="page-container">
    <el-card>
      <div class="header">
        <div class="left">
          <h2>抢机任务</h2>
        </div>
        <div class="right">
          <el-button type="primary" @click="showCreateDialog">创建任务</el-button>
          <el-button type="primary" @click="showGlobalConfig">全局配置</el-button>
        </div>
      </div>

      <GrabTaskList 
        :tasks="tasks"
        @create="showCreateDialog"
        @start="startTask"
        @stop="stopTask"
        @showLogs="showLogs"
        @showLoginInfo="showLoginInfo"
        @delete="confirmDelete"
      />
    </el-card>

    <GrabTaskForm
      v-model:visible="createDialogVisible"
      @submit="createTask"
    />

    <!-- 日志对话框 -->
    <el-dialog v-model="logDialogVisible" title="任务日志" width="80%">
      <div class="log-content">
        <div v-for="log in taskLogs" :key="log.id" class="log-item">
          <span class="log-time">{{ formatTime(log.created_at) }}</span>
          <span :class="['log-type', getLogType(log.level).toLowerCase()]">
            {{ log.level }}
          </span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </el-dialog>

    <!-- 登录信息对话框 -->
    <el-dialog v-model="loginInfoDialogVisible" title="登录信息" width="500px">
      <div v-if="currentTask">
        <div v-if="instanceList.length > 0">
          <div v-for="(instance, index) in instanceList" :key="index" class="instance-info">
            <el-divider v-if="index > 0" />
            <h3>实例 #{{ index + 1 }}</h3>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="用户名">
                root
              </el-descriptions-item>
              <el-descriptions-item label="公网IP">
                {{ instance.ip }}
              </el-descriptions-item>
              <el-descriptions-item v-if="currentTask.auth_type === 'password'" label="密码">
                {{ instance.password }}
              </el-descriptions-item>
              <el-descriptions-item label="认证方式">
                {{ currentTask.auth_type === 'password' ? '密码认证' : 'SSH密钥认证' }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
        <el-empty v-else description="暂无实例信息" />
      </div>
    </el-dialog>

    <!-- 添加全局配置对话框 -->
    <GlobalConfigDialog
      v-model:visible="globalConfigVisible"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted,computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'
import GrabTaskList from '../components/GrabTaskList.vue'
import GrabTaskForm from '../components/GrabTaskForm.vue'
import GlobalConfigDialog from '../components/GlobalConfigDialog.vue'

const tasks = ref([])
const createDialogVisible = ref(false)
const logDialogVisible = ref(false)
const loginInfoDialogVisible = ref(false)
const taskLogs = ref([])
const currentTask = ref(null)
const globalConfigVisible = ref(false)
const refreshInterval = ref(null)

const startAutoRefresh = () => {
  refreshInterval.value = setInterval(() => {
    fetchTasks()
  }, 10000) // 每10秒刷新一次
}

const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
}

// 获取任务列表
const fetchTasks = async () => {
  try {
    const response = await axios.get('/api/grab/tasks')
    tasks.value = response.data
  } catch (error) {
    ElMessage.error('获取任务列表失败')
  }
}

// 显示创建对话框
const showCreateDialog = () => {
  createDialogVisible.value = true
}

// 创建任务
const createTask = async (formData) => {
  try {
    await axios.post('/api/grab/tasks', formData)
    ElMessage.success('创建任务成功')
    createDialogVisible.value = false
    fetchTasks()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '创建任务失败')
  }
}

// 开始任务
const startTask = async (taskId) => {
  try {
    await axios.post(`/api/grab/tasks/${taskId}/start`)
    ElMessage.success('任务已开始')
    fetchTasks()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '开始任务失败')
  }
}

// 停止任务
const stopTask = async (taskId) => {
  try {
    await axios.post(`/api/grab/tasks/${taskId}/stop`)
    ElMessage.success('任务已停止')
    fetchTasks()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '停止任务失败')
  }
}

// 显示日志
const showLogs = async (taskId) => {
  try {
    const response = await axios.get(`/api/grab/tasks/${taskId}/logs`)
    taskLogs.value = response.data
    logDialogVisible.value = true
  } catch (error) {
    ElMessage.error('获取日志失败')
  }
}

// 显示登录信息
const showLoginInfo = async (taskId) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (task) {
    currentTask.value = task
    loginInfoDialogVisible.value = true
  }
}

// 确认删除
const confirmDelete = (task) => {
  ElMessageBox.confirm(
    '确定要删除这个任务吗？',
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      deleteTask(task.id)
    })
    .catch(() => {})
}

// 删除任务
const deleteTask = async (taskId) => {
  try {
    await axios.delete(`/api/grab/tasks/${taskId}`)
    ElMessage.success('删除任务成功')
    fetchTasks()
  } catch (error) {
    ElMessage.error('删除任务失败')
  }
}

// 格式化时间
const formatTime = (time) => {
  return new Date(time).toLocaleString()
}

// 获取日志类型
const getLogType = (level) => {
  const typeMap = {
    'ERROR': 'danger',
    'WARNING': 'warning',
    'SUCCESS': 'success',
    'INFO': 'info'
  }
  return typeMap[level] || 'info'
}

// 添加计算属性来处理实例列表
const instanceList = computed(() => {
  if (!currentTask.value) return [];
  
  const ips = currentTask.value.instance_ip ? currentTask.value.instance_ip.split(';') : [];
  const passwords = currentTask.value.instance_password ? currentTask.value.instance_password.split(';') : [];
  
  return ips.map((ip, index) => ({
    ip,
    password: passwords[index] || ''
  }));
});

// 添加显示全局配置对话框的方法
const showGlobalConfig = () => {
  globalConfigVisible.value = true
}

onMounted(() => {
  fetchTasks()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.log-content {
  max-height: 500px;
  overflow-y: auto;
}

.log-item {
  margin: 8px 0;
  padding: 8px;
  border-radius: 4px;
  background-color: #f5f7fa;
}

.log-time {
  color: #909399;
  margin-right: 10px;
}

.log-type {
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 10px;
}

.log-type.success { background-color: #f0f9eb; color: #67c23a; }
.log-type.error { background-color: #fef0f0; color: #f56c6c; }
.log-type.warning { background-color: #fdf6ec; color: #e6a23c; }
.log-type.info { background-color: #f4f4f5; color: #909399; }

.instance-info {
  margin-bottom: 20px;
}

.instance-info h3 {
  margin: 0 0 15px 0;
  color: #409EFF;
}
</style>