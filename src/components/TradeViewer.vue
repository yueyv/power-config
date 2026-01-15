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
          v-if="choiceSellData.length > 0 && tradeStatus === TRADE_STATUS.DISPLAY"
          @click="handleTradeClick"
          >交易</el-button
        >
        <el-input
          v-model="electricityVolume"
          :disabled="tradeStatus === TRADE_STATUS.TRADE"
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
          <span class="stat-item">总计: {{ choiceSellDataTotal }}</span>
        </div>
      </div>
    </div>
    <el-auto-resizer>
      <template #default="{ height, width }">
        <el-table-v2
          :columns="columns"
          :data="viewData"
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
import { computed, h, onMounted, ref } from 'vue';
import { CheckboxValueType, ElCheckbox, ElMessageBox } from 'element-plus';
import { TRADE_STATUS } from '@/constants';
import {
  getChoiceSellData,
  getTradeElectricityVolume,
  setTradeElectricityVolume,
} from '@/model/sellData';

const electricityVolume = ref(0);
const emits = defineEmits(['trade', 'cancel']);
const props = defineProps<{
  diaelecHeight?: number;
  data: SELL_DATA_ITEM[];
  tradeStatus: string;
}>();

const choiceSellData = ref<number[]>([]);
const viewData = computed(() => {
  return props.data
    .filter((item) => item.bfcj === '是' && item.dprice === item.xhprice)
    .sort((a, b) => a.gpdj - b.gpdj);
});
const choiceSellDataTotal = computed(() => {
  return choiceSellData.value.reduce(
    (acc, curr) => acc + viewData.value.find((item) => item.gpid === curr)!.sydl,
    0
  );
});
const columns = ref<any>([
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
          props.tradeStatus === TRADE_STATUS.TRADE,
        onChange: (value: CheckboxValueType) => {
          if (value) {
            choiceSellData.value = [...choiceSellData.value, rowData.gpid];
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
        disabled: props.tradeStatus === TRADE_STATUS.TRADE,
        onChange: (value: CheckboxValueType) => {
          if (value) {
            let index = 0;
            while (choiceSellDataTotal.value < electricityVolume.value) {
              if (choiceSellData.value.includes(viewData.value[index].gpid)) {
                index++;
              } else {
                choiceSellData.value.push(viewData.value[index].gpid);
                index++;
              }
            }
          } else {
            choiceSellData.value = [];
          }
        },
      });
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

const handleTradeClick = async () => {
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
  let tradeData: { id: number; elecVolume: number }[] = [];
  let currentVolume = 0;
  viewData.value.forEach((item) => {
    if (choiceSellData.value.includes(item.gpid)) {
      if (currentVolume + item.sydl <= electricityVolume.value) {
        currentVolume += item.sydl;
        tradeData.push({
          id: item.gpid,
          elecVolume: item.sydl,
        });
      } else {
        tradeData.push({
          id: item.gpid,
          elecVolume: electricityVolume.value - currentVolume,
        });
      }
    }
  });
  setTradeElectricityVolume(electricityVolume.value);
  emits('trade', tradeData);
};

const handleCancelClick = async () => {
  await ElMessageBox.confirm(`确定要终止交易吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  });
  emits('cancel');
};

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
        data.currentChoice.id,
        ...data.nextChoice.map((item) => item.id),
      ];
    }
  });
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
</style>
