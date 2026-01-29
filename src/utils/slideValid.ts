import { logger } from './logger';

/**
 * 模拟真实的鼠标点击事件
 * @param element 要点击的元素
 * @returns 是否成功触发点击
 */
function simulateClick(element: HTMLElement | null): boolean {
  if (!element) {
    logger.error('模拟点击失败：元素不存在');
    return false;
  }

  try {
    // 确保元素可见和可交互
    if (element.offsetParent === null) {
      logger.warn('元素不可见，尝试滚动到元素位置');
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
        logger.warn(`事件 ${event.type} 被阻止`);
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
            logger.debug(`直接调用函数：${funcName}(${args.join(', ')})`);
          } else {
            logger.warn(`函数 ${funcName} 不存在`);
          }
        }
      } catch (error) {
        logger.error('执行 onclick 属性失败', error);
      }
    }

    // 最后尝试直接调用 click 方法（作为后备方案）
    if (typeof element.click === 'function') {
      element.click();
    }

    logger.info(`模拟点击成功：${element.tagName}`, {
      onclick: onclickAttr,
      text: element.textContent?.trim(),
    });

    return true;
  } catch (error) {
    logger.error('模拟点击异常', error);
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
    logger.warn('未找到弹出式验证码标签');
    return false;
  }

  logger.info('找到弹出式验证码标签，准备点击');
  const success = simulateClick(popupTab);

  if (success) {
    logger.info('成功点击弹出式验证码标签');
  } else {
    logger.error('点击弹出式验证码标签失败');
  }

  return success;
}

/**
 * 点击登录按钮
 */
async function clickLoginButton(): Promise<boolean> {
  // 查找带有类名 tcapt-bind_btn tcapt-bind_btn--login j-pop 的元素
  const loginButton = document.querySelector(
    '.tcapt-bind_btn.tcapt-bind_btn--login.j-pop'
  ) as HTMLElement;

  if (!loginButton) {
    logger.warn('未找到登录按钮');
    return false;
  }

  logger.info('找到登录按钮，准备点击');
  const success = simulateClick(loginButton);

  if (success) {
    logger.info('成功点击登录按钮');
  } else {
    logger.error('点击登录按钮失败');
  }

  return success;
}

/**
 * 执行验证码点击流程
 */
async function executeCaptchaClickFlow(): Promise<void> {
  logger.info('开始执行验证码点击流程');

  // 第一步：点击弹出式标签
  const tabClickSuccess = await clickCaptchaPopupTab();

  if (!tabClickSuccess) {
    logger.error('点击弹出式标签失败，终止流程');
    return;
  }

  // 等待一下，让界面响应
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 第二步：点击登录按钮
  const buttonClickSuccess = await clickLoginButton();

  if (!buttonClickSuccess) {
    logger.error('点击登录按钮失败');
    return;
  }

  logger.info('验证码点击流程执行完成');

  await new Promise((resolve) => setTimeout(resolve, 1500));
  logger.info('开始获取验证码图片...');
  await getCaptchaImagesAndCallAPIWithRetry(3, 1000);
}

/**
 * 通过 fetch 获取图片并转换为 base64（避免 CORS 问题）
 * @param url 图片 URL
 * @returns base64 字符串
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`获取图片失败: ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // 移除 data:image/...;base64, 前缀，只返回 base64 数据
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logger.error('通过 fetch 获取图片失败:', error);
    throw error;
  }
}

/**
 * 将图片元素转换为 base64
 * @param imgElement 图片元素（img 或 canvas）
 * @returns base64 字符串
 */
