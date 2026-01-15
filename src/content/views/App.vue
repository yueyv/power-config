<template>
  <el-config-provider :locale="zhCn">
    <Affix @choose="handleClick" :trade-status="tradeStatus"> </Affix>
    <el-dialog v-model="visible" width="840px">
      <trade-viewer
        class="h-60"
        :data="sellData"
        :trade-status="tradeStatus"
        @trade="handleTrade"
        @cancel="handleCancel"
      />
    </el-dialog>
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { ref } from 'vue';
import { useBackgroundConnection } from '@/common/message/content';
const { sellData, initIframe, tradeIframe, tradeStatus, cancelTradeIframe } =
  useBackgroundConnection();
const visible = ref(false);
const handleClick = () => {
  visible.value = true;
  initIframe();
};
const handleTrade = (data: { id: number; elecVolume: number }[]) => {
  tradeIframe(data);
  setTimeout(() => {
    visible.value = false;
  }, 1000);
};
const handleCancel = () => {
  cancelTradeIframe();
};
</script>
<style scoped lang="scss">
.h-60 {
  height: 480px;
}
</style>
<style>
.current-choice {
  background-color: #5d9eff;
}
.next-choice {
  background-color: #ffc4c4;
}
.prev-choice {
  background-color: #75ff5d;
}
</style>
