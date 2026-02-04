<template>
  <div class="elec-viewer">
    <div class="elec-header">
      <h2 class="elec-title">电力交易</h2>
      <div class="elec-input">
        <el-button
          type="danger"
          v-if="tradeStatus === TRADE_STATUS.TRADE"
          @click="handleCancelClick"
          >终止</el-button
        >
        <el-button
          type="primary"
          v-if="tradeStatus === TRADE_STATUS.CANCEL_TRADE"
          @click="handleContinueClick"
          >继续</el-button
        >
        <el-button
          type="primary"
          v-if="choiceSellData.length > 0 && tradeStatus === TRADE_STATUS.DISPLAY"
          @click="handleTradeClick"
          >交易</el-button
        >

        <el-button
          type="primary"
          v-if="tradeStatus === TRADE_STATUS.COMPLETE || tradeStatus === TRADE_STATUS.CANCEL_TRADE"
          @click="handleResetClick"
          >重置</el-button
        >
        <el-input
          v-model="electricityVolume"
          :disabled="tradeStatus === TRADE_STATUS.TRADE || tradeStatus === TRADE_STATUS.COMPLETE"
          placeholder="拟交易电量"
          style="width: 280px"
        >
          <template #prepend>
            <span>拟交易电量</span>
          </template>
          <template #suffix>
            <span>kWh</span>
          </template>
        </el-input>
        <div class="elec-stats">
          <span class="stat-item" v-if="tradeStatus === TRADE_STATUS.DISPLAY"
            >总计:
            {{
              choiceSellDataTotal < electricityVolume ? choiceSellDataTotal : electricityVolume
            }}</span
          >
          <span class="stat-item" v-else>实际购买量: {{ actualElectricityVolume }}</span>
        </div>
      </div>
    </div>
    <el-auto-resizer>
      <template #default="{ height, width }">
        <el-table-v2
          :columns="columns"
          :data="orderedViewData"
          :width="width"
          :height="height"
          fixed
          class="elec-table"
        />
      </template>
    </el-auto-resizer>
  </div>
</template>

<script setup lang="ts">
import 'element-plus/theme-chalk/el-button.css';
import 'element-plus/theme-chalk/el-message.css';
import 'element-plus/theme-chalk/el-message-box.css';
import 'element-plus/theme-chalk/el-dialog.css';
import 'element-plus/theme-chalk/el-checkbox.css';
import 'element-plus/theme-chalk/el-table-v2.css';
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue';
import { CheckboxValueType, ElButton, ElCheckbox, ElMessageBox } from 'element-plus';
import { TRADE_STATUS } from '@/constants';
import { getTimeLeftMs } from '@/utils/tradePriority';
import {
  getChoiceSellData,
  getTradeElectricityVolume,
  setTradeElectricityVolume,
} from '@/model/sellData';
const electricityVolume = ref(0);
const emits = defineEmits(['trade', 'manual-trade', 'cancel', 'reset', 'continue']);
const props = defineProps<{
  diaelecHeight?: number;
  data: SELL_DATA_ITEM[];
  tradeStatus: string;
  actualElectricityVolume: number;
}>();

const choiceSellData = ref<number[]>([]);
/** 每秒更新，用于驱动倒计时列用「当前时间戳」与「摘牌时间戳」重新计算并刷新 */
const countdownTick = ref(0);

const eligible = computed(() =>
  props.data.filter((item) => item.bfcj === '是' && item.dprice === item.xhprice)
);
/** 表格只按挂牌价格排序；数据源变化时重置 */
const orderedViewData = ref<SELL_DATA_ITEM[]>([]);
watch(
  eligible,
  (el) => {
    orderedViewData.value = [...el].sort((a, b) => (a.gpdj ?? 0) - (b.gpdj ?? 0));
  },
  { immediate: true }
);

/** 选中项按挂牌价格 + 倒计时排序：价格升序，同价则无倒计时在前、再按剩余时间升序 */
function sortSelectedByPriceAndCountdown(gpids: number[]): number[] {
  const list = orderedViewData.value;
  return [...gpids]
    .map((gpid) => list.find((r) => r.gpid === gpid))
    .filter((item): item is SELL_DATA_ITEM => !!item)
    .sort((a, b) => {
      const pa = a.gpdj ?? 0;
      const pb = b.gpdj ?? 0;
      if (pa !== pb) return pa - pb;
      const ta = getTimeLeftMs(a);
      const tb = getTimeLeftMs(b);
      if (ta === null && tb === null) return 0;
      if (ta === null) return -1;
      if (tb === null) return 1;
      return ta - tb;
    })
    .map((r) => r.gpid);
}

