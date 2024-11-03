<template>
  <el-dialog 
    v-model="dialogVisible" 
    title="创建抢机任务" 
    width="60%"
    @open="handleDialogOpen"
  >
    <el-form :model="form" label-width="120px" :rules="rules" ref="formRef">
      <el-form-item label="配置文件" prop="profile_id">
        <el-select 
          v-model="form.profile_id" 
          placeholder="选择配置文件"
          @change="handleProfileChange"
        >
          <el-option
            v-for="config in configs"
            :key="config.id"
            :label="config.profile_name"
            :value="config.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="实例类型" prop="shape">
        <el-select 
          v-model="form.shape" 
          placeholder="选择实例类型"
          :disabled="!form.profile_id"
          @change="handleShapeChange"
        >
          <el-option
            v-for="shape in shapes"
            :key="shape.shape"
            :label="shape.displayName"
            :value="shape.shape"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="系统镜像" prop="image_id">
        <el-select 
          v-model="form.image_id" 
          placeholder="选择系统镜像"
          :disabled="!form.shape"
          :loading="imagesLoading"
        >
          <el-option
            v-for="image in images"
            :key="image.id"
            :label="`${image.displayName}`"
            :value="image.id"
          />
        </el-select>
      </el-form-item>

    
      <el-form-item label="CPU (OCPU)" prop="ocpus">
        <el-select 
          v-model="form.ocpus" 
          placeholder="选择CPU数量"
          style="width: 180px"
        >
          <el-option
            v-for="cpu in presetCPUs"
            :key="cpu"
            :label="`${cpu} OCPU`"
            :value="cpu"
          />
          <el-option label="自定义" value="custom">
            <el-input-number 
              v-model="form.customOcpus"
              :min="1"
              :max="24"
              @change="handleCustomCPUChange"
              style="width: 120px"
            />
            OCPU
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="内存" prop="memoryInGBs">
        <el-select 
          v-model="form.memoryInGBs" 
          placeholder="选择内存大小"
          style="width: 180px"
        >
          <el-option
            v-for="memory in presetMemory"
            :key="memory"
            :label="`${memory} GB`"
            :value="memory"
          />
          <el-option label="自定义" value="custom">
            <el-input-number 
              v-model="form.customMemory"
              :min="1"
              :max="128"
              @change="handleCustomMemoryChange"
              style="width: 120px"
            />
            GB
          </el-option>
        </el-select>
      </el-form-item>
     

      <el-form-item label="可用区" prop="availability_domain">
        <el-select 
          v-model="form.availability_domain" 
          placeholder="选择可用区"
          :disabled="!form.profile_id"
        >
          <el-option
            v-for="ad in availabilityDomains"
            :key="ad.name"
            :label="ad.name"
            :value="ad.name"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="启动卷大小" prop="boot_volume_size">
        <el-input-number 
          v-model="form.boot_volume_size" 
          :min="50"
          :max="200"
          :step="10"
        />
        <span class="unit">GB</span>
      </el-form-item>

      <el-form-item label="等待时间" prop="wait_time">
        <el-input-number 
          v-model="form.wait_time" 
          :min="10"
          :max="300"
          :step="10"
        />
        <span class="unit">秒</span>
      </el-form-item>

      <el-form-item label="认证方式" prop="auth_type">
        <el-radio-group v-model="form.auth_type">
          <el-radio label="password">密码</el-radio>
          <el-radio label="ssh">SSH密钥</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item 
        v-if="form.auth_type === 'ssh'" 
        label="SSH公钥" 
        prop="ssh_key"
      >
        <el-input 
          v-model="form.ssh_key" 
          type="textarea" 
          rows="4"
          placeholder="请输入SSH公钥"
        />
      </el-form-item>

      <el-form-item label="目标数量" prop="target_count">
        <el-input-number 
          v-model="form.target_count" 
          :min="1" 
          :max="10"
          :step="1"
          controls-position="right"
        />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:visible', 'submit'])

const dialogVisible = ref(props.visible)
const configs = ref([])
const shapes = ref([])
const formRef = ref(null)

// 预设的 CPU 和内存选项
const presetCPUs = [1, 2, 4, 16]
const presetMemory = [1, 12, 24, 96]

const images = ref([])
const imagesLoading = ref(false)
const availabilityDomains = ref([])

const form = ref({
  profile_id: '',
  shape: '',
  image_id: '',
  ocpus: 1,
  customOcpus: 1,
  memoryInGBs: 6,
  customMemory: 6,
  availability_domain: '',
  boot_volume_size: 50,
  wait_time: 30,
  auth_type: 'password',
  ssh_key: '',
  target_count: 1
})

