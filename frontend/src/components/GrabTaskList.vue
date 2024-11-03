<template>
  <div class="grab-task-list">
    <el-table :data="tasks">
      <el-table-column prop="profile_name" label="配置名称" />
      <el-table-column label="实例规格" min-width="200">
        <template #default="{ row }">
          <div>{{ row.shape }}</div>
          <div class="specs">{{ row.ocpus }} OCPU / {{ row.memory_in_gbs }} GB</div>
        </template>
      </el-table-column>
      <el-table-column prop="availability_domain" label="可用区" />
      <el-table-column label="抢机进度" width="120" align="center">
        <template #default="{ row }">
          <el-progress 
            :percentage="Math.round((row.current_count / row.target_count) * 100)"
            :format="() => `${row.current_count}/${row.target_count}`"
            :status="row.current_count >= row.target_count ? 'success' : ''"
          />
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" :formatter="formatTime" />
      <el-table-column label="操作" width="280">
        <template #default="{ row }">
          <el-button-group>
            <el-button 
              v-if="row.status === 'stopped'"
              type="primary"
              @click="$emit('start', row.id)"
            >
              开始
            </el-button>
            <el-button 
              v-if="row.status === 'running'"
              type="danger"
              @click="$emit('stop', row.id)"
            >
              停止
            </el-button>
            <el-button
              type="primary"
              @click="$emit('show-logs', row.id)"
            >
              日志
            </el-button>
            <el-button
              v-if="row.status === 'success'"
              type="success"
              @click="$emit('showLoginInfo', row.id)"
            >
              登录信息
            </el-button>
            <el-button
              v-if="row.status !== 'running'"
              type="danger"
              @click="$emit('delete', row)"
            >
              删除
            </el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const props = defineProps({
  tasks: {
    type: Array,
    required: true
  }
})

const nextRunTimes = ref({})
const countdownTimers = {}

defineEmits(['create', 'start', 'stop', 'showLogs', 'showLoginInfo', 'delete'])

// 获取状态类型
const getStatusType = (status) => {
  const types = {
    'running': 'primary',
    'success': 'success',
    'failed': 'danger',
    'stopped': 'info'
  }
  return types[status] || 'info'
}

// 获取状态文本
const getStatusText = (status) => {
  const texts = {
    'running': '运行中',
    'success': '成功',
    'failed': '失败',
    'stopped': '已停止',
    'waiting': '等待中'
  }
  return texts[status] || status
}

// 格式化时间
const formatTime = (row, column, cellValue) => {
  return new Date(cellValue).toLocaleString()
}

// 格式化倒计时
const formatCountdown = (seconds) => {
  if (!seconds || seconds <= 0) return '-'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes > 0 
    ? `${minutes}分${remainingSeconds}秒后重试`
    : `${remainingSeconds}秒后重试`
}


// 开始倒计时
const startCountdown = (taskId, initialSeconds) => {
  if (countdownTimers[taskId]) {
    clearInterval(countdownTimers[taskId])
  }
  
  nextRunTimes.value[taskId] = initialSeconds
  
  countdownTimers[taskId] = setInterval(() => {
    if (nextRunTimes.value[taskId] > 0) {
      nextRunTimes.value[taskId]--
    } else {
      clearInterval(countdownTimers[taskId])
      delete nextRunTimes.value[taskId]
    }
  }, 1000)
}

// 监听任务状态变化
watch(() => props.tasks, (newTasks) => {
  newTasks.forEach(task => {
    if (task.status === 'running' || task.status === 'waiting') {
      if (countdownTimers[task.id]) {
        clearInterval(countdownTimers[task.id])
        delete countdownTimers[task.id]
      }
      delete nextRunTimes.value[task.id]
    } else {
      if (countdownTimers[task.id]) {
        clearInterval(countdownTimers[task.id])
        delete countdownTimers[task.id]
      }
      delete nextRunTimes.value[task.id]
    }
  })
}, { deep: true, immediate: true })

// 组件卸载时清理定时器
onUnmounted(() => {
  Object.values(countdownTimers).forEach(timer => clearInterval(timer))
})
</script>

<style scoped>
.specs {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.el-progress {
  margin: 0;
  width: 90%;
}
</style> 