async function imageToBase64(imgElement: HTMLImageElement | HTMLCanvasElement): Promise<string> {
  try {
    // 方法1: 如果是 canvas，直接获取数据（不会触发 CORS）
    if (imgElement instanceof HTMLCanvasElement) {
      try {
        const base64 = imgElement.toDataURL('image/png');
        const base64Data = base64.split(',')[1];
        return base64Data;
      } catch (error) {
        logger.warn('直接从 canvas 获取数据失败，尝试其他方法:', error);
      }
    }

    // 方法2: 如果是 img 元素，尝试从 src 获取
    if (imgElement instanceof HTMLImageElement) {
      const src = imgElement.src;

      // 如果已经是 base64 格式
      if (src.startsWith('data:')) {
        const base64Data = src.split(',')[1];
        return base64Data;
      }

      // 尝试通过 fetch 获取（浏览器扩展有权限）
      try {
        return await fetchImageAsBase64(src);
      } catch (error) {
        logger.warn('通过 fetch 获取图片失败，尝试 canvas 方法:', error);
      }
    }

    // 方法3: 尝试使用 canvas（设置 crossOrigin）
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('无法获取 canvas 上下文'));
          return;
        }

        if (imgElement instanceof HTMLCanvasElement) {
          // 如果是 canvas，直接复制
          canvas.width = imgElement.width;
          canvas.height = imgElement.height;
          ctx.drawImage(imgElement, 0, 0);
        } else if (imgElement instanceof HTMLImageElement) {
          // 如果是 img，尝试设置 crossOrigin 后重新加载
          const img = new Image();
          img.crossOrigin = 'anonymous';

          img.onload = () => {
            try {
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              ctx.drawImage(img, 0, 0);
              const base64 = canvas.toDataURL('image/png');
              const base64Data = base64.split(',')[1];
              resolve(base64Data);
            } catch (error) {
              reject(error);
            }
          };

          img.onerror = () => {
            // 如果 crossOrigin 失败，说明服务器不支持 CORS
            // 对于浏览器扩展，应该使用 fetch 方法，这里不应该到达
            reject(new Error('图片加载失败，请使用 fetch 方法'));
          };

          img.src = imgElement.src;
          return;
        } else {
          reject(new Error('不支持的图片元素类型'));
          return;
        }

        // 转换为 base64
        const base64 = canvas.toDataURL('image/png');
        // 移除 data:image/png;base64, 前缀
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    throw error;
  }
}

/**
 * 查找验证码滑块图片元素（选择第二个）
 */
function findSliderImage(): HTMLImageElement | HTMLCanvasElement | null {
  // 尝试多种可能的选择器
  const selectors = [
    'img.bock-backImg', // 滑块图片类名（注意拼写：bock-backImg）
    '.bock-backImg', // 滑块图片类名
    '.verify-sub-block img', // verify-sub-block 内部的滑块图片
    'img.yidun_jigsaw', // 直接是 img 元素，类名为 yidun_jigsaw
    '.yidun_jigsaw', // 类名为 yidun_jigsaw 的元素（通常是 img）
    '.yidun_jigsaw img', // yidun_jigsaw 内部的 img 子元素（备用）
    '.yidun_slider img',
    '.yidun_slider canvas',
    '[class*="jigsaw"] img',
    '[class*="slider"] img',
    '[class*="bock"] img', // 包含 bock 的类名
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    // 优先查找有实际图片数据的元素（src 不为空）
    const validElements: (HTMLImageElement | HTMLCanvasElement)[] = [];
    for (const el of Array.from(elements)) {
      if (el instanceof HTMLImageElement || el instanceof HTMLCanvasElement) {
        // 如果是图片元素，检查 src 是否有值；如果是 canvas，直接添加
        if (el instanceof HTMLCanvasElement || (el.src && el.src.trim() !== '')) {
          validElements.push(el);
        }
      }
    }

    if (validElements.length > 1) {
      // 选择第二个有效元素（索引为1）
      logger.debug(`找到第二个滑块图片元素: ${selector}，索引: 1`);
      return validElements[1];
    } else if (validElements.length === 1) {
      // 如果只有一个有效元素，也返回它
      logger.debug(`找到滑块图片元素: ${selector}（只有一个有效元素）`);
      return validElements[0];
    } else if (elements.length > 1) {
      // 如果没有有效元素，但找到了多个元素，返回第二个
      const element = elements[1];
      if (
        element &&
        (element instanceof HTMLImageElement || element instanceof HTMLCanvasElement)
      ) {
        logger.debug(`找到第二个滑块图片元素（但可能无图片数据）: ${selector}，索引: 1`);
        return element;
      }
    } else if (elements.length === 1) {
      // 如果只有一个元素，也返回它
      const element = elements[0];
      if (
        element &&
        (element instanceof HTMLImageElement || element instanceof HTMLCanvasElement)
      ) {
        logger.debug(`找到滑块图片元素（但可能无图片数据）: ${selector}（只有一个元素）`);
        return element;
      }
    }
  }

  // 如果找不到，尝试查找所有图片，通过类名和尺寸判断
  const allImages = Array.from(document.querySelectorAll('img, canvas'));
  const matchedImages: (HTMLImageElement | HTMLCanvasElement)[] = [];

  for (const img of allImages) {
    if (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement) {
      // 跳过没有图片数据的元素
      if (img instanceof HTMLImageElement && (!img.src || img.src.trim() === '')) {
        continue;
      }

      // 检查元素本身的类名
      const className = img.className || '';
      if (
        className.includes('jigsaw') ||
        className.includes('slider') ||
        className.includes('bock-backImg') ||
        className === 'bock-backImg'
      ) {
        matchedImages.push(img);
      } else {
        // 滑块图片通常比较小，宽度在 50-100px 左右
        const width = img instanceof HTMLImageElement ? img.naturalWidth || img.width : img.width;
        if (width >= 40 && width <= 120) {
          const parent = img.parentElement;
          if (
            parent &&
            (parent.className.includes('slider') ||
              parent.className.includes('jigsaw') ||
              parent.className.includes('verify-sub-block') ||
              parent.className.includes('verify-move-block'))
          ) {
            matchedImages.push(img);
          }
        }
      }
    }
  }

  // 选择第二个匹配的图片
  if (matchedImages.length > 1) {
    logger.debug(`通过类名和尺寸找到第二个滑块图片，总共有 ${matchedImages.length} 个匹配项`);
    return matchedImages[1];
  } else if (matchedImages.length === 1) {
    logger.debug('通过类名和尺寸找到滑块图片（只有一个匹配项）');
    return matchedImages[0];
  }

  logger.warn('未找到滑块图片元素');
  return null;
}

