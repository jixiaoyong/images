/**
 * 浏览器端图片压缩/缩放工具 (ES Module)
 * 
 * 支持将图片按指定尺寸缩放并压缩为 WebP/JPEG/PNG 格式
 * 
 * @example
 * import { resizeImage } from 'https://jixiaoyong.github.io/images/scripts/image-resizer.js';
 * 
 * const result = await resizeImage('https://example.com/photo.jpg', {
 *   maxWidth: 800,
 *   maxHeight: 600,
 *   format: 'webp',
 *   quality: 0.8,
 * });
 * 
 * if (result.success) {
 *   img.src = result.url;
 * }
 */

// ============================================
// 内存缓存
// ============================================

const cache = new Map();

/**
 * 生成缓存键
 */
function getCacheKey(url, options) {
  return `${url}|${options.maxWidth || 0}|${options.maxHeight || 0}|${options.format || 'webp'}|${options.quality || 0.8}`;
}

/**
 * 清除缓存
 */
export function clearCache() {
  // 释放所有 Blob URL
  for (const result of cache.values()) {
    if (result.url && result.url.startsWith('blob:')) {
      URL.revokeObjectURL(result.url);
    }
  }
  cache.clear();
}

// ============================================
// 默认配置
// ============================================

export const DEFAULT_OPTIONS = {
  maxWidth: 0,        // 0 = 不限制
  maxHeight: 0,       // 0 = 不限制
  format: 'webp',     // 'webp' | 'jpeg' | 'png'
  quality: 0.8,       // 0-1
};

// ============================================
// 工具函数
// ============================================

/**
 * 检测浏览器是否支持 WebP
 */
let webpSupported = null;

async function checkWebPSupport() {
  if (webpSupported !== null) return webpSupported;
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      webpSupported = img.width > 0 && img.height > 0;
      resolve(webpSupported);
    };
    img.onerror = () => {
      webpSupported = false;
      resolve(false);
    };
    // 1x1 WebP 图片
    img.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
  });
}

/**
 * 获取 MIME 类型
 */
function getMimeType(format, fallback = 'image/jpeg') {
  const types = {
    webp: 'image/webp',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
  };
  return types[format] || fallback;
}

/**
 * 加载图片
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`图片加载失败: ${url}`));
    img.src = url;
  });
}

/**
 * 计算缩放后的尺寸（保持比例）
 */
