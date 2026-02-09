import { EXECUTION_TYPE } from '@/constants';

/**
 * 仅使用 console + postMessage，供 content 转发；不依赖 chrome.*（运行在注入的 window 上下文）
 */
function execLog(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: unknown
): void {
  const payload = { level, message, data };
  if (level === 'error') console.error('[slideValid]', message, data);
  else if (level === 'warn') console.warn('[slideValid]', message, data);
  else if (level === 'debug') console.debug('[slideValid]', message, data);
  else console.log('[slideValid]', message, data);
  try {
    window.postMessage({ type: EXECUTION_TYPE.LOG_INFO, message: JSON.stringify(payload) }, '*');
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// 验证码容器：imgscode1 下第一个 .mask（验证码弹层仅在此内）
// 结构：.verifybox > .verifybox-bottom > .verify-img-panel img.backImg（背景）
//      .verify-bar-area > .verify-left-bar > .verify-move-block（滑块，style.left）
//      .verify-move-block > .verify-sub-block > img.bock-backImg（拼图块）
// ---------------------------------------------------------------------------
const CAPTCHA_CONTAINER_SELECTOR = '#imgscode1 .mask';

/** 获取验证码所在容器（#imgscode1 下第一个 .mask），未找到则返回 null */
function getCaptchaContainer(): Element | null {
  const iframeEl = document.getElementsByClassName('body-iframe tabsr')?.[0] as
    | HTMLIFrameElement
    | undefined;
  const iframe = iframeEl?.contentWindow ?? undefined;
  const iframeDocument = iframe?.document;
  const el = iframeDocument?.querySelector(CAPTCHA_CONTAINER_SELECTOR);
  return el ?? null;
}

/** mask 是否隐藏（display:none） */
function isMaskInVisible(): boolean {
  const mask = getCaptchaContainer();
  if (!mask) return false;
  const display = mask.ownerDocument.defaultView?.getComputedStyle(mask).display;
  console.log('display', display);
  return display === 'none';
}

const VERIFY_SELECTORS = {
  /** 背景图：大图 */
  bgImg: '.verify-img-panel img.backImg',
  /** 拼图块：小图，用于识别缺口位置 */
  puzzleImg: '.verify-sub-block img.bock-backImg',
  /** 可拖动的滑块块（通过 style.left 移动） */
  moveBlock: '.verify-move-block',
  /** 滑块轨道/容器，宽度与背景一致（如 400px） */
  barArea: '.verify-bar-area',
  /** 兼容：易盾等其它验证码的容器与滑块 */
  yidunContainer: '.yidun_control',
  yidunSlider: '.yidun_slider',
  yidunPuzzle: '.bock-backImg',
  yidunBg: '.backImg',
} as const;

/**
 * 模拟真实的鼠标点击事件
 * @param element 要点击的元素
 * @returns 是否成功触发点击
 */
function simulateClick(element: HTMLElement | null): boolean {
  if (!element) {
    execLog('error', '模拟点击失败：元素不存在');
    return false;
  }

  try {
    // 确保元素可见和可交互
    if (element.offsetParent === null) {
      execLog('warn', '元素不可见，尝试滚动到元素位置');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }

    // 聚焦元素（如果可聚焦）
    if (typeof (element as any).focus === 'function') {
      (element as any).focus();
    }

    // 创建完整的鼠标事件序列，模拟真实用户交互
    const events = [
      // mousedown 事件
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0, // 左键
        buttons: 1,
      }),
      // mouseup 事件
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 0,
      }),
      // click 事件
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 0,
      }),
    ];

    // 依次触发事件
    events.forEach((event) => {
      const defaultPrevented = !element.dispatchEvent(event);
      if (defaultPrevented) {
        execLog('warn', `事件 ${event.type} 被阻止`);
      }
    });

    // 如果元素有 onclick 属性，尝试直接执行函数调用
    const onclickAttr = element.getAttribute('onclick');
    if (onclickAttr) {
      try {
        // 提取函数名和参数
        const onclickMatch = onclickAttr.match(/^(\w+)\(([^)]*)\)/);
        if (onclickMatch) {
          const funcName = onclickMatch[1];
          const argsStr = onclickMatch[2];

          // 解析参数（支持数字和字符串）
          const args = argsStr
            ? argsStr.split(',').map((arg) => {
                const trimmed = arg.trim();
                // 尝试解析为数字
                const num = Number(trimmed);
                return isNaN(num) ? trimmed : num;
              })
            : [];

          // 在 window 对象上查找并调用函数
          if (typeof (window as any)[funcName] === 'function') {
            (window as any)[funcName](...args);
            execLog('debug', `直接调用函数：${funcName}(${args.join(', ')})`);
          } else {
            execLog('warn', `函数 ${funcName} 不存在`);
          }
        }
      } catch (error) {
        execLog('error', '执行 onclick 属性失败', error);
      }
    }

    // 最后尝试直接调用 click 方法（作为后备方案）
    if (typeof element.click === 'function') {
      element.click();
    }

    execLog('info', `模拟点击成功：${element.tagName}`, {
      onclick: onclickAttr,
      text: element.textContent?.trim(),
    });

    return true;
  } catch (error) {
    execLog('error', '模拟点击异常', error);
    return false;
  }
}