/**
 * 查找验证码背景图片元素（选择第二个）
 */
function findBackgroundImage(): HTMLImageElement | HTMLCanvasElement | null {
  // 尝试多种可能的选择器
  const selectors = [
    'img.backImg', // 背景图片类名
    '.backImg', // 背景图片类名
    '.verify-img-panel img', // verify-img-panel 内部的背景图片
    '.yidun_bg-img',
    '.yidun_bgimg',
    '.yidun_bg img',
    '.yidun_bg canvas',
    '[class*="bg"] img',
    '[class*="background"] img',
    'img[class*="bg"]',
    'canvas[class*="bg"]',
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    // 优先查找有实际图片数据的元素（src 不为空）
    const validElements: (HTMLImageElement | HTMLCanvasElement)[] = [];
    for (const el of Array.from(elements)) {
      if (el instanceof HTMLImageElement || el instanceof HTMLCanvasElement) {
        // 如果是图片元素，检查 src 是否有值；如果是 canvas，直接添加
        if (el instanceof HTMLCanvasElement || (el.src && el.src.trim() !== '')) {
          validElements.push(el);
        }
      }
    }

    if (validElements.length > 1) {
      // 选择第二个有效元素（索引为1）
      logger.debug(`找到第二个背景图片元素: ${selector}，索引: 1`);
      return validElements[1];
    } else if (validElements.length === 1) {
      // 如果只有一个有效元素，也返回它
      logger.debug(`找到背景图片元素: ${selector}（只有一个有效元素）`);
      return validElements[0];
    } else if (elements.length > 1) {
      // 如果没有有效元素，但找到了多个元素，返回第二个
      const element = elements[1];
      if (
        element &&
        (element instanceof HTMLImageElement || element instanceof HTMLCanvasElement)
      ) {
        logger.debug(`找到第二个背景图片元素（但可能无图片数据）: ${selector}，索引: 1`);
        return element;
      }
    } else if (elements.length === 1) {
      // 如果只有一个元素，也返回它
      const element = elements[0];
      if (
        element &&
        (element instanceof HTMLImageElement || element instanceof HTMLCanvasElement)
      ) {
        logger.debug(`找到背景图片元素（但可能无图片数据）: ${selector}（只有一个元素）`);
        return element;
      }
    }
  }

  // 如果找不到，尝试查找所有图片，通过尺寸判断
  const allImages = Array.from(document.querySelectorAll('img, canvas'));
  const matchedImages: (HTMLImageElement | HTMLCanvasElement)[] = [];

  for (const img of allImages) {
    if (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement) {
      // 跳过没有图片数据的元素
      if (img instanceof HTMLImageElement && (!img.src || img.src.trim() === '')) {
        continue;
      }

      // 检查元素本身的类名
      const className = img.className || '';
      if (className.includes('backImg') || className === 'backImg') {
        matchedImages.push(img);
      } else {
        // 背景图片通常比较大，宽度在 300px 以上
        const width = img instanceof HTMLImageElement ? img.naturalWidth || img.width : img.width;
        if (width >= 250) {
          const parent = img.parentElement;
          if (
            parent &&
            (parent.className.includes('bg') ||
              parent.className.includes('background') ||
              parent.className.includes('verify-img-panel'))
          ) {
            matchedImages.push(img);
          }
        }
      }
    }
  }

  // 选择第二个匹配的图片
  if (matchedImages.length > 1) {
    logger.debug(`通过尺寸判断找到第二个背景图片，总共有 ${matchedImages.length} 个匹配项`);
    return matchedImages[1];
  } else if (matchedImages.length === 1) {
    logger.debug('通过尺寸判断找到背景图片（只有一个匹配项）');
    return matchedImages[0];
  }

  logger.warn('未找到背景图片元素');
  return null;
}

