/**
 * 浏览器端图片压缩/缩放工具 (TypeScript 声明文件)
 */

/**
 * 缩放选项
 */
export interface ResizeOptions {
    /** 最大宽度 (0 = 不限制) */
    maxWidth?: number;
    /** 最大高度 (0 = 不限制) */
    maxHeight?: number;
    /** 输出格式 */
    format?: 'webp' | 'jpeg' | 'png';
    /** 压缩质量 (0-1) */
    quality?: number;
}

/**
 * 缩放结果
 */
export interface ResizeResult {
    /** 是否成功 */
    success: boolean;
    /** 处理后的 Blob */
    blob: Blob | null;
    /** Blob URL (可直接用于 img.src) */
    url: string | null;
    /** 原始文件大小 (bytes) */
    originalSize: number;
    /** 压缩后文件大小 (bytes) */
    compressedSize: number;
    /** 实际输出格式 */
    format: string;
    /** 输出宽度 */
    width: number;
    /** 输出高度 */
    height: number;
    /** 是否来自缓存 */
    fromCache: boolean;
    /** 错误信息 */
    error: string | null;
}

/**
 * Hook 返回值
 */
export interface ImageResizerHook {
    /** 缩放图片 */
    resize: (url: string, options?: ResizeOptions) => Promise<ResizeResult>;
    /** 清除缓存 */
    clearCache: () => void;
    /** 是否正在处理 */
    isProcessing: boolean;
    /** 错误信息 */
    error: string | null;
}

/**
 * 默认选项
 */
export declare const DEFAULT_OPTIONS: Required<ResizeOptions>;

/**
 * 清除内存缓存
 */
export declare function clearCache(): void;

/**
 * 格式化文件大小
 */
export declare function formatFileSize(bytes: number): string;

/**
 * 缩放并压缩图片
 * 
 * @param url - 图片 URL
 * @param options - 缩放选项
 * @returns 处理结果
 */
export declare function resizeImage(
    url: string,
    options?: ResizeOptions
): Promise<ResizeResult>;

/**
 * 批量处理图片
 * 
 * @param items - 图片列表
 * @param onProgress - 进度回调
 * @returns 处理结果数组
 */
export declare function resizeImages(
    items: Array<{ url: string; options?: ResizeOptions }>,
    onProgress?: (current: number, total: number, result: ResizeResult) => void
): Promise<ResizeResult[]>;

/**
 * Vue 组合式 API Hook
 */
export declare function useImageResizer(
    defaultOptions?: ResizeOptions
): ImageResizerHook;

/**
 * 默认导出
 */
declare const _default: {
    resizeImage: typeof resizeImage;
    resizeImages: typeof resizeImages;
    useImageResizer: typeof useImageResizer;
    clearCache: typeof clearCache;
    formatFileSize: typeof formatFileSize;
    DEFAULT_OPTIONS: Required<ResizeOptions>;
};

export default _default;