const choiceSellDataTotal = computed(() => {
  return choiceSellData.value.reduce(
    (acc, curr) => acc + (orderedViewData.value.find((item) => item.gpid === curr)?.sydl || 0),
    0
  );
});

/** 在 choiceSellData 内上移交易顺序（仅对已参与交易的项生效） */
function moveOrderUp(gpid: number) {
  if (props.tradeStatus !== TRADE_STATUS.DISPLAY) return;
  const arr = choiceSellData.value;
  const idx = arr.indexOf(gpid);
  if (idx <= 0) return;
  choiceSellData.value = [...arr.slice(0, idx - 1), arr[idx], arr[idx - 1], ...arr.slice(idx + 1)];
}
/** 在 choiceSellData 内下移交易顺序 */
function moveOrderDown(gpid: number) {
  if (props.tradeStatus !== TRADE_STATUS.DISPLAY) return;
  const arr = choiceSellData.value;
  const idx = arr.indexOf(gpid);
  if (idx < 0 || idx >= arr.length - 1) return;
  choiceSellData.value = [...arr.slice(0, idx), arr[idx + 1], arr[idx], ...arr.slice(idx + 2)];
}
/** 倒计时 = 摘牌时间戳(availableAtMs) - 当前时间戳(Date.now())，由 getTimeLeftMs 内部计算 */
/** 倒计时分级：≤30s 即将到期，≤2min 紧急，≤5min 注意，其余正常 */
function getCountdownLabel(ms: number): { label: string; className: string } {
  if (ms <= 30_000) return { label: '即将到期', className: 'countdown-cell--critical' };
  if (ms <= 120_000) return { label: '紧急', className: 'countdown-cell--urgent' };
  if (ms <= 300_000) return { label: '注意', className: 'countdown-cell--warn' };
  return { label: '正常', className: 'countdown-cell--normal' };
}