const rules = {
  profile_id: [{ required: true, message: '请选择配置文件', trigger: 'change' }],
  shape: [{ required: true, message: '请选择实例类型', trigger: 'change' }],
  availability_domain: [{ required: true, message: '请选择可用区', trigger: 'change' }],
  ssh_key: [{ 
    required: true, 
    message: '请输入SSH公钥', 
    trigger: 'blur',
    validator: (rule, value, callback) => {
      if (form.value.auth_type === 'ssh' && !value) {
        callback(new Error('请输入SSH公钥'))
      } else {
        callback()
      }
    }
  }],
  image_id: [{ required: true, message: '请选择系统镜像', trigger: 'change' }],
  target_count: [
    { required: true, message: '请输入目标数量', trigger: 'change' },
    { type: 'number', min: 1, max: 10, message: '数量必须在1-10之间', trigger: 'change' }
  ]
}

// 监听visible属性变化
watch(() => props.visible, (val) => {
  dialogVisible.value = val
})

// 监听对话框状态变化
watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

// 获取配置列表
const fetchConfigs = async () => {
  try {
    const response = await axios.get('/api/oci-config')
    configs.value = response.data
  } catch (error) {
    ElMessage.error('获取配置列表失败')
    console.error('获取配置列表失败:', error)
  }
}

// 获取实例类型列表
const fetchShapes = async (profileId) => {
  try {
    const response = await axios.get(`/api/instances/shapes?profile_id=${profileId}`)
    shapes.value = response.data
  } catch (error) {
    ElMessage.error('获取实例类型列表失败')
    console.error('获取实例类型列表失败:', error)
  }
}

// ��取可用区列表
const fetchAvailabilityDomains = async (profileId) => {
  try {
    const response = await axios.get(`/api/instances/availability-domains?profile_id=${profileId}`)
    availabilityDomains.value = response.data
  } catch (error) {
    ElMessage.error('获取可用区列表失败')
    console.error('获取可用区列表失败:', error)
  }
}

// 获取镜像列表
const fetchImages = async (shape) => {
  if (!form.value.profile_id || !shape) return
  
  imagesLoading.value = true
  try {
    const response = await axios.get(`/api/instances/images`, {
      params: {
        profile_id: form.value.profile_id,
        shape: shape
      }
    })
    images.value = response.data
  } catch (error) {
    ElMessage.error('获取镜像列表失败')
    console.error('获取镜像列表失败:', error)
  } finally {
    imagesLoading.value = false
  }
}

// 打开对话框时
const handleDialogOpen = () => {
  fetchConfigs()
  form.value = {
    profile_id: '',
    shape: '',
    image_id: '',
    ocpus: 1,
    customOcpus: 1,
    memoryInGBs: 6,
    customMemory: 6,
    availability_domain: '',
    boot_volume_size: 50,
    wait_time: 30,
    auth_type: 'password',
    ssh_key: '',
    target_count: 1
  }
  shapes.value = []
  images.value = []
  availabilityDomains.value = []
}

// 选择配置文件时
const handleProfileChange = async (profileId) => {
  form.value.shape = ''
  form.value.image_id = ''
  form.value.availability_domain = ''
  shapes.value = []
  images.value = []
  availabilityDomains.value = []
  
  if (profileId) {
    await Promise.all([
      fetchShapes(profileId),
      fetchAvailabilityDomains(profileId)
    ])
  }
}

// 选择实例类型时
const handleShapeChange = async (shape) => {
  form.value.image_id = ''
  images.value = []
  
  // 设置默认值
  form.value.ocpus = 1
  form.value.memoryInGBs = 6
  
  if (shape) {
    await fetchImages(shape)
  }
}

// 处理自定义 CPU 变化
const handleCustomCPUChange = (value) => {
  if (form.value.ocpus === 'custom') {
    form.value.ocpus = value
  }
}

// 处理自定义内存变化
const handleCustomMemoryChange = (value) => {
  if (form.value.memoryInGBs === 'custom') {
    form.value.memoryInGBs = value
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    
    const submitData = {
      ...form.value,
      ocpus: Number(form.value.ocpus === 'custom' ? form.value.customOcpus : form.value.ocpus),
      memory_in_gbs: Number(form.value.memoryInGBs === 'custom' ? form.value.customMemory : form.value.memoryInGBs),
      target_count: Number(form.value.target_count)
    }

    // 删除不需要的字段
    delete submitData.customOcpus
    delete submitData.memoryInGBs
    delete submitData.customMemory

    // 如果是密码认证，删除 ssh_key
    if (submitData.auth_type === 'password') {
      delete submitData.ssh_key
    }

    emit('submit', submitData)
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}
</script>

<style scoped>
.unit {
  margin-left: 10px;
  color: #666;
}

.el-select {
  width: 100%;
}
</style> 