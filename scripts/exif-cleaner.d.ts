/**
 * 浏览器端 EXIF 隐私信息清理工具 (TypeScript 声明文件)
 */

/**
 * 清理选项
 */
export interface CleanupOptions {
    /** 版权信息 */
    copyright?: string;
    /** 作者信息 */
    artist?: string;
    /** 时区偏移 (默认 +00:00) */
    offsetTime?: string;
}

/**
 * 清理结果
 */
export interface CleanupResult {
    /** 是否成功 */
    success: boolean;
    /** 清理后的 File 对象 */
    file: File | null;
    /** 清理后的 Blob 对象 */
    blob: Blob | null;
    /** 原始文件大小 */
    originalSize: number;
    /** 清理后的文件大小 */
    cleanedSize: number;
    /** 错误信息 */
    error: string | null;
    /** 删除的字段列表 */
    removedFields: string[];
    /** 添加的字段列表 */
    addedFields: string[];
    /** 转换来源格式 (如 'HEIC/HEIF') */
    convertedFrom?: string;
}

/**
 * 批量清理结果
 */
export interface BatchCleanupResult {
    /** 每个文件的处理结果 */
    results: CleanupResult[];
    /** 成功数量 */
    success: number;
    /** 失败数量 */
    failed: number;
    /** 总原始大小 */
    totalOriginalSize: number;
    /** 总清理后大小 */
    totalCleanedSize: number;
}

/**
 * 版权信息配置
 */
export interface CopyrightInfo {
    copyright: string;
    artist: string;
}

/**
 * EXIF Hook 返回值
 */
export interface ExifCleanerHook {
    /** 清理单个文件 */
    cleanFile: (file: File, options?: CleanupOptions) => Promise<CleanupResult>;
    /** 清理 Blob */
    cleanBlob: (blob: Blob, options?: CleanupOptions) => Promise<CleanupResult>;
    /** 批量清理文件 */
    cleanFiles: (
        files: File[],
        options?: CleanupOptions,
        onProgress?: (current: number, total: number, file: File) => void
    ) => Promise<BatchCleanupResult>;
    /** 是否正在处理 */
    isProcessing: boolean;
    /** 错误信息 */
    error: string | null;
}

/**
 * 默认版权信息
 */
export declare const DEFAULT_COPYRIGHT_INFO: CopyrightInfo;

/**
 * 默认时区偏移（UTC+0）
 */
export declare const DEFAULT_OFFSET_TIME: string;

/**
 * 隐私相关的 EXIF 标签（需要删除）
 */
export declare const PRIVACY_TAGS: Record<string, number>;

/**
 * 要保留的有用标签（白名单）
 */
export declare const USEFUL_TAGS: Record<string, number>;

/**
 * 清理 File 中的 EXIF 隐私信息
 * 
 * @param file - 原始图片文件
 * @param options - 清理选项
 * @returns 清理后的结果
 */
export declare function cleanupExifFromFile(
    file: File,
    options?: CleanupOptions
): Promise<CleanupResult>;

/**
 * 清理 Blob 中的 EXIF 隐私信息
 * 
 * @param blob - 原始图片 Blob
 * @param options - 清理选项
 * @returns 清理后的结果
 */
export declare function cleanupExifFromBlob(
    blob: Blob,
    options?: CleanupOptions
): Promise<CleanupResult>;

/**
 * 批量清理多个文件
 * 
 * @param files - 文件数组
 * @param options - 清理选项
 * @param onProgress - 进度回调
 * @returns 批量处理结果
 */
export declare function cleanupExifBatch(
    files: File[],
    options?: CleanupOptions,
    onProgress?: (current: number, total: number, file: File) => void
): Promise<BatchCleanupResult>;

/**
 * Vue 组合式 API Hook
 * 
 * @param defaultOptions - 默认选项
 * @returns Hook 对象
 */
export declare function useExifCleaner(
    defaultOptions?: CleanupOptions
): ExifCleanerHook;

/**
 * 检查是否为 JPEG 格式
 * 
 * @param file - 文件对象
 * @returns 是否为 JPEG
 */
export declare function isJpegFormat(file: File): boolean;

/**
 * 检查是否为 HEIC/HEIF 格式
 * 
 * @param file - 文件对象
 * @returns 是否为 HEIC/HEIF
 */
export declare function isHeicFormat(file: File): boolean;

/**
 * 检查是否为支持的图片格式 (JPEG 或 HEIC/HEIF)
 * 
 * @param file - 文件对象
 * @returns 是否支持
 */
export declare function isSupportedFormat(file: File): boolean;

/**
 * 格式化文件大小
 * 
 * @param bytes - 字节数
 * @returns 格式化后的字符串
 */
export declare function formatFileSize(bytes: number): string;

/**
 * 默认导出
 */
declare const _default: {
    cleanupExifFromFile: typeof cleanupExifFromFile;
    cleanupExifFromBlob: typeof cleanupExifFromBlob;
    cleanupExifBatch: typeof cleanupExifBatch;
    useExifCleaner: typeof useExifCleaner;
    isJpegFormat: typeof isJpegFormat;
    isHeicFormat: typeof isHeicFormat;
    isSupportedFormat: typeof isSupportedFormat;
    formatFileSize: typeof formatFileSize;
    DEFAULT_COPYRIGHT_INFO: CopyrightInfo;
    DEFAULT_OFFSET_TIME: string;
    PRIVACY_TAGS: Record<string, number>;
    USEFUL_TAGS: Record<string, number>;
};

export default _default;
