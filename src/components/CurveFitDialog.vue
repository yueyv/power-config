<template>
  <el-dialog
    v-model="dialogVisible"
    title="曲线拟合参考"
    width="720px"
    destroy-on-close
    @close="handleClose"
  >
    <p class="curve-tip">
      输入一条 24 点曲线（h0～h23），表格将按与该曲线的趋势拟合程度标注行颜色。
    </p>
    <div class="curve-inputs">
      <div v-for="i in 24" :key="i" class="curve-input-item">
        <span class="curve-label">h{{ i - 1 }}</span>
        <el-input
          v-model.number="points[i - 1]"
          type="number"
          step="any"
          size="small"
          placeholder="0"
          class="curve-num"
        />
      </div>
    </div>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleConfirm">应用</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import 'element-plus/theme-chalk/el-dialog.css';
import { ref, watch } from 'vue';
import { ElInput } from 'element-plus';
import { useTradeCurveStore } from '@/stores/tradeCurve';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const dialogVisible = ref(props.modelValue);
const store = useTradeCurveStore();
const points = ref<number[]>(Array(24).fill(0));

watch(
  () => props.modelValue,
  (v) => {
    dialogVisible.value = v;
    if (v) {
      points.value = store.refCurve ? [...store.refCurve] : Array(24).fill(0);
    }
  },
  { immediate: true }
);

watch(dialogVisible, (v) => {
  emit('update:modelValue', v);
});

function handleClose() {
  dialogVisible.value = false;
  emit('update:modelValue', false);
}

function handleConfirm() {
  const raw = points.value.map((p) => (typeof p === 'number' && Number.isFinite(p) ? p : 0));
  store.setRefCurve(raw);
  handleClose();
}
</script>

<style scoped lang="scss">
.curve-tip {
  margin: 0 0 12px;
  color: #606266;
  font-size: 13px;
}

.curve-inputs {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px 12px;
}

.curve-input-item {
  display: flex;
  align-items: center;
  gap: 6px;

  .curve-label {
    width: 28px;
    font-size: 12px;
    color: #909399;
  }

  .curve-num {
    flex: 1;
    min-width: 0;
  }
}
</style>
