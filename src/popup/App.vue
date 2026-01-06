<template>
  <el-config-provider :locale="zhCn">
    <LogViewer />
  </el-config-provider>
</template>
<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
</script>