function calculateSize(originalWidth, originalHeight, maxWidth, maxHeight) {
  let width = originalWidth;
  let height = originalHeight;
  
  // 如果原图比目标小，不放大
  if ((!maxWidth || originalWidth <= maxWidth) && (!maxHeight || originalHeight <= maxHeight)) {
    return { width: originalWidth, height: originalHeight, scaled: false };
  }
  
  // 计算缩放比例
  let scale = 1;
  
  if (maxWidth && maxHeight) {
    scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
  } else if (maxWidth) {
    scale = maxWidth / originalWidth;
  } else if (maxHeight) {
    scale = maxHeight / originalHeight;
  }
  
  width = Math.round(originalWidth * scale);
  height = Math.round(originalHeight * scale);
  
  return { width, height, scaled: true };
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ============================================
// 主函数
// ============================================

/**
 * 缩放并压缩图片
 * 
 * @param {string} url - 图片 URL
 * @param {Object} options - 选项
 * @param {number} options.maxWidth - 最大宽度 (0 = 不限制)
 * @param {number} options.maxHeight - 最大高度 (0 = 不限制)
 * @param {string} options.format - 输出格式 ('webp' | 'jpeg' | 'png')
 * @param {number} options.quality - 压缩质量 (0-1)
 * @returns {Promise<Object>} 处理结果
 */
export async function resizeImage(url, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // 检查缓存
  const cacheKey = getCacheKey(url, opts);
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    return { ...cached, fromCache: true };
  }
  
  // 结果对象
  const result = {
    success: false,
    blob: null,
    url: null,
    originalSize: 0,
    compressedSize: 0,
    format: opts.format,
    width: 0,
    height: 0,
    fromCache: false,
    error: null,
  };
  
  try {
    // 1. 获取原图大小
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }
    
    const originalBlob = await response.blob();
    result.originalSize = originalBlob.size;
    
    // 2. 检查是否为 GIF（直接返回原图）
    if (originalBlob.type === 'image/gif') {
      result.success = true;
      result.blob = originalBlob;
      result.url = URL.createObjectURL(originalBlob);
      result.compressedSize = originalBlob.size;
      result.format = 'gif';
      cache.set(cacheKey, result);
      return result;
    }
    
    // 3. 加载图片
    const img = await loadImage(url);
    
    // 4. 计算目标尺寸
    const { width, height, scaled } = calculateSize(
      img.naturalWidth,
      img.naturalHeight,
      opts.maxWidth,
      opts.maxHeight
    );
    
    result.width = width;
    result.height = height;
    
    // 5. 如果不需要缩放且格式相同，返回原图
    if (!scaled && originalBlob.type === getMimeType(opts.format)) {
      result.success = true;
      result.blob = originalBlob;
      result.url = URL.createObjectURL(originalBlob);
      result.compressedSize = originalBlob.size;
      cache.set(cacheKey, result);
      return result;
    }
    
    // 6. 确定输出格式
    let outputFormat = opts.format;
    if (outputFormat === 'webp') {
      const supportsWebP = await checkWebPSupport();
      if (!supportsWebP) {
        outputFormat = 'jpeg';
        result.format = 'jpeg';
      }
    }
    
    // 7. Canvas 压缩
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Canvas 失败，返回原图
      result.success = true;
      result.blob = originalBlob;
      result.url = URL.createObjectURL(originalBlob);
      result.compressedSize = originalBlob.size;
      result.error = 'Canvas 不可用，返回原图';
      cache.set(cacheKey, result);
      return result;
    }
    
    // 绘制图片
    ctx.drawImage(img, 0, 0, width, height);
    
    // 8. 导出为 Blob
    const mimeType = getMimeType(outputFormat);
    const quality = outputFormat === 'png' ? undefined : opts.quality;
    
    const compressedBlob = await new Promise((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });
    
    if (!compressedBlob) {
      // 导出失败，返回原图
      result.success = true;
      result.blob = originalBlob;
      result.url = URL.createObjectURL(originalBlob);
      result.compressedSize = originalBlob.size;
      result.error = 'Canvas 导出失败，返回原图';
      cache.set(cacheKey, result);
      return result;
    }
    
    // 9. 成功
    result.success = true;
    result.blob = compressedBlob;
    result.url = URL.createObjectURL(compressedBlob);
    result.compressedSize = compressedBlob.size;
    
    // 缓存结果
    cache.set(cacheKey, result);
    
    return result;
    
  } catch (error) {
    result.error = error.message || String(error);
    return result;
  }
}

/**
 * 批量处理图片
 * 
 * @param {Array<{url: string, options?: Object}>} items - 图片列表
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Array>} 处理结果数组
 */
export async function resizeImages(items, onProgress) {
  const results = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = await resizeImage(item.url, item.options);
    results.push(result);
    
    if (onProgress) {
      onProgress(i + 1, items.length, result);
    }
  }
  
  return results;
}

// ============================================
// Vue 组合式 API Hook
// ============================================

/**
 * Vue 组合式 API Hook
 */
export function useImageResizer(defaultOptions = {}) {
  let isProcessing = false;
  let error = null;
  
  async function resize(url, options) {
    isProcessing = true;
    error = null;
    
    try {
      const result = await resizeImage(url, { ...defaultOptions, ...options });
      if (!result.success) {
        error = result.error || '处理失败';
      }
      return result;
    } finally {
      isProcessing = false;
    }
  }
  
  return {
    resize,
    clearCache,
    isProcessing,
    error,
  };
}

// ============================================
// 导出默认对象
// ============================================

export default {
  resizeImage,
  resizeImages,
  useImageResizer,
  clearCache,
  formatFileSize,
  DEFAULT_OPTIONS,
};