function formatCountdownTime(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  const hh = Math.floor(t / 3600);
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

const columns = ref<any>([
  {
    key: 'countdown',
    title: '倒计时',
    width: 140,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: SELL_DATA_ITEM }) => {
      void countdownTick.value; // 依赖 tick，使倒计时每秒用当前时间戳与摘牌时间戳重算
      const ms = getTimeLeftMs(rowData);
      if (ms === null) {
        return h('div', { class: 'countdown-cell countdown-cell--none' }, [
          h('span', { class: 'countdown-time' }, '-'),
          h('span', { class: 'countdown-tag' }, '—'),
        ]);
      }
      const { label, className } = getCountdownLabel(ms);
      const timeText = formatCountdownTime(ms);
      return h('div', { class: ['countdown-cell', className] }, [
        h('span', { class: 'countdown-time' }, timeText),
        h('span', { class: 'countdown-tag' }, label),
      ]);
    },
  },
  {
    key: 'selection',
    width: 50,
    align: 'center',
    dataKey: 'selection',
    cellRenderer: ({ rowData }: { rowData: SELL_DATA_ITEM }) => {
      return h(ElCheckbox, {
        modelValue: choiceSellData.value.includes(rowData.gpid),
        key: rowData.gpid,
        disabled:
          (choiceSellDataTotal.value >= electricityVolume.value &&
            !choiceSellData.value.includes(rowData.gpid)) ||
          props.tradeStatus !== TRADE_STATUS.DISPLAY,
        onChange: (value: CheckboxValueType) => {
          if (value) {
            choiceSellData.value = sortSelectedByPriceAndCountdown([
              ...choiceSellData.value,
              rowData.gpid,
            ]);
          } else {
            choiceSellData.value = choiceSellData.value.filter((id) => id !== rowData.gpid);
          }
        },
      });
    },
    headerCellRenderer: () => {
      return h(ElCheckbox, {
        modelValue:
          choiceSellDataTotal.value >= electricityVolume.value && choiceSellDataTotal.value > 0,
        indeterminate:
          choiceSellDataTotal.value > 0 && choiceSellDataTotal.value < electricityVolume.value,
        disabled: props.tradeStatus !== TRADE_STATUS.DISPLAY,
        onChange: (value: CheckboxValueType) => {
          if (value) {
            const list = orderedViewData.value;
            const nextGpids = [...choiceSellData.value];
            let volumeSoFar = choiceSellDataTotal.value;
            let i = 0;
            while (volumeSoFar < electricityVolume.value && i < list.length) {
              const item = list[i];
              if (!nextGpids.includes(item.gpid)) {
                nextGpids.push(item.gpid);
                volumeSoFar += item.sydl ?? 0;
              }
              i++;
            }
            choiceSellData.value = sortSelectedByPriceAndCountdown(nextGpids);
          } else {
            choiceSellData.value = [];
          }
        },
      });
    },
  },
  {
    key: 'order',
    title: '顺序',
    width: 60,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: SELL_DATA_ITEM }) => {
      console.log(choiceSellData.value);
      const idx = choiceSellData.value.indexOf(rowData.gpid);
      if (idx < 0) return h('span', { class: 'order-empty' }, '—');
      return h('span', { class: 'order-num' }, String(idx + 1));
    },
  },
  {
    key: 'orderAdjust',
    title: '调整',
    width: 90,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: SELL_DATA_ITEM }) => {
      if (!choiceSellData.value.includes(rowData.gpid))
        return h('span', { class: 'order-empty' }, '—');
      const idx = choiceSellData.value.indexOf(rowData.gpid);
      const canUp = idx > 0 && props.tradeStatus === TRADE_STATUS.DISPLAY;
      const canDown =
        idx < choiceSellData.value.length - 1 && props.tradeStatus === TRADE_STATUS.DISPLAY;
      return h('div', { class: 'order-actions' }, [
        h(
          ElButton,
          { size: 'small', disabled: !canUp, onClick: () => moveOrderUp(rowData.gpid) },
          () => '↑'
        ),
        h(
          ElButton,
          { size: 'small', disabled: !canDown, onClick: () => moveOrderDown(rowData.gpid) },
          () => '↓'
        ),
      ]);
    },
  },
  {
    key: 'manualAction',
    title: '操作',
    width: 80,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: SELL_DATA_ITEM }) => {
      return h(
        ElButton,
        {
          size: 'small',
          type: 'primary',
          plain: true,
          disabled: props.tradeStatus !== TRADE_STATUS.DISPLAY,
          onClick: () => scrollToRow(rowData),
        },
        () => '定位'
      );
    },
  },

  {
    key: 'gpid',
    title: '唯一id',
    width: 100,
    align: 'center',
    dataKey: 'gpid',
  },
  {
    key: 'gpdl',
    title: '挂牌电量',
    width: 100,
    align: 'center',
    dataKey: 'gpdl',
  },
  {
    key: 'sydl',
    title: '剩余电量',
    width: 100,
    align: 'center',
    dataKey: 'sydl',
  },
  {
    key: 'gpdj',
    title: '挂牌价格',
    width: 100,
    align: 'center',
    dataKey: 'gpdj',
  },
  {
    key: 'dprice',
    title: 'D1曲线现货价值',
    width: 150,
    align: 'center',
    dataKey: 'dprice',
  },
  {
    key: 'xhprice',
    title: '该曲线现货价值',
    width: 150,
    align: 'center',
    dataKey: 'xhprice',
  },
  {
    key: 'bfcj',
    title: '部分成交',
    width: 100,
    align: 'center',
    dataKey: 'bfcj',
  },
]);

/** 确认并发送交易；发送后由父组件立刻显示等待倒计时（若有） */
async function handleTradeClick() {
  const tradeData = buildTradeData();
  if (tradeData.length === 0) return;
  await ElMessageBox.confirm(
    `确定要交易吗？拟交易电量：${
      electricityVolume.value
    }kWh，交易挂牌id：${choiceSellData.value.join(',')}`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    }
  );
  setTradeElectricityVolume(electricityVolume.value);
  emits('trade', tradeData);
}

const buildTradeData = (): { id: number; elecVolume: number }[] => {
  const tradeData: { id: number; elecVolume: number }[] = [];
  let currentVolume = 0;
  const list = orderedViewData.value;
  choiceSellData.value.forEach((gpid) => {
    const item = list.find((r) => r.gpid === gpid);
    if (!item) return;
    if (currentVolume + item.sydl <= electricityVolume.value) {
      currentVolume += item.sydl;
      tradeData.push({ id: item.gpid, elecVolume: item.sydl });
    } else {
      tradeData.push({
        id: item.gpid,
        elecVolume: electricityVolume.value - currentVolume,
      });
    }
  });
  return tradeData;
};

/** 操作列：仅滚动到该行对应的交易项（单列定位） */
function scrollToRow(row: SELL_DATA_ITEM) {
  emits('manual-trade', [{ id: row.gpid, elecVolume: row.sydl ?? 0 }]);
}

