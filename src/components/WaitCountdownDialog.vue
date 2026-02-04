<script lang="ts">
import { defineComponent, h, Teleport, Transition } from 'vue';

function formatTime(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  const hh = Math.floor(t / 3600);
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default defineComponent({
  name: 'WaitCountdownDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    countdownMs: { type: Number, default: 0 },
    tip: { type: String, default: '需等待以下时间后可摘牌：' },
    hint: { type: String, default: '请勿关闭此窗口，到时将自动进入交易确认。' },
  },
  emits: ['update:modelValue', 'close'],
  setup(props, { emit }) {
    function handleClose(cancelled: boolean) {
      emit('update:modelValue', false);
      emit('close', cancelled);
    }
    return () =>
      h(Teleport, { to: 'body' }, [
        h(
          Transition,
          { name: 'wait-float' },
          {
            default: () =>
              props.modelValue
                ? h('div', { class: 'wait-countdown-float' }, [
                    h('div', { class: 'wait-countdown-header' }, [
                      h('span', { class: 'wait-countdown-title' }, '等待可摘牌'),
                      h(
                        'button',
                        {
                          type: 'button',
                          class: 'wait-countdown-close',
                          'aria-label': '关闭',
                          onClick: () => handleClose(true),
                        },
                        '×'
                      ),
                    ]),
                    h('div', { class: 'wait-countdown-body' }, [
                      h('p', { class: 'wait-countdown-tip' }, props.tip),
                      h('p', { class: 'wait-countdown-time' }, formatTime(props.countdownMs)),
                      h('p', { class: 'wait-countdown-hint' }, props.hint),
                    ]),
                    h('div', { class: 'wait-countdown-footer' }, [
                      h(
                        'button',
                        {
                          type: 'button',
                          class: 'wait-countdown-cancel',
                          onClick: () => handleClose(true),
                        },
                        '取消等待'
                      ),
                    ]),
                  ])
                : null,
          }
        ),
      ]);
  },
});
</script>

<style scoped lang="scss">
.wait-countdown-float {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  width: 280px;
  padding: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 1px solid #e4e7ed;
  overflow: hidden;
}

.wait-countdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(135deg, #8ca1fd 0%, #b0eaff 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.wait-countdown-close {
  margin: 0;
  padding: 0 4px;
  background: transparent;
  border: none;
  color: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.9;

  &:hover {
    opacity: 1;
  }
}

.wait-countdown-body {
  text-align: center;
  padding: 14px 12px 8px;

  .wait-countdown-tip {
    margin: 0 0 8px;
    color: #606266;
    font-size: 13px;
    line-height: 1.4;
  }

  .wait-countdown-time {
    margin: 0 0 8px;
    font-size: 24px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #409eff;
  }

  .wait-countdown-hint {
    margin: 0;
    font-size: 11px;
    color: #909399;
    line-height: 1.3;
  }
}

.wait-countdown-footer {
  padding: 8px 12px 12px;
  text-align: center;
}

.wait-countdown-cancel {
  padding: 6px 16px;
  font-size: 12px;
  color: #606266;
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    color: #409eff;
    background: #ecf5ff;
    border-color: #c6e2ff;
  }
}

.wait-float-enter-active,
.wait-float-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.wait-float-enter-from,
.wait-float-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