/**
 * 点击验证码弹出式选项
 */
async function clickCaptchaPopupTab(): Promise<boolean> {
  // 查找带有 captcha-mode="popup" 的 li 元素
  const popupTab = document.querySelector(
    'li.tcapt-tabs__tab[captcha-mode="popup"]'
  ) as HTMLElement;

  if (!popupTab) {
    execLog('warn', '未找到弹出式验证码标签');
    return false;
  }

  execLog('info', '找到弹出式验证码标签，准备点击');
  const success = simulateClick(popupTab);

  if (success) {
    execLog('info', '成功点击弹出式验证码标签');
  } else {
    execLog('error', '点击弹出式验证码标签失败');
  }

  return success;
}

/**
 * 执行验证码流程：等待弹层稳定后，查找拼图/背景图、调 API 取缺口位置并拖动滑块。
 * 适用于 #imgscode1 内 .verifybox 结构（以及兼容易盾等）。
 */
async function executeCaptchaClickFlow(): Promise<void> {
  execLog('info', '开始执行验证码流程');
  await new Promise((resolve) => setTimeout(resolve, 500));
  execLog('info', '验证码流程就绪，开始识别并滑动');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await getCaptchaImagesAndCallAPIWithRetry(3, 2000);
}

/**
 * 将图片元素转换为 base64
 * @param imgElement 图片元素（img 或 canvas）
 * @returns base64 字符串
 */
async function imageToBase64(imgElement: HTMLImageElement): Promise<string> {
  try {
    const src = imgElement.src;

    const base64Data = src.split(',')[1];
    return base64Data;
  } catch (error) {
    execLog('error', '将图片元素转换为 base64失败:', error);
    throw error;
  }
}

/**
 * 查找验证码拼图块图片（滑块上的小图）。
 * 仅在 #imgscode1 下第一个 .mask 内查找；优先 .verify-sub-block img.bock-backImg，再兼容易盾等。
 */
function findSliderImage(): HTMLImageElement | HTMLCanvasElement | null | Element {
  const root = getCaptchaContainer();
  console.log('root', root);

  if (!root) return null;
  // 1) 优先：verifybox 结构中的拼图块（有 src 的优先）
  const verifyPuzzles = root.querySelectorAll(VERIFY_SELECTORS.puzzleImg);
  console.log('verifyPuzzles', verifyPuzzles);
  const validVerify = verifyPuzzles[0];
  if (validVerify) {
    execLog('debug', `找到 verifybox 拼图块: ${VERIFY_SELECTORS.puzzleImg}`);
    return validVerify;
  }

  execLog('warn', '未找到滑块图片元素');
  return null;
}

/**
 * 查找验证码背景图（大图）。
 * 仅在 #imgscode1 下第一个 .mask 内查找；优先 .verify-img-panel img.backImg，再兼容易盾等。
 */
function findBackgroundImage(): HTMLImageElement | HTMLCanvasElement | null {
  const root = getCaptchaContainer();
  if (!root) return null;

  const verifyBg = root.querySelectorAll(VERIFY_SELECTORS.bgImg);
  const validVerify = verifyBg[0];
  console.log('validVerify', validVerify);
  if (verifyBg) {
    execLog('debug', `找到 verifybox 背景图: ${VERIFY_SELECTORS.bgImg}`);
    return validVerify as HTMLImageElement | HTMLCanvasElement;
  }

  execLog('warn', '未找到背景图片元素');
  return null;
}

const SLIDER_POSITION_TIMEOUT_MS = 30000;

/**
 * 通过 postMessage 请求 content → background 调用 API，获取滑块位置百分比（页面上下文无 chrome.*）
 * @param targetBase64 滑块图片 base64
 * @param backgroundBase64 背景图片 base64
 * @returns 滑块位置百分比（0-100）
 */
