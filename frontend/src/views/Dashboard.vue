<template>
  <div class="dashboard">
    <div class="header">
      <div class="left">
        <h2>实例管理</h2>
        <el-select 
          v-model="selectedProfile" 
          placeholder="选择配置" 
          @change="fetchInstances"
          style="width: 200px"
        >
          <el-option
            v-for="profile in profiles"
            :key="profile.id"
            :label="profile.profile_name"
            :value="profile.id"
          />
        </el-select>
      </div>
    </div>

    <div class="instance-grid" v-if="selectedProfile">
      <el-card v-for="instance in instances" :key="instance.id" class="instance-card">
        <div class="instance-info">
          <h3>{{ instance.displayName }}</h3>
          <p><strong>状态：</strong>
            <el-tag :type="getStatusType(instance.lifecycleState)">
              {{ instance.lifecycleState }}
            </el-tag>
          </p>
          <p><strong>IP地址：</strong>{{ instance.publicIp || '获取中...' }}</p>
          <p><strong>规格：</strong>{{ instance.shape }}</p>
          <p><strong>配置：</strong>
            {{ instance.ocpus }} OCPU / 
            {{ instance.memoryInGBs }} GB 内存 / 
            {{ instance.bootVolumeSizeInGBs }} GB 硬盘
          </p>
          <p><strong>创建时间：</strong>{{ new Date(instance.timeCreated).toLocaleString() }}</p>
        </div>

        <div class="instance-actions">
          <el-button-group>
            <el-button 
              type="primary" 
              :disabled="instance.lifecycleState === 'RUNNING'"
              @click="startInstance(instance.id)"
            >
              启动
            </el-button>
            <el-button 
              type="warning"
              :disabled="instance.lifecycleState === 'STOPPED'"
              @click="stopInstance(instance.id)"
            >
              停止
            </el-button>
            <el-button 
              type="info"
              @click="changeIp(instance)"
            >
              更换IP
            </el-button>
            <el-button 
              type="primary"
              @click="showResizeDialog(instance)"
            >
              调整规格
            </el-button>
            <el-button 
              type="danger"
              @click="confirmDelete(instance)"
            >
              删除
            </el-button>
          </el-button-group>
        </div>
      </el-card>
    </div>

    <el-empty v-else description="请选择配置" />

    <el-dialog v-model="resizeDialogVisible" title="调整实例规格" width="500px">
      <el-form :model="resizeForm" label-width="100px">
        <el-form-item label="CPU (OCPU)">
          <el-input-number 
            v-model="resizeForm.ocpus" 
            :min="1" 
            :max="24"
            :step="1"
          />
        </el-form-item>
        <el-form-item label="内存 (GB)">
          <el-input-number 
            v-model="resizeForm.memoryInGBs" 
            :min="1" 
            :max="256"
            :step="1"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="resizeDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmResize">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const profiles = ref([])
const selectedProfile = ref('')
const instances = ref([])
const resizeDialogVisible = ref(false)
const resizeForm = ref({
  instanceId: '',
  ocpus: 1,
  memoryInGBs: 6
})

const fetchProfiles = async () => {
  try {
    const response = await axios.get('/api/oci-config')
    profiles.value = response.data
  } catch (error) {
    ElMessage.error('获取配置列表失败')
    console.error(error)
  }
}

const fetchInstances = async () => {
  if (!selectedProfile.value) return
  
  try {
    const response = await axios.get(`/api/instances?profile_id=${selectedProfile.value}`)
    instances.value = response.data
  } catch (error) {
    ElMessage.error('获取实例列表失败')
    console.error(error)
  }
}

const startInstance = async (instanceId) => {
  try {
    await axios.post(`/api/instances/${instanceId}/start?profile_id=${selectedProfile.value}`)
    ElMessage.success('实例启动成功')
    await fetchInstances()
  } catch (error) {
    ElMessage.error('实例启动失败')
    console.error(error)
  }
}

const stopInstance = async (instanceId) => {
  try {
    await axios.post(`/api/instances/${instanceId}/stop?profile_id=${selectedProfile.value}`)
    ElMessage.success('实例停止成功')
    await fetchInstances()
  } catch (error) {
    ElMessage.error('实例停止失败')
    console.error(error)
  }
}

const getStatusType = (status) => {
  const statusMap = {
    'RUNNING': 'success',
    'STOPPED': 'info',
    'STOPPING': 'warning',
    'STARTING': 'warning',
    'TERMINATED': 'danger'
  }
  return statusMap[status] || 'info'
}

const confirmDelete = async (instance) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除实例 ${instance.displayName} 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await deleteInstance(instance.id)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除实例失败')
      console.error(error)
    }
  }
}

const deleteInstance = async (instanceId) => {
  try {
    await axios.delete(`/api/instances/${instanceId}?profile_id=${selectedProfile.value}`)
    ElMessage.success('实例删除成功')
    await fetchInstances()
  } catch (error) {
    ElMessage.error('实例删除失败')
    console.error(error)
  }
}

const changeIp = async (instance) => {
  try {
    await ElMessageBox.confirm(
      '确定要更换该实例的IP吗？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await axios.post(`/api/instances/${instance.id}/change-ip?profile_id=${selectedProfile.value}`)
    ElMessage.success('IP更换成功')
    await fetchInstances()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('IP更换失败')
      console.error(error)
    }
  }
}

const showResizeDialog = (instance) => {
  resizeForm.value = {
    instanceId: instance.id,
    ocpus: instance.ocpus || 1,
    memoryInGBs: instance.memoryInGBs || 6
  }
  resizeDialogVisible.value = true
}

const confirmResize = async () => {
  try {
    await axios.post(`/api/instances/${resizeForm.value.instanceId}/resize`, {
      profile_id: selectedProfile.value,
      ocpus: resizeForm.value.ocpus,
      memoryInGBs: resizeForm.value.memoryInGBs
    })
    ElMessage.success('规格调整成功')
    resizeDialogVisible.value = false
    await fetchInstances()
  } catch (error) {
    ElMessage.error('规格调整失败')
    console.error(error)
  }
}

onMounted(() => {
  fetchProfiles()
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.instance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.instance-card {
  height: 100%;
}

.instance-info {
  margin: 15px 0;
}

.instance-info h3 {
  margin: 0 0 15px 0;
}

.instance-info p {
  margin: 8px 0;
}

.instance-actions {
  margin-top: 15px;
  display: flex;
  justify-content: center;
}
</style> 