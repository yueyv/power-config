<template>
  <el-config-provider :locale="zhCn">
    <Affix @choose="handleClick" :trade-status="tradeStatus"> </Affix>
    <el-dialog v-model="visible" width="840px" draggable>
      <trade-viewer
        class="h-60"
        :data="sellData"
        :trade-status="tradeStatus"
        :actual-electricity-volume="actualElectricityVolume"
        @trade="handleTrade"
        @cancel="handleCancel"
        @reset="handleReset"
        @continue="handleContinue"
      />
    </el-dialog>
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { onMounted, ref } from 'vue';
import { useBackgroundConnection } from '@/common/message/content';
const {
  sellData,
  initIframe,
  tradeIframe,
  tradeStatus,
  cancelTradeIframe,
  resetTradeIframe,
  actualElectricityVolume,
  continueTradeIframe,
} = useBackgroundConnection();
const visible = ref(false);
const handleClick = () => {
  visible.value = true;
};
const handleTrade = (data: { id: number; elecVolume: number }[]) => {
  tradeIframe(data);
  visible.value = false;
};
const handleCancel = () => {
  cancelTradeIframe();
};
const handleReset = () => {
  resetTradeIframe();
};
const handleContinue = () => {
  continueTradeIframe();
};
onMounted(() => {
  initIframe();
});
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
