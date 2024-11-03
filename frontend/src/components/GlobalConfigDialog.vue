<template>
  <el-dialog 
    v-model="dialogVisible" 
    title="全局配置" 
    width="600px"
    @close="handleClose"
  >
    <el-form :model="config" label-width="140px">
      <el-form-item label="启用自动抢机">
        <el-switch v-model="config.auto_grab_enabled" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="saveConfig">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible'])

const dialogVisible = ref(props.visible)
const config = ref({
  auto_grab_enabled: false
})

watch(() => props.visible, (val) => {
  dialogVisible.value = val
  if (val) {
    fetchConfig()
  }
})

const handleClose = () => {
  dialogVisible.value = false
  emit('update:visible', false)
}

const fetchConfig = async () => {
  try {
    const response = await axios.get('/api/config/global')
    config.value = response.data || { auto_grab_enabled: false }
  } catch (error) {
    ElMessage.error('获取配置失败')
  }
}

const saveConfig = async () => {
  try {
    await axios.post('/api/config/global', config.value)
    ElMessage.success('保存配置成功')
    handleClose()
  } catch (error) {
    console.error('保存配置失败', error)
    ElMessage.error('保存配置失败')
  }
}
</script> 