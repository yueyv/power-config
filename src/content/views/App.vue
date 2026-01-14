<template>
  <el-config-provider :locale="zhCn">
    <Affix @choose="handleClick"> </Affix>
    <el-dialog v-model="visible" width="800px">
      <trade-viewer class="h-60" />
    </el-dialog>
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { ref } from 'vue';
const visible = ref(false);
const handleClick = () => {
  visible.value = true;
};
</script>
<style scoped lang="scss">
.h-60 {
  height: 480px;
}
</style>
