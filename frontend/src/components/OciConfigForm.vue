<template>
  <div class="oci-config-form">
    <form @submit.prevent="submitConfig">
      <div class="form-group">
        <label>配置名称</label>
        <input v-model="config.profile_name" required>
      </div>
      <div class="form-group">
        <label>用户OCID</label>
        <input v-model="config.user_ocid" required>
      </div>
      <div class="form-group">
        <label>租户OCID</label>
        <input v-model="config.tenancy_ocid" required>
      </div>
      <div class="form-group">
        <label>区域</label>
        <input v-model="config.region" required>
      </div>
      <div class="form-group">
        <label>指纹</label>
        <input v-model="config.fingerprint" required>
      </div>
      <div class="form-group">
        <label>私钥</label>
        <textarea v-model="config.private_key" required></textarea>
      </div>
      <button type="submit">保存配置</button>
    </form>
  </div>
</template>

<script>
export default {
  data() {
    return {
      config: {
        profile_name: '',
        user_ocid: '',
        tenancy_ocid: '',
        region: '',
        fingerprint: '',
        private_key: ''
      }
    }
  },
  methods: {
    async submitConfig() {
      try {
        const response = await axios.post('/api/oci-config', this.config);
        if (response.status === 200) {
          alert('配置保存成功！');
        }
      } catch (error) {
        console.error('保存配置失败:', error);
      }
    }
  }
}
</script> 