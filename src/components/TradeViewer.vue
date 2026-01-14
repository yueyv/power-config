<template>
  <div class="log-viewer">
    <div class="log-header">
      <h2 class="log-title">电力交易</h2>
      <div class="flex items-center gap-2">
        <el-input v-model="electricityVolume" placeholder="拟交易电量">
          <template #prepend>
            <span>拟交易电量</span>
          </template>
          <template #suffix>
            <span>kWh</span>
          </template>
        </el-input>
        <div class="log-stats">
          <span class="stat-item">总计: {{ tableData.length }}</span>
        </div>
      </div>
    </div>
    <el-auto-resizer>
      <template #default="{ height, width }">
        <el-table-v2
          :columns="columns"
          :data="tableData"
          :width="width"
          :height="height"
          fixed
          class="log-table"
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
import 'element-plus/theme-chalk/el-table-v2.css';
import { ref, h } from 'vue';

const tableData = ref<any>([]);
const electricityVolume = ref(0);
const props = defineProps<{
  dialogHeight?: number;
}>();
const columns = ref<any>([
  {
    key: 'listedElec',
    title: '挂牌电量',
    width: 160,
    align: 'center',
  },
  {
    key: 'remainingElec',
    title: '剩余电量',
    width: 110,
    align: 'center',
  },
  {
    key: 'listedPrice',
    title: '挂牌价格',
    width: 110,
    align: 'center',
  },
  {
    key: 'd1CurveValue',
    title: 'D1曲线现货价值',
    width: 200,
    align: 'center',
  },
  {
    key: 'thisCurveValue',
    title: '该曲线现货价值',
    width: 200,
    align: 'center',
  },
  {
    key: 'partialTrade',
    title: '部分成交',
    width: 200,
    align: 'center',
  },
  {
    key: 'buyElec',
    title: '购买',
    width: 200,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: LogEntry }) => {
      return h('span', { class: 'log-type' }, rowData.target);
    },
  },
]);
</script>
<style scoped lang="scss">
.log-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #8ca1fd 0%, #b0eaff 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.log-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.log-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
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
.log-table {
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

.log-type {
  display: inline-block;
  padding: 2px 8px;
  background: #e1f3ff;
  color: #409eff;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.log-level {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.log-level-error {
    background: #fef0f0;
    color: #f56c6c;
  }

  &.log-level-warn,
  &.log-level-warning {
    background: #fdf6ec;
    color: #e6a23c;
  }

  &.log-level-info {
    background: #ecf5ff;
    color: #409eff;
  }

  &.log-level-debug {
    background: #f4f4f5;
    color: #909399;
  }

  &.log-level-success {
    background: #f0f9ff;
    color: #67c23a;
  }
}

.log-message {
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  font-size: 12px;
}

.log-data {
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
</style>
