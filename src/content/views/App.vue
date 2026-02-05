<template>
  <el-config-provider :locale="zhCn">
    <Affix @choose="handleClick" :trade-status="tradeStatus"> </Affix>
    <el-dialog v-model="visible" width="1240px" draggable>
      <trade-viewer
        class="h-70"
        :data="sellData"
        :trade-status="tradeStatus"
        :actual-electricity-volume="actualElectricityVolume"
        @trade="handleTrade"
        @cancel="handleCancel"
        @reset="handleReset"
        @continue="handleContinue"
      />
    </el-dialog>
    <!-- 交易/下一步交易等待倒计时（右上角浮动） -->
    <WaitCountdownDialog
      v-model="nextWaitVisible"
      :countdown-ms="nextWaitMs"
      :tip="nextWaitTip"
      @close="onNextWaitClose"
    />
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useBackgroundConnection } from '@/common/message/content';
import WaitCountdownDialog from '@/components/WaitCountdownDialog.vue';
import { getTimeLeftMs } from '@/utils/tradePriority';

const nextWaitVisible = ref(false);
const nextWaitMs = ref(0);
const nextWaitTip = ref('需等待以下时间后可摘牌：');
let nextWaitTimer: ReturnType<typeof setInterval> | null = null;
let nextWaitResolve: ((cancelled: boolean) => void) | null = null;

function showWaitCountdown(getCurrentMs: () => number | null): Promise<boolean> {
  return new Promise((resolve) => {
    nextWaitTip.value = '下一笔交易需等待以下时间后可摘牌：';
    nextWaitResolve = resolve;
    const ms = getCurrentMs();
    nextWaitMs.value = ms ?? 0;
    nextWaitVisible.value = true;
    if (nextWaitTimer) clearInterval(nextWaitTimer);
    nextWaitTimer = setInterval(() => {
      const current = getCurrentMs();
      if (current === null || current <= 0) {
        if (nextWaitTimer) clearInterval(nextWaitTimer);
        nextWaitTimer = null;
        nextWaitVisible.value = false;
        if (nextWaitResolve) {
          nextWaitResolve(false);
          nextWaitResolve = null;
        }
        return;
      }
      nextWaitMs.value = current;
    }, 1000);
  });
}

function onNextWaitClose(cancelled: boolean) {
  if (nextWaitTimer) clearInterval(nextWaitTimer);
  nextWaitTimer = null;
  nextWaitVisible.value = false;
  if (nextWaitResolve) {
    nextWaitResolve(cancelled);
    nextWaitResolve = null;
  } else {
    pendingTradeDataAfterWait = null;
  }
}

const {
  sellData,
  initIframe,
  tradeIframe,
  tradeStatus,
  cancelTradeIframe,
  resetTradeIframe,
  actualElectricityVolume,
  continueTradeIframe,
  requestSyncSellData,
} = useBackgroundConnection({ showWaitCountdown });
const visible = ref(false);
let syncTimer: ReturnType<typeof setInterval> | null = null;
const handleClick = () => {
  visible.value = true;
  initIframe();
};
watch(visible, (v) => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (v) {
    requestSyncSellData();
    syncTimer = setInterval(requestSyncSellData, 1000);
  }
});
onUnmounted(() => {
  if (syncTimer) clearInterval(syncTimer);
  if (nextWaitTimer) clearInterval(nextWaitTimer);
});
let pendingTradeDataAfterWait: { id: number; elecVolume: number }[] | null = null;

const handleTrade = (data: { id: number; elecVolume: number }[]) => {
  visible.value = false;
  const firstId = data[0]?.id;
  const item = firstId != null ? sellData.value.find((r) => r.gpid === firstId) : null;
  const ms = item ? getTimeLeftMs(item) : null;
  const hasCountdown = ms !== null && ms > 0;

  if (hasCountdown && firstId != null) {
    // 有倒计时：显示等待浮层，倒计时结束后再向 execution 发送交易请求
    pendingTradeDataAfterWait = data;
    if (nextWaitTimer) clearInterval(nextWaitTimer);
    nextWaitTip.value = '首笔交易需等待以下时间后可摘牌：';
    nextWaitResolve = null;
    nextWaitVisible.value = true;
    nextWaitMs.value = ms;
    const getCurrentMs = () => {
      const i = sellData.value.find((r) => r.gpid === firstId);
      return i ? getTimeLeftMs(i) : null;
    };
    nextWaitTimer = setInterval(() => {
      const current = getCurrentMs();
      if (current === null || current <= 0) {
        if (nextWaitTimer) clearInterval(nextWaitTimer);
        nextWaitTimer = null;
        nextWaitVisible.value = false;
        const toSend = pendingTradeDataAfterWait;
        pendingTradeDataAfterWait = null;
        if (toSend) tradeIframe(toSend);
        if (nextWaitResolve) {
          nextWaitResolve(false);
          nextWaitResolve = null;
        }
        return;
      }
      nextWaitMs.value = current;
    }, 1000);
  } else {
    // 无倒计时：立即向 execution 发送交易请求
    tradeIframe(data);
  }
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
.h-70 {
  height: 560px;
}
</style>
