/**
 * 简化的加载指示器 - 提供良好的用户体验
 */

let currentLoader: any | null = null;
let isCurrentlyLoading = false;
let startTime = 0;

const spinners = ['▱▱▱▱▱▱', '▰▱▱▱▱▱', '▰▰▱▱▱▱', '▰▰▰▱▱▱', '▰▰▰▰▱▱', '▰▰▰▰▰▱', '▰▰▰▰▰▰'];
const progress = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const dots = ['⠧', '⠏', '⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦'];

interface LoadingConfig {
  message: string;
  type: 'spinner' | 'dots' | 'progress' | 'simple';
  showTime?: boolean;
}

/**
 * 显示加载指示器
 */
export function showLoading(message: string = '处理中', type: 'spinner' | 'dots' | 'progress' | 'simple' = 'spinner'): void {
  if (isCurrentlyLoading) {
    updateLoading(message);
    return;
  }

  isCurrentlyLoading = true;
  startTime = Date.now();
  
  let frameIndex = 0;
  const frames = getFrames(type);
  
  // 清除当前行
  process.stdout.write('\x1b[?25l'); // 隐藏光标
  
  currentLoader = setInterval(() => {
    const frame = frames[frameIndex % frames.length];
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // 清除当前行并写入新内容
    process.stdout.write('\r\x1b[K');
    process.stdout.write(`${frame} ${message} (${elapsed}s)`);
    
    frameIndex++;
  }, 150);
}

/**
 * 更新加载消息
 */
export function updateLoading(message: string): void {
  if (!isCurrentlyLoading) return;
  
  // 只是记录新消息，下次循环会显示
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  process.stdout.write('\r\x1b[K');
  process.stdout.write(`🤖 ${message} (${elapsed}s)`);
}

/**
 * 隐藏加载指示器
 */
export function hideLoading(): void {
  if (!isCurrentlyLoading) return;
  
  if (currentLoader) {
    clearInterval(currentLoader);
    currentLoader = null;
  }
  
  // 清除当前行并显示光标
  process.stdout.write('\r\x1b[K');
  process.stdout.write('\x1b[?25h'); // 显示光标
  
  isCurrentlyLoading = false;
  startTime = 0;
}

/**
 * 检查是否正在加载
 */
export function isLoading(): boolean {
  return isCurrentlyLoading;
}

/**
 * 获取动画帧
 */
function getFrames(type: string): string[] {
  switch (type) {
    case 'spinner':
      return spinners;
    case 'dots':
      return dots;
    case 'progress':
      return progress;
    case 'simple':
      return ['🤖'];
    default:
      return spinners;
  }
}

/**
 * 步骤加载器 - 用于多步骤操作
 */
export class StepLoader {
  private steps: string[] = [];
  private currentStep = 0;
  private totalSteps = 0;
  
  constructor(steps: string[]) {
    this.steps = steps;
    this.totalSteps = steps.length;
  }
  
  start(): void {
    this.currentStep = 0;
    this.showCurrentStep();
  }
  
  nextStep(): void {
    if (this.currentStep < this.totalSteps - 1) {
      this.currentStep++;
      this.showCurrentStep();
    }
  }
  
  finish(): void {
    hideLoading();
    console.log('✅ 所有步骤完成');
  }
  
  private showCurrentStep(): void {
    const step = this.steps[this.currentStep];
    const progress = `[${this.currentStep + 1}/${this.totalSteps}]`;
    showLoading(`${progress} ${step}`, 'spinner');
  }
}

/**
 * 高级加载包装器 - 自动处理加载状态
 */
export async function withLoading<T>(
  operation: () => Promise<T>,
  message: string = '处理中',
  type: 'spinner' | 'dots' | 'progress' | 'simple' = 'spinner'
): Promise<T> {
  showLoading(message, type);
  
  try {
    const result = await operation();
    hideLoading();
    return result;
  } catch (error) {
    hideLoading();
    throw error;
  }
}

/**
 * 智能加载器 - 根据操作时间自动选择显示策略
 */
export async function smartLoading<T>(
  operation: () => Promise<T>,
  message: string = '处理中'
): Promise<T> {
  const start = Date.now();
  
  // 如果操作很快（<500ms），不显示加载器
  const quickPromise = operation();
  const timeoutPromise = new Promise<null>((resolve) => 
    setTimeout(() => resolve(null), 500)
  );
  
  const result = await Promise.race([quickPromise, timeoutPromise]);
  
  if (result !== null) {
    // 操作已完成，不需要显示加载器
    return result as T;
  }
  
  // 操作较慢，显示加载器
  showLoading(message, 'spinner');
  
  try {
    const finalResult = await quickPromise;
    hideLoading();
    return finalResult;
  } catch (error) {
    hideLoading();
    throw error;
  }
}

// 优雅关闭处理
process.on('SIGINT', () => {
  hideLoading();
  console.log('\n👋 程序已退出');
  process.exit(0);
});

process.on('SIGTERM', () => {
  hideLoading();
  process.exit(0);
}); 