async function getSliderPosition(targetBase64: string, backgroundBase64: string): Promise<number> {
  const requestId = `slider-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('滑块位置 API 请求超时'));
    }, SLIDER_POSITION_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('message', onResponse);
    };

    const onResponse = (event: MessageEvent) => {
      if (event.source !== window || !event.data?.message) return;
      if (event.data.type !== EXECUTION_TYPE.SLIDER_POSITION_RESPONSE) return;
      let payload: { requestId?: string; success?: boolean; percentage?: number; error?: string };
      try {
        payload =
          typeof event.data.message === 'string'
            ? JSON.parse(event.data.message)
            : event.data.message;
      } catch {
        return;
      }
      if (payload.requestId !== requestId) return;
      cleanup();
      if (payload.success && typeof payload.percentage === 'number') {
        execLog('debug', 'API 返回数据', payload);
        resolve(payload.percentage);
      } else {
        reject(new Error(payload.error || 'API 请求失败'));
      }
    };

    window.addEventListener('message', onResponse);
    window.postMessage(
      {
        type: EXECUTION_TYPE.SLIDER_POSITION_REQUEST,
        message: JSON.stringify({
          requestId,
          targetBase64,
          backgroundBase64,
        }),
      },
      '*'
    );
  });
}

/**
 * 解析滑块元素 style.left 得到当前 left 像素值（如 "142.444px" -> 142.444）
 */
function parseSliderLeftPx(el: HTMLElement): number {
  const left = el.style.left || '';
  const match = left.match(/^([\d.]+)px$/);
  if (match) return parseFloat(match[1]) || 0;
  return parseInt(left, 10) || 0;
}

/**
 * 模拟拖动滑块到指定位置（0–100%）。
 * 仅在 #imgscode1 下第一个 .mask 内查找；优先 .verify-move-block + .verify-bar-area，兼容易盾。
 */
async function slideToPosition(percentage: number): Promise<boolean> {
  try {
    const root = getCaptchaContainer() ?? document;
    let slider: HTMLElement;
    let sliderContainer: HTMLElement;
    let containerWidth: number;

    // 1) 优先：verifybox 结构 .verify-move-block + .verify-bar-area
    const moveBlocks = root.querySelectorAll(VERIFY_SELECTORS.moveBlock);
    const barAreas = root.querySelectorAll(VERIFY_SELECTORS.barArea);
    if (moveBlocks.length > 0 && barAreas.length > 0) {
      slider = moveBlocks[0] as HTMLElement;
      sliderContainer = barAreas[0] as HTMLElement;
      containerWidth =
        sliderContainer.clientWidth ||
        sliderContainer.offsetWidth ||
        sliderContainer.getBoundingClientRect().width;
      if (!containerWidth) {
        const bg = findBackgroundImage();
        if (bg) containerWidth = bg.getBoundingClientRect().width;
      }
      execLog('debug', `使用 verifybox 滑块与轨道，容器宽: ${containerWidth}`);
    } else {
      // 2) 兼容：易盾
      const containers = root.querySelectorAll(VERIFY_SELECTORS.yidunContainer);
      const container = containers[0];
      slider = container?.querySelector(VERIFY_SELECTORS.yidunSlider) as HTMLElement;
      sliderContainer = container as HTMLElement;
      if (!slider || !sliderContainer) {
        execLog('error', '未找到滑块或容器（.verify-move-block / .yidun_control）');
        return false;
      }
      containerWidth =
        sliderContainer.clientWidth ||
        sliderContainer.offsetWidth ||
        sliderContainer.getBoundingClientRect().width;
      if (!containerWidth) {
        const bg = findBackgroundImage();
        if (bg) containerWidth = bg.getBoundingClientRect().width;
      }
    }

    if (!containerWidth || containerWidth === 0) {
      execLog('error', '无法获取轨道宽度');
      return false;
    }

    const sliderRect = slider.getBoundingClientRect();
    const currentLeft = parseSliderLeftPx(slider);
    // 目标 left：轨道宽度 * 百分比；verifybox 的 left 即为滑块左边缘位置
    const targetLeft = (containerWidth * percentage) / 100;
    const distance = targetLeft - currentLeft;

    execLog(
      'debug',
      `拖动: left 从 ${currentLeft}px 到 ${targetLeft}px (${percentage}%), 距离 ${distance}px`
    );

    if (slider.offsetParent === null) {
      slider.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise((r) => setTimeout(r, 300));
    }

    const startX = sliderRect.left + sliderRect.width / 2;
    const startY = sliderRect.top + sliderRect.height / 2;

    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX: startX,
      clientY: startY,
    });
    slider.dispatchEvent(mouseDown);
    sliderContainer.dispatchEvent(mouseDown);
    await new Promise((r) => setTimeout(r, 50));

    const steps = 20;
    const stepDist = distance / steps;
    const stepDelay = 10;
    for (let i = 1; i <= steps; i++) {
      const x = startX + stepDist * i;
      const y = startY + Math.sin((i / steps) * Math.PI) * 2;
      const move = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 1,
        clientX: x,
        clientY: y,
      });
      slider.dispatchEvent(move);
      sliderContainer.dispatchEvent(move);
      document.dispatchEvent(move);
      await new Promise((r) => setTimeout(r, stepDelay));
    }

    const finalX = startX + distance;
    const finalY = startY;
    const finalMove = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX: finalX,
      clientY: finalY,
    });
    slider.dispatchEvent(finalMove);
    sliderContainer.dispatchEvent(finalMove);
    document.dispatchEvent(finalMove);
    await new Promise((r) => setTimeout(r, 50));

    const mouseUp = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 0,
      clientX: finalX,
      clientY: finalY,
    });
    slider.dispatchEvent(mouseUp);
    sliderContainer.dispatchEvent(mouseUp);
    document.dispatchEvent(mouseUp);

    execLog('info', `滑块已移动到 ${percentage}%`);
    return true;
  } catch (error) {
    execLog('error', '拖动滑块失败:', error);
    return false;
  }
}

/**
 * 获取验证码图片并调用 API
 */
async function getCaptchaImagesAndCallAPI(): Promise<void> {
  execLog('debug', '开始获取验证码图片...');

  // 查找滑块图片
  const sliderImage = findSliderImage();
  if (!sliderImage) {
    execLog('error', '未找到滑块图片');
    return;
  }

  // 等待图片加载完成（如果是 img 元素）
  if (sliderImage instanceof HTMLImageElement && !sliderImage.complete) {
    await new Promise((resolve, reject) => {
      sliderImage.onload = resolve;
      sliderImage.onerror = reject;
      // 设置超时
      setTimeout(() => reject(new Error('滑块图片加载超时')), 5000);
    });
  }

  // 查找背景图片
  const backgroundImage = findBackgroundImage();
  if (!backgroundImage) {
    execLog('error', '未找到背景图片');
    return;
  }

  // 等待图片加载完成（如果是 img 元素）
  if (backgroundImage instanceof HTMLImageElement && !backgroundImage.complete) {
    await new Promise((resolve, reject) => {
      backgroundImage.onload = resolve;
      backgroundImage.onerror = reject;
      // 设置超时
      setTimeout(() => reject(new Error('背景图片加载超时')), 5000);
    });
  }

  try {
    // 转换为 base64
    execLog('debug', '正在转换滑块图片为 base64...');
    const targetBase64 = await imageToBase64(sliderImage as HTMLImageElement);
    execLog('debug', '滑块图片 base64 长度:', targetBase64.length);

    execLog('debug', '正在转换背景图片为 base64...');
    const backgroundBase64 = await imageToBase64(backgroundImage as HTMLImageElement);
    execLog('debug', '背景图片 base64 长度:', backgroundBase64.length);

    // 调用 API
    execLog('debug', '正在调用 API 获取滑块位置...');
    const percentage = await getSliderPosition(targetBase64, backgroundBase64);
    execLog('info', `获取到滑块位置百分比: ${percentage}%`);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 滑动滑块到目标位置
    await slideToPosition(percentage);

    return;
  } catch (error) {
    execLog('error', '处理验证码图片失败:', error);
    return;
  }
}

/**
 * 带重试的获取验证码图片并调用 API
 * @param maxRetries 最大重试次数，默认 3 次
 * @param retryDelay 重试延迟（毫秒），默认 1000ms
 */
async function getCaptchaImagesAndCallAPIWithRetry(
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<number | null> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      execLog('info', `尝试获取验证码图片 (第 ${attempt}/${maxRetries} 次)...`);
      await getCaptchaImagesAndCallAPI();
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (isMaskInVisible()) {
        execLog('info', 'mask 已隐藏，视为验证通过');
        return 0;
      }
      execLog('warn', `第 ${attempt} 次尝试返回 null，准备重试...`);
      lastError = new Error('获取验证码图片返回 null');
    } catch (error) {
      execLog('error', `第 ${attempt} 次尝试失败:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    // 如果不是最后一次尝试，等待后重试
    if (attempt < maxRetries) {
      execLog('debug', `等待 ${retryDelay}ms 后重试...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  execLog('error', `所有 ${maxRetries} 次尝试都失败了`);
  if (lastError) {
    execLog('error', '最后一次错误:', lastError);
  }
  return null;
}

// 导出函数供外部调用
export {
  executeCaptchaClickFlow,
  clickCaptchaPopupTab,
  getCaptchaImagesAndCallAPI,
  getCaptchaImagesAndCallAPIWithRetry,
  getSliderPosition,
};