/**
 * 调用 API 获取滑块位置百分比（通过 background script 避免跨域问题）
 * @param targetBase64 滑块图片 base64
 * @param backgroundBase64 背景图片 base64
 * @returns 滑块位置百分比（0-100）
 */
async function getSliderPosition(targetBase64: string, backgroundBase64: string): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      // 通过 chrome.runtime.sendMessage 发送消息给 background script
      chrome.runtime.sendMessage(
        {
          type: 'slider-position-api',
          data: {
            target_base64: targetBase64,
            background_base64: backgroundBase64,
          },
        },
        (response) => {
          // 检查是否有错误
          if (chrome.runtime.lastError) {
            logger.error('发送消息失败:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error('未收到响应'));
            return;
          }

          if (response.success) {
            logger.debug('API 返回数据:', response);
            resolve(response.percentage);
          } else {
            reject(new Error(response.error || 'API 请求失败'));
          }
        }
      );
    } catch (error) {
      logger.error('调用 API 失败:', error);
      reject(error);
    }
  });
}

/**
 * 模拟拖动滑块到指定位置
 * @param percentage 目标位置百分比（0-100）
 */
async function slideToPosition(percentage: number): Promise<boolean> {
  try {
    // 查找滑块容器 yidun_control（选择第二个）
    const containers = document.querySelectorAll('.yidun_control');
    let sliderContainer: HTMLElement | null = null;

    if (containers.length > 1) {
      // 选择第二个容器（索引为1）
      sliderContainer = containers[1] as HTMLElement;
      logger.debug(`找到第二个滑块容器 .yidun_control，总共有 ${containers.length} 个`);
    } else if (containers.length === 1) {
      // 如果只有一个容器，也使用它
      sliderContainer = containers[0] as HTMLElement;
      logger.debug('找到滑块容器 .yidun_control（只有一个元素）');
    } else {
      logger.error('未找到滑块容器 .yidun_control');
      return false;
    }

    if (!sliderContainer) {
      logger.error('滑块容器元素无效');
      return false;
    }

    // 在容器内查找实际的滑块元素 yidun_slider（这是需要拖动的元素）
    const slider = sliderContainer.querySelector('.yidun_slider') as HTMLElement;
    if (!slider) {
      logger.error('未找到滑块元素 .yidun_slider');
      return false;
    }

    logger.debug('找到滑块元素 .yidun_slider');

    // 获取容器宽度（尝试多种方式）
    let containerWidth = sliderContainer.clientWidth || sliderContainer.offsetWidth;

    // 如果还是获取不到，尝试使用 getBoundingClientRect
    if (!containerWidth || containerWidth === 0) {
      const containerRect = sliderContainer.getBoundingClientRect();
      containerWidth = containerRect.width;
    }

    // 如果还是获取不到，尝试查找背景图片的宽度作为参考
    if (!containerWidth || containerWidth === 0) {
      const backgroundImage = findBackgroundImage();
      if (backgroundImage) {
        const bgRect = backgroundImage.getBoundingClientRect();
        containerWidth = bgRect.width;
        logger.debug('使用背景图片宽度作为容器宽度:', containerWidth);
      }
    }

    if (!containerWidth || containerWidth === 0) {
      logger.error('无法获取容器宽度', {
        clientWidth: sliderContainer.clientWidth,
        offsetWidth: sliderContainer.offsetWidth,
        scrollWidth: sliderContainer.scrollWidth,
        boundingRect: sliderContainer.getBoundingClientRect(),
      });
      return false;
    }

    logger.debug('获取到容器宽度:', containerWidth);

    // 重新获取元素位置（确保是最新的）
    const sliderRect = slider.getBoundingClientRect();

    // 计算目标位置（像素）- 相对于容器
    const targetX = (containerWidth * percentage) / 100 + sliderRect.width / 2 - 10;

    // 获取滑块当前位置（相对于容器）- yidun_slider 的 left 位置
    const currentLeft = parseInt(slider.style.left) || 0;
    const currentX = currentLeft;

    // 计算需要移动的距离
    const distance = targetX - currentX;

    logger.debug(
      `开始拖动滑块: 当前位置 ${currentX}px (left: ${currentLeft}px), 目标位置 ${targetX}px, 需要移动 ${distance}px`
    );

    // 确保元素可见
    if (slider.offsetParent === null) {
      slider.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // 获取滑块的中心点坐标
    const sliderCenterX = sliderRect.left + sliderRect.width / 2;
    const sliderCenterY = sliderRect.top + sliderRect.height / 2;

    // 模拟 mousedown（在滑块上）
    const mouseDownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX: sliderCenterX,
      clientY: sliderCenterY,
    });
    slider.dispatchEvent(mouseDownEvent);
    // 也在容器上触发，因为有些实现可能监听容器
    sliderContainer.dispatchEvent(mouseDownEvent);

    // 等待一下
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 模拟拖动过程（分多步，模拟人类拖动）
    const steps = 20; // 分20步完成拖动
    const stepDistance = distance / steps;
    const stepDelay = 10; // 每步延迟10ms

    for (let i = 1; i <= steps; i++) {
      const currentStepX = sliderCenterX + stepDistance * i;
      const currentStepY = sliderCenterY + Math.sin((i / steps) * Math.PI) * 2; // 添加轻微的垂直抖动，模拟人类拖动

      const mouseMoveEvent = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 1,
        clientX: currentStepX,
        clientY: currentStepY,
      });
      slider.dispatchEvent(mouseMoveEvent);
      sliderContainer.dispatchEvent(mouseMoveEvent);
      document.dispatchEvent(mouseMoveEvent);

      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }

    // 最终位置
    const finalX = sliderCenterX + distance;
    const finalY = sliderCenterY;

    // 最后一次 mousemove 到精确位置
    const finalMouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX: finalX,
      clientY: finalY,
    });
    slider.dispatchEvent(finalMouseMoveEvent);
    sliderContainer.dispatchEvent(finalMouseMoveEvent);
    document.dispatchEvent(finalMouseMoveEvent);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // 模拟 mouseup
    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 0,
      clientX: finalX,
      clientY: finalY,
    });
    slider.dispatchEvent(mouseUpEvent);
    sliderContainer.dispatchEvent(mouseUpEvent);
    document.dispatchEvent(mouseUpEvent);

    logger.info(`滑块拖动完成，已移动到 ${percentage}% 位置`);
    return true;
  } catch (error) {
    logger.error('拖动滑块失败:', error);
    return false;
  }
}

