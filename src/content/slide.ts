// 下载 canvas 图片的辅助函数
// function downloadCanvasImage(canvas: HTMLCanvasElement, filename: string) {
//   try {
//     canvas.toBlob((blob) => {
//       if (blob) {
//         const url = URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = filename;
//         document.body.appendChild(a);
//         a.click();
//         document.body.removeChild(a);
//         URL.revokeObjectURL(url);
//         console.log('Canvas 图片已下载:', filename);
//       }
//     }, 'image/png');
//   } catch (error) {
//     console.error('下载 Canvas 图片失败:', error);
//   }
// }

// 计算滑动距离（优先使用拼图块位置，避免跨域问题）
async function calculateSlideDistance(): Promise<number> {
  // 等待验证码完全加载，并等待拼图块位置被设置
  console.log('等待验证码加载...');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 等待拼图块位置被设置（最多等待3秒）
  let jigsaw = document.querySelector('.yidun_jigsaw') as HTMLElement;
  let waitCount = 0;
  const maxWait = 12; // 12次 * 250ms = 3秒

  while (waitCount < maxWait && jigsaw) {
    const jigsawLeft = parseFloat(jigsaw.style.left) || 0;
    if (jigsawLeft > 0) {
      console.log('拼图块位置已设置:', jigsawLeft);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    waitCount++;
    jigsaw = document.querySelector('.yidun_jigsaw') as HTMLElement;
  }

  // 方法1：通过拼图块和背景容器的位置关系计算
  const bgContainer = document.querySelector('.yidun_bgimg') as HTMLElement;
  const control = document.querySelector('.yidun_control') as HTMLElement;

  console.log('=== 方法1：拼图块位置检测 ===');
  console.log('拼图块元素:', jigsaw);
  console.log('背景容器元素:', bgContainer);
  console.log('控制条元素:', control);

  if (jigsaw && bgContainer && control) {
    // 尝试多种方式获取拼图块的 left 位置
    let jigsawLeft = 0;

    // 方式1：通过 style.left
    const styleLeft = jigsaw.style.left;
    if (styleLeft) {
      jigsawLeft = parseFloat(styleLeft);
      console.log('通过 style.left 获取位置:', jigsawLeft);
    }

    // 方式2：通过 getComputedStyle
    if (jigsawLeft === 0 || isNaN(jigsawLeft)) {
      const computedStyle = window.getComputedStyle(jigsaw);
      const computedLeft = parseFloat(computedStyle.left);
      if (!isNaN(computedLeft)) {
        jigsawLeft = computedLeft;
        console.log('通过 getComputedStyle 获取位置:', jigsawLeft);
      }
    }

    // 方式3：通过 getBoundingClientRect（相对于背景容器）
    if (jigsawLeft === 0 || isNaN(jigsawLeft)) {
      const jigsawRect = jigsaw.getBoundingClientRect();
      const bgRect = bgContainer.getBoundingClientRect();
      jigsawLeft = jigsawRect.left - bgRect.left;
      console.log('通过 getBoundingClientRect 获取位置:', jigsawLeft);
    }

    // 获取控制条的宽度（滑动条的最大移动距离）
    const controlWidth = control.offsetWidth;
    const bgWidth = bgContainer.offsetWidth;

    console.log('拼图块位置:', jigsawLeft);
    console.log('背景宽度:', bgWidth);
    console.log('控制条宽度:', controlWidth);

    // 拼图块的 left 位置通常就是需要滑动的距离
    // 但需要考虑缩放比例
    if (jigsawLeft > 0 && !isNaN(jigsawLeft)) {
      // 计算缩放比例
      const scale = controlWidth / bgWidth;
      const slideDistance = jigsawLeft * scale;
      console.log('缩放比例:', scale);
      console.log('通过拼图块位置计算滑动距离:', slideDistance, '像素');
      return slideDistance;
    } else {
      console.log('拼图块位置无效或为0，继续尝试其他方法');
    }
  } else {
    console.log('未找到必要的元素，继续尝试其他方法');
  }

  // 方法2：尝试通过图片分析（需要处理跨域）
  console.log('=== 方法2：图片分析 ===');
  const bgImg = document.querySelector('.yidun_bg-img') as HTMLImageElement;
  const jigsawImg = document.querySelector('.yidun_jigsaw') as HTMLImageElement;

  console.log('背景图元素:', bgImg);
  console.log('拼图块图片元素:', jigsawImg);

  if (!bgImg || !jigsawImg) {
    console.log('未找到验证码图片元素');
    return 0;
  }

  try {
    // 设置 crossOrigin 属性以允许跨域访问
    if (!bgImg.crossOrigin) {
      bgImg.crossOrigin = 'anonymous';
    }
    if (!jigsawImg.crossOrigin) {
      jigsawImg.crossOrigin = 'anonymous';
    }

    // 重新加载图片以应用 crossOrigin
    const bgSrc = bgImg.src;
    const jigsawSrc = jigsawImg.src;
    bgImg.src = '';
    jigsawImg.src = '';
    await new Promise((resolve) => setTimeout(resolve, 100));
    bgImg.src = bgSrc;
    jigsawImg.src = jigsawSrc;

    // 等待图片加载完成
    await new Promise((resolve) => {
      let loaded = 0;
      const checkLoaded = () => {
        loaded++;
        if (loaded === 2) resolve(true);
      };
      if (bgImg.complete) checkLoaded();
      else bgImg.onload = checkLoaded;
      if (jigsawImg.complete) checkLoaded();
      else jigsawImg.onload = checkLoaded;
    });

    // 获取图片的真实尺寸（使用 naturalWidth/naturalHeight 而不是显示尺寸）
    const bgWidth = bgImg.naturalWidth || bgImg.width;
    const bgHeight = bgImg.naturalHeight || bgImg.height;
    const jigsawWidth = jigsawImg.naturalWidth || jigsawImg.width;
    const jigsawHeight = jigsawImg.naturalHeight || jigsawImg.height;

    console.log('背景图真实尺寸:', bgWidth, 'x', bgHeight);
    console.log('拼图块真实尺寸:', jigsawWidth, 'x', jigsawHeight);

    // 创建canvas来分析图片（使用背景图尺寸）
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    canvas.width = bgWidth;
    canvas.height = bgHeight;

    // 绘制背景图
    ctx.drawImage(bgImg, 0, 0, bgWidth, bgHeight);
    const bgImageData = ctx.getImageData(0, 0, bgWidth, bgHeight);

    // 下载背景图（使用真实尺寸）
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = bgWidth;
    bgCanvas.height = bgHeight;
    const bgCtx = bgCanvas.getContext('2d');
    if (bgCtx) {
      bgCtx.drawImage(bgImg, 0, 0, bgWidth, bgHeight);
      //   downloadCanvasImage(bgCanvas, `yidun-bg-${Date.now()}.png`);
    }

    // 模板匹配算法：在背景图中找到拼图块的最佳匹配位置
    console.log('开始图片分析，Canvas尺寸:', canvas.width, 'x', canvas.height);
    console.log('拼图块尺寸:', jigsawWidth, 'x', jigsawHeight);

    // 检查图片数据是否有效
    if (!bgImageData) {
      console.log('背景图数据无效，无法进行分析');
      return 0;
    }

    // 创建拼图块的图像数据（在独立的canvas上）
    const jigsawCanvas = document.createElement('canvas');
    jigsawCanvas.width = jigsawWidth;
    jigsawCanvas.height = jigsawHeight;
    const jigsawCtx = jigsawCanvas.getContext('2d');
    if (!jigsawCtx) {
      console.log('无法创建拼图块canvas');
      return 0;
    }
    jigsawCtx.drawImage(jigsawImg, 0, 0, jigsawWidth, jigsawHeight);

    // 下载拼图块
    // downloadCanvasImage(jigsawCanvas, `yidun-jigsaw-${Date.now()}.png`);

    // 获取拼图块的图像数据
    const jigsawImageData = jigsawCtx.getImageData(0, 0, jigsawWidth, jigsawHeight);

    if (!jigsawImageData) {
      console.log('拼图块数据无效，无法进行分析');
      return 0;
    }

    // 获取容器的实际显示宽度
    const bgContainer = document.querySelector('.yidun_bgimg') as HTMLElement;
    const containerWidth = bgContainer?.offsetWidth || canvas.width;
    const scale = containerWidth / canvas.width;

    console.log('容器显示宽度:', containerWidth);
    console.log('缩放比例:', scale);

    // 在合理范围内搜索（拼图通常在右侧，且不能超出背景图范围）
    const searchStart = Math.floor(bgWidth * 0.2);
    const searchEnd = Math.min(Math.floor(bgWidth * 0.9), bgWidth - jigsawWidth);

    console.log('搜索范围:', searchStart, '到', searchEnd);

    let maxMatch = 0;
    let bestX = 0;

    // 模板匹配：在背景图的每个可能位置，计算拼图块与背景的匹配度
    for (let x = searchStart; x < searchEnd; x += 1) {
      let matchScore = 0;
      let validPixels = 0;

      // 在拼图块覆盖的区域内，比较拼图块和背景图的相似度
      for (let jy = 0; jy < jigsawHeight && jy < bgHeight; jy++) {
        for (let jx = 0; jx < jigsawWidth && x + jx < bgWidth; jx++) {
          const bgX = x + jx;
          const bgY = jy;

          const bgIndex = (bgY * bgWidth + bgX) * 4;
          const jigsawIndex = (jy * jigsawWidth + jx) * 4;

          // 检查索引是否越界
          if (bgIndex >= bgImageData.data.length || jigsawIndex >= jigsawImageData.data.length) {
            continue;
          }

          const bgR = bgImageData.data[bgIndex];
          const bgG = bgImageData.data[bgIndex + 1];
          const bgB = bgImageData.data[bgIndex + 2];

          const jigsawR = jigsawImageData.data[jigsawIndex];
          const jigsawG = jigsawImageData.data[jigsawIndex + 1];
          const jigsawB = jigsawImageData.data[jigsawIndex + 2];
          const jigsawA = jigsawImageData.data[jigsawIndex + 3];

          // 如果拼图块像素是透明的，跳过
          if (jigsawA < 128) {
            continue;
          }

          validPixels++;

          // 计算颜色相似度（使用欧氏距离的倒数，相似度越高分数越高）
          const colorDiff = Math.sqrt(
            Math.pow(bgR - jigsawR, 2) + Math.pow(bgG - jigsawG, 2) + Math.pow(bgB - jigsawB, 2)
          );

          // 相似度分数（差异越小，分数越高）
          const similarity = 255 - Math.min(colorDiff, 255);
          matchScore += similarity;
        }
      }

      // 计算平均匹配分数
      if (validPixels > 0) {
        const avgMatch = matchScore / validPixels;
        if (avgMatch > maxMatch) {
          maxMatch = avgMatch;
          bestX = x;
        }
      }
    }

    console.log('最大匹配分数:', maxMatch);
    console.log('最佳X位置:', bestX);

    // 如果匹配分数太低，说明可能没有找到匹配位置
    if (maxMatch < 50) {
      console.log('匹配分数太低，可能图片分析失败');
      return 0;
    }

    // 转换为实际滑动距离（考虑缩放）
    const slideDistance = bestX * scale;
    console.log('通过图片分析计算出的滑动距离:', slideDistance, '像素');

    if (slideDistance <= 0) {
      console.log('计算出的滑动距离无效');
      return 0;
    }

    return slideDistance;
  } catch (error) {
    console.log('图片分析失败（可能是跨域问题）:', error);
    // 如果图片分析失败，返回0，让备用方法处理
    return 0;
  }
}

// 模拟鼠标拖动操作（改进版，更真实）
async function simulateDrag(element: HTMLElement, distance: number) {
  const rect = element.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const endX = startX + distance;
  const endY = startY;

  console.log('开始拖动，距离:', distance, '起始位置:', startX, endX);

  // 创建鼠标事件
  const createMouseEvent = (type: string, x: number, y: number, button = 0) => {
    return new MouseEvent(type, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      button: button,
      buttons: type === 'mousedown' ? 1 : type === 'mouseup' ? 0 : 1,
      which: type === 'mousedown' ? 1 : 0,
    });
  };

  // 创建触摸事件（某些验证码可能需要）
  const createTouchEvent = (type: string, x: number, y: number) => {
    const touch = new Touch({
      identifier: Date.now(),
      target: element,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      pageX: x,
      pageY: y,
      radiusX: 2.5,
      radiusY: 2.5,
      rotationAngle: 0,
      force: 1,
    });

    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: type === 'touchstart' || type === 'touchmove' ? [touch] : [],
      targetTouches: type === 'touchstart' || type === 'touchmove' ? [touch] : [],
      changedTouches: [touch],
    });
  };

  // 方法1：尝试使用鼠标事件
  try {
    // 触发鼠标按下
    element.dispatchEvent(createMouseEvent('mousedown', startX, startY, 0));
    element.dispatchEvent(createMouseEvent('pointerdown', startX, startY, 0));
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 模拟拖动过程（使用更真实的轨迹）
    const steps = 30 + Math.floor(Math.random() * 10); // 随机步数

    // 使用缓动函数使拖动更自然
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const easedProgress = easeOutCubic(progress);
      const currentX = startX + distance * easedProgress;

      // 添加轻微的垂直抖动和水平抖动（模拟人类手抖）
      const randomY = startY + (Math.random() - 0.5) * 3;
      const randomX = currentX + (Math.random() - 0.5) * 2;

      // 同时触发多个事件类型
      element.dispatchEvent(createMouseEvent('mousemove', randomX, randomY));
      document.dispatchEvent(createMouseEvent('mousemove', randomX, randomY));
      element.dispatchEvent(createMouseEvent('pointermove', randomX, randomY));

      // 直接更新滑块位置（某些验证码可能需要）
      const slider = document.querySelector('.yidun_slider') as HTMLElement;
      const indicator = document.querySelector('.yidun_slide_indicator') as HTMLElement;
      if (slider) {
        const sliderLeft = Math.min(distance * easedProgress, distance);
        slider.style.left = `${sliderLeft}px`;
      }
      if (indicator) {
        const indicatorWidth = Math.min(distance * easedProgress, distance);
        indicator.style.width = `${indicatorWidth}px`;
      }

      // 随机延迟，模拟人类操作
      await new Promise((resolve) => setTimeout(resolve, 8 + Math.random() * 12));
    }

    // 触发鼠标释放
    element.dispatchEvent(createMouseEvent('mouseup', endX, endY, 0));
    element.dispatchEvent(createMouseEvent('pointerup', endX, endY, 0));
    element.dispatchEvent(createMouseEvent('click', endX, endY, 0));

    await new Promise((resolve) => setTimeout(resolve, 200));
  } catch (error) {
    console.log('鼠标事件拖动失败，尝试触摸事件:', error);

    // 方法2：尝试使用触摸事件
    try {
      element.dispatchEvent(createTouchEvent('touchstart', startX, startY));
      await new Promise((resolve) => setTimeout(resolve, 50));

      const steps = 20;
      const stepDistance = distance / steps;
      for (let i = 1; i <= steps; i++) {
        const currentX = startX + stepDistance * i;
        const currentY = startY + (Math.random() - 0.5) * 2;
        element.dispatchEvent(createTouchEvent('touchmove', currentX, currentY));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      element.dispatchEvent(createTouchEvent('touchend', endX, endY));
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (touchError) {
      console.log('触摸事件也失败:', touchError);
    }
  }
}

// 检测验证结果（通过多种方式）
async function checkVerificationResult(): Promise<boolean | null> {
  // 方法1：检测容器是否有成功类名
  const yidunContainer = document.querySelector(
    '.yidun.yidun--light.yidun--success.yidun--jigsaw'
  ) as HTMLElement;
  if (yidunContainer) {
    console.log('检测到成功类名: yidun--success');
    return true;
  }

  // 方法2：检测滑块的背景色是否为成功颜色 #52ccba
  const slider = document.querySelector('.yidun_control .yidun_slider') as HTMLElement;
  if (slider) {
    const computedStyle = window.getComputedStyle(slider);
    const bgColor = computedStyle.backgroundColor;

    // 将颜色转换为rgb格式进行比较
    // #52ccba 转换为 rgb(82, 204, 186)
    const successColorRgb = 'rgb(82, 204, 186)';
    const successColorRgba = 'rgba(82, 204, 186, 1)';

    if (bgColor === successColorRgb || bgColor === successColorRgba) {
      console.log('检测到成功背景色:', bgColor);
      return true;
    }
  }

  // 方法3：检测提示文本
  const tips = document.querySelector('.yidun_tips') as HTMLElement;
  if (tips) {
    const tipsText = tips.textContent || '';

    if (
      tipsText.includes('成功') ||
      tipsText.includes('通过') ||
      tips.classList.contains('yidun--success')
    ) {
      console.log('检测到成功提示文本:', tipsText);
      return true;
    } else if (
      tipsText.includes('失败') ||
      tipsText.includes('错误') ||
      tipsText.includes('请重试')
    ) {
      console.log('检测到失败提示:', tipsText);
      return false;
    }
  }

  // 未检测到明确结果
  return null;
}

// 处理易盾验证码滑动
async function handleYidunCaptcha() {
  console.log('开始处理易盾验证码...');

  // 等待验证码出现（最多等待5秒）
  let slider: HTMLElement | null = null;
  let control: HTMLElement | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts && (!slider || !control)) {
    slider = document.querySelector('.yidun_slider') as HTMLElement;
    control = document.querySelector('.yidun_control') as HTMLElement;

    if (!slider || !control) {
      console.log(`等待验证码加载... (${attempts + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }
  }

  if (!slider || !control) {
    console.log('未找到验证码滑块元素，可能验证码还未加载');
    return false;
  }

  console.log('找到验证码元素，开始计算滑动距离...');

  // 计算滑动距离
  const distance = await calculateSlideDistance();

  if (distance <= 0) {
    console.log('=== 备用方法：直接使用拼图块位置 ===');
    // 备用方法：直接使用拼图块的left位置
    const jigsaw = document.querySelector('.yidun_jigsaw') as HTMLElement;
    console.log('拼图块元素:', jigsaw);

    if (jigsaw) {
      // 尝试多种方式获取位置
      let jigsawLeft = 0;

      // 方式1：style.left
      const styleLeft = jigsaw.style.left;
      if (styleLeft) {
        jigsawLeft = parseFloat(styleLeft);
        console.log('备用方法 - 通过 style.left 获取:', jigsawLeft);
      }

      // 方式2：getComputedStyle
      if (jigsawLeft === 0 || isNaN(jigsawLeft)) {
        const computedStyle = window.getComputedStyle(jigsaw);
        const computedLeft = parseFloat(computedStyle.left);
        if (!isNaN(computedLeft)) {
          jigsawLeft = computedLeft;
          console.log('备用方法 - 通过 getComputedStyle 获取:', jigsawLeft);
        }
      }

      // 方式3：getBoundingClientRect
      if (jigsawLeft === 0 || isNaN(jigsawLeft)) {
        const bgContainer = document.querySelector('.yidun_bgimg') as HTMLElement;
        if (bgContainer) {
          const jigsawRect = jigsaw.getBoundingClientRect();
          const bgRect = bgContainer.getBoundingClientRect();
          jigsawLeft = jigsawRect.left - bgRect.left;
          console.log('备用方法 - 通过 getBoundingClientRect 获取:', jigsawLeft);
        }
      }

      if (jigsawLeft > 0 && !isNaN(jigsawLeft)) {
        console.log('使用备用方法计算距离:', jigsawLeft);
        await simulateDrag(slider, jigsawLeft);

        // 等待并检测验证结果
        console.log('开始检测验证结果（备用方法）...');
        const maxCheckAttempts = 20;
        let checkAttempts = 0;

        while (checkAttempts < maxCheckAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          const result = await checkVerificationResult();

          if (result === true) {
            return true;
          } else if (result === false) {
            return false;
          }

          checkAttempts++;
        }

        console.log('验证结果检测超时（备用方法）');
        return false;
      }
    }
    console.log('所有方法都失败，无法计算滑动距离');
    return false;
  }

  console.log('计算出的滑动距离:', distance, '开始执行滑动...');

  // 执行滑动
  await simulateDrag(slider, distance);

  // 等待并检测验证结果（轮询检测，最多等待5秒）
  console.log('开始检测验证结果...');
  const maxCheckAttempts = 20; // 最多检测20次
  let checkAttempts = 10;

  while (checkAttempts < maxCheckAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 150)); // 每250ms检测一次
    const result = await checkVerificationResult();

    if (result === true) {
      return true;
    } else if (result === false) {
      return false;
    }

    checkAttempts++;
  }

  console.log('验证结果检测超时，未检测到明确的成功或失败状态');
  return false;
}

const handleClick = async () => {
  console.log('开始执行登录流程...');

  let target1 = document.querySelector('.tcapt-tabs__tab:nth-child(3)');
  console.log('找到标签页元素:', target1);
  if (!target1) {
    console.log('没有找到目标元素');
    return;
  }
  (target1 as HTMLElement).click();
  console.log('已点击标签页');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  let loginBtn = document.querySelector('.tcapt-bind_btn.tcapt-bind_btn--login.j-pop');
  console.log('找到登录按钮:', loginBtn);
  if (!loginBtn) {
    console.log('没有找到登录按钮');
    return;
  }
  (loginBtn as HTMLElement).click();
  console.log('已点击登录按钮，等待验证码出现...');

  // 等待验证码出现后自动处理（增加等待时间）
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 尝试处理验证码（最多重试3次）
  let retryCount = 0;
  const maxRetries = 10;
  let success = false;

  while (retryCount < maxRetries && !success) {
    console.log(`尝试处理验证码 (${retryCount + 1}/${maxRetries})...`);
    success = await handleYidunCaptcha();

    if (!success && retryCount < maxRetries - 1) {
      console.log('验证失败，等待后重试...');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    retryCount++;
  }

  if (success) {
    console.log('验证码处理成功！');
  } else {
    console.log('验证码处理失败，已达到最大重试次数');
  }
};