const handleCancelClick = async () => {
  await ElMessageBox.confirm(`确定要终止交易吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  });
  emits('cancel');
};

const handleContinueClick = () => {
  emits('continue');
};

const handleResetClick = () => {
  emits('reset');
};

let countdownTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  getTradeElectricityVolume().then((volume: number | undefined) => {
    if (volume) {
      electricityVolume.value = volume;
    }
  });
  getChoiceSellData().then((data: CHOICE_SELL_DATA) => {
    if (data) {
      choiceSellData.value = [
        ...data.prevChoice.map((item) => item.id),
        data.currentChoice?.id,
        ...data.nextChoice.map((item) => item.id),
      ];
    }
  });
  countdownTimer = setInterval(() => {
    countdownTick.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});
</script>
<style scoped lang="scss">
.elec-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;
}

.elec-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #8ca1fd 0%, #b0eaff 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.elec-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.elec-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #f56c6c;
}

.stat-item {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  backdrop-filter: blur(10px);
}

//
</style>
<style lang="scss">
.elec-table {
  flex: 1;
  overflow: hidden;

  :deep(.el-table-v2__header-row) {
    background: #fafafa;
    font-weight: 600;
    color: #303133;
    border-bottom: 2px solid #e4e7ed;
  }

  :deep(.el-table-v2__header-cell) {
    padding: 12px 8px;
    font-size: 13px;
    border-right: 1px solid #e4e7ed;
  }

  :deep(.el-table-v2__row) {
    transition: background-color 0.2s;
    border-bottom: 1px solid #f0f0f0;

    &:hover {
      background-color: #f5f7fa;
    }

    &:nth-child(even) {
      background-color: #fafafa;

      &:hover {
        background-color: #f0f2f5;
      }
    }
  }

  :deep(.el-table-v2__row-cell) {
    padding: 10px 8px;
    font-size: 12px;
    border-right: 1px solid #f0f0f0;
    line-height: 1.5;
    display: flex;
    align-items: center;
    justify-content: center;

    // 确保 Element Plus 按钮样式正确应用
  }
}

/* 倒计时列：时间 + 标注（限定在电力交易表格内） */
.elec-table .countdown-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  .countdown-time {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .countdown-tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }

  &.countdown-cell--critical {
    .countdown-time {
      color: #f56c6c;
      font-weight: 700;
    }
    .countdown-tag {
      background: #fef0f0;
      color: #f56c6c;
      border: 1px solid #f56c6c;
    }
  }

  &.countdown-cell--urgent {
    .countdown-time {
      color: #e6a23c;
      font-weight: 600;
    }
    .countdown-tag {
      background: #fdf6ec;
      color: #e6a23c;
      border: 1px solid #e6a23c;
    }
  }

  &.countdown-cell--warn {
    .countdown-time {
      color: #909399;
    }
    .countdown-tag {
      background: #f4f4f5;
      color: #606266;
    }
  }

  &.countdown-cell--normal {
    .countdown-time {
      color: #409eff;
    }
    .countdown-tag {
      background: #ecf5ff;
      color: #409eff;
    }
  }

  &.countdown-cell--none {
    .countdown-time {
      color: #c0c4cc;
    }
    .countdown-tag {
      color: #c0c4cc;
      font-size: 10px;
    }
  }
}

.timestamp {
  color: #909399;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
}

.elec-type {
  display: inline-block;
  padding: 2px 8px;
  background: #e1f3ff;
  color: #409eff;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.elec-level {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.elec-level-error {
    background: #fef0f0;
    color: #f56c6c;
  }

  &.elec-level-warn,
  &.elec-level-warning {
    background: #fdf6ec;
    color: #e6a23c;
  }

  &.elec-level-info {
    background: #ecf5ff;
    color: #409eff;
  }

  &.elec-level-debug {
    background: #f4f4f5;
    color: #909399;
  }

  &.elec-level-success {
    background: #f0f9ff;
    color: #67c23a;
  }
}

.elec-message {
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  font-size: 12px;
}

.elec-data {
  margin: 0;
  padding: 4px 6px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  color: #495057;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 11px;
  line-height: 1.4;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 160px;
  &::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 2px;

    &:hover {
      background: #a8a8a8;
    }
  }
}

.no-data {
  color: #c0c4cc;
  font-style: italic;
}

.gap-2 {
  gap: 8px;
}

.elec-input {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  gap: 12px;
}

/* 交易顺序列：仅参与交易的展示顺序，不参与展示 — */
.elec-table .order-num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #303133;
}
.elec-table .order-empty {
  color: #c0c4cc;
}
.elec-table .order-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
</style>