/**
 * 获取验证码图片并调用 API
 */
async function getCaptchaImagesAndCallAPI(): Promise<number | null> {
  logger.debug('开始获取验证码图片...');

  // 查找滑块图片
  const sliderImage = findSliderImage();
  if (!sliderImage) {
    logger.error('未找到滑块图片');
    return null;
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
    logger.error('未找到背景图片');
    return null;
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
    logger.debug('正在转换滑块图片为 base64...');
    const targetBase64 = await imageToBase64(sliderImage);
    logger.debug('滑块图片 base64 长度:', targetBase64.length);

    logger.debug('正在转换背景图片为 base64...');
    const backgroundBase64 = await imageToBase64(backgroundImage);
    logger.debug('背景图片 base64 长度:', backgroundBase64.length);

    // 调用 API
    logger.debug('正在调用 API 获取滑块位置...');
    const percentage = await getSliderPosition(targetBase64, backgroundBase64);
    logger.info(`获取到滑块位置百分比: ${percentage}%`);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 滑动滑块到目标位置
    await slideToPosition(percentage);

    return percentage;
  } catch (error) {
    logger.error('处理验证码图片失败:', error);
    return null;
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
      logger.info(`尝试获取验证码图片 (第 ${attempt}/${maxRetries} 次)...`);
      const result = await getCaptchaImagesAndCallAPI();

      if (result !== null) {
        logger.info(`成功获取验证码位置: ${result}%`);
        return result;
      } else {
        // 如果返回 null，说明某些步骤失败了，继续重试
        logger.warn(`第 ${attempt} 次尝试返回 null，准备重试...`);
        lastError = new Error('获取验证码图片返回 null');
      }
    } catch (error) {
      logger.error(`第 ${attempt} 次尝试失败:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    // 如果不是最后一次尝试，等待后重试
    if (attempt < maxRetries) {
      logger.debug(`等待 ${retryDelay}ms 后重试...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  logger.error(`所有 ${maxRetries} 次尝试都失败了`);
  if (lastError) {
    logger.error('最后一次错误:', lastError);
  }
  return null;
}

// 导出函数供外部调用
export {
  executeCaptchaClickFlow,
  clickCaptchaPopupTab,
  clickLoginButton,
  getCaptchaImagesAndCallAPI,
  getCaptchaImagesAndCallAPIWithRetry,
  getSliderPosition,
};
