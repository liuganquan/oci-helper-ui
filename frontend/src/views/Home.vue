<template>
  <div class="page-container">
    <div class="header">
      <h2>OCI配置管理</h2>
      <el-button type="primary" @click="showAddConfig">添加配置</el-button>
    </div>

    <el-card>
      <el-table :data="configs">
        <el-table-column prop="profile_name" label="配置名称" />
        <el-table-column prop="region" label="区域" />
        <el-table-column prop="created_at" label="创建时间" :formatter="formatDate" />
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button-group>
              <el-button 
                type="danger" 
                size="small" 
                @click="deleteConfig(scope.row.id)"
              >
                删除
              </el-button>
              <el-button
                type="primary"
                size="small"
                @click="viewConfig(scope.row)"
              >
                查看
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加配置对话框 -->
    <el-dialog v-model="dialogVisible" title="添加OCI配置" width="60%">
      <el-form :model="configForm" label-width="120px">
        <el-form-item label="配置名称" required>
          <el-input v-model="configForm.profile_name" />
        </el-form-item>
        <el-form-item label="用户OCID" required>
          <el-input v-model="configForm.user_ocid" />
        </el-form-item>
        <el-form-item label="租户OCID" required>
          <el-input v-model="configForm.tenancy_ocid" />
        </el-form-item>
        <el-form-item label="区域" required>
          <el-input v-model="configForm.region" />
        </el-form-item>
        <el-form-item label="指纹" required>
          <el-input v-model="configForm.fingerprint" />
        </el-form-item>
        <el-form-item label="私钥" required>
          <el-input
            v-model="configForm.private_key"
            type="textarea"
            :rows="8"
            placeholder="请输入私钥内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitConfig">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 查看配置对话框 -->
    <el-dialog v-model="viewDialogVisible" title="查看配置详情" width="60%">
      <div v-if="currentConfig" class="config-details">
        <p><strong>配置名称：</strong>{{ currentConfig.profile_name }}</p>
        <p><strong>用户OCID：</strong>{{ currentConfig.user_ocid }}</p>
        <p><strong>租户OCID：</strong>{{ currentConfig.tenancy_ocid }}</p>
        <p><strong>区域：</strong>{{ currentConfig.region }}</p>
        <p><strong>指纹：</strong>{{ currentConfig.fingerprint }}</p>
        <p><strong>创建时间：</strong>{{ new Date(currentConfig.created_at).toLocaleString() }}</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const configs = ref([])
const dialogVisible = ref(false)
const viewDialogVisible = ref(false)
const currentConfig = ref(null)

const configForm = ref({
  profile_name: '',
  user_ocid: '',
  tenancy_ocid: '',
  region: '',
  fingerprint: '',
  private_key: ''
})

const showAddConfig = () => {
  console.log('showAddConfig clicked') // 调试日志
  configForm.value = {
    profile_name: '',
    user_ocid: '',
    tenancy_ocid: '',
    region: '',
    fingerprint: '',
    private_key: ''
  }
  dialogVisible.value = true
}

const submitConfig = async () => {
  console.log('submitConfig clicked') // 调试日志
  try {
    // 表单验证
    if (!configForm.value.profile_name || 
        !configForm.value.user_ocid || 
        !configForm.value.tenancy_ocid || 
        !configForm.value.region || 
        !configForm.value.fingerprint || 
        !configForm.value.private_key) {
      ElMessage.warning('请填写所有必填字段')
      return
    }

    console.log('Submitting config:', configForm.value) // 调试日志
    const response = await axios.post('/api/oci-config', configForm.value)
    console.log('Response:', response) // 调试日志

    ElMessage.success('配置添加成功')
    dialogVisible.value = false
    await fetchConfigs()
  } catch (error) {
    console.error('Error submitting config:', error) // 调试日志
    ElMessage.error(error.response?.data?.error || '配置添加失败')
  }
}

const fetchConfigs = async () => {
  try {
    console.log('Fetching configs') // 调试日志
    const response = await axios.get('/api/oci-config')
    console.log('Fetched configs:', response.data) // 调试日志
    configs.value = response.data
  } catch (error) {
    console.error('Error fetching configs:', error) // 调试日志
    ElMessage.error('获取配置列表失败')
  }
}

const deleteConfig = async (id) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除此配置吗？删除后无法恢复。',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await axios.delete(`/api/oci-config/${id}`)
    ElMessage.success('配置删除成功')
    await fetchConfigs()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除配置失败:', error)
      ElMessage.error(error.response?.data?.error || '配置删除失败')
    }
  }
}

const formatDate = (row, column) => {
  const date = new Date(row[column.property])
  return date.toLocaleString()
}

const viewConfig = (config) => {
  currentConfig.value = config
  viewDialogVisible.value = true
}

onMounted(() => {
  fetchConfigs()
})
</script>

<style scoped>
.config-details {
  padding: 20px;
}

.config-details p {
  margin: 10px 0;
  line-height: 1.5;
}

.config-details strong {
  color: #606266;
  margin-right: 10px;
}
</style> 