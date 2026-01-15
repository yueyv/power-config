<template>
  <div
    ref="affixRef"
    class="affix-container"
    :class="{ 'is-dragging': isDragging, 'is-left': isLeft, 'is-right': isRight }"
    :style="affixStyle"
    @mousedown="handleMouseDown"
  >
    <div class="affix-icon" v-if="tradeStatus === TRADE_STATUS.DISPLAY">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M12.586 12.586L4.293 20.879a1 1 0 0 1-1.414-1.414l8.293-8.293a4 4 0 0 1 5.657-5.657l8.293-8.293a1 1 0 0 1 1.414 1.414l-8.293 8.293a4 4 0 0 1-5.657 5.657z"
        />
      </svg>
    </div>
    <div class="affix-icon trade" v-if="tradeStatus === TRADE_STATUS.TRADE">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 2L2 22h20L12 2z" />
      </svg>
    </div>
    <div class="affix-icon complete" v-if="tradeStatus === TRADE_STATUS.COMPLETE">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { TRADE_STATUS } from '@/constants';
const emit = defineEmits<{
  (e: 'choose'): void;
}>();
interface Props {
  /** 初始位置 x */
  initialX?: number;
  /** 初始位置 y */
  initialY?: number;
  /** 吸附距离阈值（像素） */
  snapDistance?: number;
  /** 侧边栏宽度 */
  sidebarWidth?: number;
  /** 交易状态 */
  tradeStatus: string;
}

const props = withDefaults(defineProps<Props>(), {
  initialX: window.innerWidth - 100,
  initialY: 100,
  snapDistance: 20,
  sidebarWidth: 0,
});

const affixRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const isLeft = ref(false);
const isRight = ref(false);
const isChoose = ref(false);
const position = ref({
  x: props.initialX,
  y: props.initialY,
});

const dragState = ref({
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0,
});

const affixStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}));

const handleMouseDown = (e: MouseEvent) => {
  if (!affixRef.value) return;

  isDragging.value = true;
  isChoose.value = true;
  const rect = affixRef.value.getBoundingClientRect();
  dragState.value = {
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  e.preventDefault();
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value || !affixRef.value) return;

  const newX = e.clientX - dragState.value.offsetX;
  const newY = e.clientY - dragState.value.offsetY;
  if (
    Math.abs(e.clientX - dragState.value.startX) < 10 &&
    Math.abs(e.clientY - dragState.value.startY) < 10
  ) {
    isChoose.value = false;
  }
  // 获取窗口尺寸
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // 限制在窗口范围内
  const clampedX = Math.max(0, Math.min(newX, windowWidth - affixRef.value.offsetWidth));
  const clampedY = Math.max(0, Math.min(newY, windowHeight - affixRef.value.offsetHeight));

  // 检查是否应该吸附到左侧
  if (clampedX <= props.snapDistance) {
    position.value = {
      x: 0,
      y: clampedY,
    };
    isLeft.value = true;
    isRight.value = false;
  }
  // 检查是否应该吸附到右侧
  else if (clampedX >= windowWidth - props.snapDistance - affixRef.value.offsetWidth) {
    position.value = {
      x: windowWidth - affixRef.value.offsetWidth,
      y: clampedY,
    };
    isLeft.value = false;
    isRight.value = true;
  }
  // 正常拖拽
  else {
    position.value = {
      x: clampedX,
      y: clampedY,
    };
    isLeft.value = false;
    isRight.value = false;
  }
};

const handleMouseUp = () => {
  isDragging.value = false;
  if (isChoose.value) {
    emit('choose');
    isChoose.value = false;
  }
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

// 窗口大小改变时重新计算位置
const handleResize = () => {
  if (!affixRef.value) return;

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // 如果当前吸附在右侧，保持右侧吸附
  if (isRight.value) {
    position.value.x = windowWidth - (affixRef.value.offsetWidth || 40);
  }

  // 确保不超出窗口范围
  position.value.x = Math.max(
    0,
    Math.min(position.value.x, windowWidth - (affixRef.value.offsetWidth || 40))
  );
  position.value.y = Math.max(
    0,
    Math.min(position.value.y, windowHeight - (affixRef.value.offsetHeight || 40))
  );
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
});
</script>

<style scoped lang="scss">
.affix-container {
  position: fixed;
  width: 40px;
  height: 40px;
  cursor: grab;
  z-index: 10000;
  pointer-events: auto;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  user-select: none;

  &:hover {
    transform: scale(1.1);
  }

  &.is-dragging {
    cursor: grabbing;
    transform: scale(1.2);
    z-index: 10001;
  }

  &.is-left {
    left: 0 !important;
    border-radius: 0 8px 8px 0;
    transform: scale(0.8) translateX(-8px);
  }

  &.is-right {
    right: 0 !important;
    left: auto !important;
    border-radius: 8px 0 0 8px;
    transform: scale(0.8) translateX(8px);
  }
}

.affix-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #c5d0ff 0%, #7dfff97e 100%);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(102, 219, 234, 0.4);
  transition: all 0.3s ease;

  svg {
    width: 24px;
    height: 24px;
    color: white;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  .affix-container.is-dragging & {
    box-shadow: 0 6px 20px rgba(85, 99, 50, 0.6);
  }

  .affix-container.is-left &,
  .affix-container.is-right & {
    border-radius: inherit;
    box-shadow: 0 4px 16px rgba(251, 125, 255, 0.5);
  }
}

.affix-container.is-left .affix-icon,
.affix-container.is-right .affix-icon {
  background: linear-gradient(135deg, #93fbdc 0%, #57f2f5 100%);
}

.affix-icon.trade {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

.affix-icon.complete {
  background: linear-gradient(135deg, #4caf50 0%, #8bc34a 100%) !important;
}
</style>
