/**
 * 浏览器端 EXIF 隐私信息清理工具 (ES Module)
 * 
 * 基于 piexifjs 直接操作 EXIF 二进制数据，保持原图像素不变
 * 
 * @example
 * import { cleanupExifFromFile } from 'https://jixiaoyong.github.io/images/exif-cleaner.js';
 * 
 * async function handleUpload(file) {
 *   const result = await cleanupExifFromFile(file);
 *   if (result.success && result.file) {
 *     // 上传清理后的文件
 *   }
 * }
 */

// 动态加载 piexifjs
let piexifLoaded = null;

async function loadPiexif() {
  if (piexifLoaded) return piexifLoaded;
  
  piexifLoaded = (async () => {
    // 尝试从 jsdelivr CDN 加载 piexifjs ESM 版本
    const module = await import('https://cdn.jsdelivr.net/npm/piexifjs@1.0.6/+esm');
    
    // ESM 模块可能有多层嵌套，需要正确获取 piexif 对象
    let piexif = module.default || module;
    
    // 如果还有嵌套的 default，继续解包
    if (piexif && piexif.default && typeof piexif.default === 'object') {
      piexif = piexif.default;
    }
    
    // 验证 piexif 对象是否正确加载
    if (!piexif || typeof piexif.load !== 'function') {
      console.error('[exif-cleaner] piexif module structure:', module);
      console.error('[exif-cleaner] piexif object:', piexif);
      throw new Error('piexifjs 模块加载失败：无法找到 load 函数');
    }
    
    // 验证必要的属性是否存在
    if (!piexif.ImageIFD || !piexif.ExifIFD) {
      console.error('[exif-cleaner] piexif missing IFD constants:', {
        ImageIFD: piexif.ImageIFD,
        ExifIFD: piexif.ExifIFD,
        keys: Object.keys(piexif)
      });
      throw new Error('piexifjs 模块加载失败：缺少 IFD 常量');
    }
    
    console.log('[exif-cleaner] piexifjs loaded successfully');
    return piexif;
  })();
  
  return piexifLoaded;
}

// 动态加载 libheif-js (用于 HEIC/HEIF 解码)
let libheifLoaded = null;

async function loadLibheif() {
  if (libheifLoaded) return libheifLoaded;
  
  libheifLoaded = (async () => {
    // 从 jsdelivr CDN 加载 libheif-js ESM 版本
    const module = await import('https://cdn.jsdelivr.net/npm/libheif-js@1.18.2/+esm');
    return module.default || module;
  })();
  
  return libheifLoaded;
}

// ============================================
// 默认配置
// ============================================

/**
 * 默认版权信息
 */
export const DEFAULT_COPYRIGHT_INFO = {
  copyright: 'Copyright (c) jixiaoyong. All Rights Reserved. jixiaoyong.github.io',
  artist: 'jixiaoyong (jixiaoyong.github.io)',
};

/**
 * 默认时区偏移（UTC+0）
 */
export const DEFAULT_OFFSET_TIME = '+00:00';

// ============================================
// EXIF 标签参考（用于注释和调试）
// ============================================

/**
 * 隐私相关的 EXIF 标签（需要删除）
 */
export const PRIVACY_TAGS = {
  // IFD0 (0th)
  Make: 0x010F,           // 设备制造商
  Model: 0x0110,          // 设备型号
  Software: 0x0131,       // 软件
  HostComputer: 0x013C,   // 主机电脑
  
  // ExifIFD
  MakerNote: 0x927C,      // 制造商备注（包含 Apple 隐私数据）
  UserComment: 0x9286,    // 用户评论
  ImageUniqueID: 0xA420,  // 图像唯一 ID
  CameraOwnerName: 0xA430, // 相机所有者
  BodySerialNumber: 0xA431, // 机身序列号
  LensSerialNumber: 0xA435, // 镜头序列号
  LensMake: 0xA433,       // 镜头制造商
  LensModel: 0xA434,      // 镜头型号
  
  // 其他可能的隐私标签
  XPAuthor: 0x9C9D,       // Windows 作者
  XPComment: 0x9C9C,      // Windows 评论
};

/**
 * 要保留的有用标签（白名单）
 */
export const USEFUL_TAGS = {
  // IFD0
  Orientation: 0x0112,    // 显示方向（必须保留）
  XResolution: 0x011A,
  YResolution: 0x011B,
  ResolutionUnit: 0x0128,
  
  // ExifIFD
  ExifVersion: 0x9000,
  DateTimeOriginal: 0x9003,
  DateTimeDigitized: 0x9004,
  OffsetTimeOriginal: 0x9011,
  OffsetTimeDigitized: 0x9012,
  ExposureTime: 0x829A,   // 曝光时间
  FNumber: 0x829D,        // 光圈
  ISOSpeedRatings: 0x8827, // ISO
  FocalLength: 0x920A,    // 焦距
  Flash: 0x9209,          // 闪光灯
  WhiteBalance: 0xA403,   // 白平衡
  MeteringMode: 0x9207,   // 测光模式
  ExifImageWidth: 0xA002,
  ExifImageHeight: 0xA003,
  ColorSpace: 0xA001,     // 色彩空间
};

// ============================================
// 工具函数
// ============================================

/**
 * 将 File/Blob 转换为 Data URL
 */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 将 Data URL 转换为 Blob
 */
function dataURLToBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * 格式化日期为 EXIF 格式 (YYYY:MM:DD HH:MM:SS)
 * 保留日期，时分秒设为 00:00:00
 */
function formatExifDate(dateStr) {
  if (!dateStr) return null;
  
  // 尝试解析日期部分 (格式: YYYY:MM:DD HH:MM:SS)
  const match = dateStr.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}:${match[3]} 00:00:00`;
  }
  
  return null;
}

/**
 * 检查是否为支持的 JPEG 格式
 */
export function isJpegFormat(file) {
  return file.type === 'image/jpeg' || file.type === 'image/jpg';
}

/**
 * 检查是否为 HEIC/HEIF 格式
 */
export function isHeicFormat(file) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type === 'image/heic' || 
         type === 'image/heif' || 
         name.endsWith('.heic') || 
         name.endsWith('.heif');
}

/**
 * 检查是否为支持的图片格式 (JPEG 或 HEIC/HEIF)
 */
export function isSupportedFormat(file) {
  return isJpegFormat(file) || isHeicFormat(file);
}

/**
 * 将 HEIC/HEIF 转换为 JPEG Data URL
 * @param {File} file - HEIC/HEIF 文件
 * @param {number} quality - JPEG 质量 (0-1)
 * @returns {Promise<{dataURL: string, width: number, height: number}>}
 */
async function convertHeicToJpeg(file, quality = 0.92) {
  const libheif = await loadLibheif();
  
  // 读取文件为 ArrayBuffer
  const buffer = await file.arrayBuffer();
  
  // 创建 HeifDecoder 实例
  const decoder = new libheif.HeifDecoder();
  const data = decoder.decode(new Uint8Array(buffer));
  
  if (!data || data.length === 0) {
    throw new Error('无法解码 HEIC/HEIF 文件');
  }
  
  // 获取第一帧图像
  const image = data[0];
  const width = image.get_width();
  const height = image.get_height();
  
  // 创建 Canvas 并绘制
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 获取像素数据
  const imageData = ctx.createImageData(width, height);
  await new Promise((resolve, reject) => {
    image.display(imageData, (displayData) => {
      if (!displayData) {
        reject(new Error('HEIC 图像渲染失败'));
        return;
      }
      resolve();
    });
  });
  
  ctx.putImageData(imageData, 0, 0);
  
  // 转换为 JPEG Data URL
  const dataURL = canvas.toDataURL('image/jpeg', quality);
  
  return { dataURL, width, height };
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
// 主要清理函数
// ============================================

/**
 * 清理 EXIF 隐私信息
 * 
 * 工作流程:
 * 1. 解析 EXIF 二进制数据
 * 2. 删除 GPS（整个块）
 * 3. 删除设备信息（Make, Model, Software 等）
 * 4. 删除 MakerNotes（包含所有 Apple 隐私数据）
 * 5. 删除唯一标识（ImageUniqueID 等）
 * 6. 删除缩略图
 * 7. 添加版权信息
 * 8. 修改时间（保留日期，清除时分秒，设置时区为 UTC+0）
 * 9. 写回 EXIF（像素不变）
 * 
 * @param {File} file - 原始图片文件
 * @param {Object} options - 清理选项
 * @param {string} options.copyright - 版权信息
 * @param {string} options.artist - 作者信息
 * @param {string} options.offsetTime - 时区偏移 (默认 +00:00)
 * @returns {Promise<Object>} 清理结果
 */
export async function cleanupExifFromFile(file, options = {}) {
  const {
    copyright = DEFAULT_COPYRIGHT_INFO.copyright,
    artist = DEFAULT_COPYRIGHT_INFO.artist,
    offsetTime = DEFAULT_OFFSET_TIME,
  } = options;

  const originalSize = file.size;
  const result = {
    success: false,
    file: null,
    blob: null,
    originalSize,
    cleanedSize: 0,
    error: null,
    removedFields: [],
    addedFields: [],
  };

  try {
    // 检查是否为 HEIC/HEIF 格式
    if (isHeicFormat(file)) {
      result.removedFields.push('HEIC/HEIF converted to JPEG (all original metadata removed)');
      
      // 转换 HEIC 为 JPEG
      const { dataURL } = await convertHeicToJpeg(file, options.jpegQuality || 0.92);
      
      // 加载 piexifjs 添加版权信息
      const piexif = await loadPiexif();
      
      // 创建空的 EXIF 对象，只添加版权和时间信息
      const exifObj = {
        '0th': {},
        'Exif': {},
        'GPS': {},
        '1st': {},
        'Interop': {},
      };
      
      // 添加版权信息
      exifObj['0th'][piexif.ImageIFD.Copyright] = copyright;
      exifObj['0th'][piexif.ImageIFD.Artist] = artist;
      result.addedFields.push(`Copyright: ${copyright}`);
      result.addedFields.push(`Artist: ${artist}`);
      
      // 添加当前日期（清除时分秒）
      const now = new Date();
      const dateStr = `${now.getFullYear()}:${String(now.getMonth() + 1).padStart(2, '0')}:${String(now.getDate()).padStart(2, '0')} 00:00:00`;
      exifObj['Exif'][piexif.ExifIFD.DateTimeOriginal] = dateStr;
      exifObj['0th'][piexif.ImageIFD.DateTime] = dateStr;
      result.addedFields.push(`DateTimeOriginal: ${dateStr}`);
      
      // 设置时区为 UTC+0
      exifObj['Exif'][36881] = offsetTime; // OffsetTimeOriginal
      exifObj['Exif'][36882] = offsetTime; // OffsetTimeDigitized
      exifObj['Exif'][36880] = offsetTime; // OffsetTime
      result.addedFields.push(`OffsetTimeOriginal: ${offsetTime}`);
      
      // 写入 EXIF
      const exifBytes = piexif.dump(exifObj);
      const newDataURL = piexif.insert(exifBytes, dataURL);
      
      // 转换为 Blob
      const cleanedBlob = dataURLToBlob(newDataURL);
      
      // 创建新的 File 对象（扩展名改为 .jpg）
      const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      const cleanedFile = new File(
        [cleanedBlob],
        newFileName,
        { type: 'image/jpeg', lastModified: Date.now() }
      );
      
      result.success = true;
      result.file = cleanedFile;
      result.blob = cleanedBlob;
      result.cleanedSize = cleanedBlob.size;
      result.convertedFrom = 'HEIC/HEIF';
      
      return result;
    }
    
    // 检查是否为 JPEG 格式
    if (!isJpegFormat(file)) {
      // 对于其他格式，直接返回原文件
      result.success = true;
      result.file = file;
      result.blob = file;
      result.cleanedSize = file.size;
      result.error = '不支持的格式，跳过 EXIF 处理';
      return result;
    }

    // 加载 piexifjs
    const piexif = await loadPiexif();

    // 读取文件为 Data URL
    const dataURL = await blobToDataURL(file);

    // 解析 EXIF
    let exifObj;
    try {
      exifObj = piexif.load(dataURL);
      
      // ★★★ 调试日志：显示完整的 EXIF 结构 ★★★
      console.log('[exif-cleaner] === EXIF DEBUG START ===');
      console.log('[exif-cleaner] piexif.ImageIFD.Orientation constant:', piexif.ImageIFD.Orientation);
      console.log('[exif-cleaner] Raw exifObj["0th"]:', JSON.stringify(exifObj['0th'], null, 2));
      console.log('[exif-cleaner] exifObj["0th"] keys:', Object.keys(exifObj['0th'] || {}));
      console.log('[exif-cleaner] exifObj["Exif"] keys:', Object.keys(exifObj['Exif'] || {}));
      
      // 尝试不同方式获取 Orientation
      const ifd0Raw = exifObj['0th'] || {};
      console.log('[exif-cleaner] Orientation by constant:', ifd0Raw[piexif.ImageIFD.Orientation]);
      console.log('[exif-cleaner] Orientation by 274:', ifd0Raw[274]);  // 0x0112 = 274
      console.log('[exif-cleaner] Orientation by "274":', ifd0Raw['274']);
      console.log('[exif-cleaner] === EXIF DEBUG END ===');
      
    } catch (e) {
      // 无法解析 EXIF，可能是没有 EXIF 数据的图片
      result.success = true;
      result.file = file;
      result.blob = file;
      result.cleanedSize = file.size;
      result.error = '无法解析 EXIF 数据，返回原文件';
      return result;
    }

    // ===== 1. 删除 GPS 数据（整个块） =====
    if (exifObj['GPS'] && Object.keys(exifObj['GPS']).length > 0) {
      result.removedFields.push('GPS (entire block)');
      exifObj['GPS'] = {};
    }

    // ===== 2. 删除 IFD0 中的设备信息 =====
    const ifd0 = exifObj['0th'] || {};
    
    // ★★★ 在任何修改之前，先保存原始 Orientation（尝试多种方式）★★★
    // piexif.ImageIFD.Orientation = 274 (0x0112)
    let originalOrientation = ifd0[piexif.ImageIFD.Orientation];
    if (originalOrientation === undefined) {
      originalOrientation = ifd0[274]; // 直接用数字
    }
    if (originalOrientation === undefined) {
      originalOrientation = ifd0['274']; // 尝试字符串
    }
    console.log('[exif-cleaner] ★ Final originalOrientation:', originalOrientation);
    
    // 删除设备制造商和型号
    if (ifd0[piexif.ImageIFD.Make] !== undefined) {
      result.removedFields.push(`Make: ${ifd0[piexif.ImageIFD.Make]}`);
      delete ifd0[piexif.ImageIFD.Make];
    }
    if (ifd0[piexif.ImageIFD.Model] !== undefined) {
      result.removedFields.push(`Model: ${ifd0[piexif.ImageIFD.Model]}`);
      delete ifd0[piexif.ImageIFD.Model];
    }
    if (ifd0[piexif.ImageIFD.Software] !== undefined) {
      result.removedFields.push(`Software: ${ifd0[piexif.ImageIFD.Software]}`);
      delete ifd0[piexif.ImageIFD.Software];
    }
    // HostComputer (tag 0x013C = 316)
    if (ifd0[316] !== undefined) {
      result.removedFields.push(`HostComputer: ${ifd0[316]}`);
      delete ifd0[316];
    }

    // ===== 3. 删除 ExifIFD 中的隐私信息 =====
    const exifIfd = exifObj['Exif'] || {};
    
    // 删除 MakerNote（包含所有 Apple 隐私数据）
    if (exifIfd[piexif.ExifIFD.MakerNote] !== undefined) {
      result.removedFields.push('MakerNote (Apple privacy data)');
      delete exifIfd[piexif.ExifIFD.MakerNote];
    }
    
    // 删除用户评论
    if (exifIfd[piexif.ExifIFD.UserComment] !== undefined) {
      result.removedFields.push('UserComment');
      delete exifIfd[piexif.ExifIFD.UserComment];
    }
    
    // 删除图像唯一 ID
    if (exifIfd[piexif.ExifIFD.ImageUniqueID] !== undefined) {
      result.removedFields.push(`ImageUniqueID: ${exifIfd[piexif.ExifIFD.ImageUniqueID]}`);
      delete exifIfd[piexif.ExifIFD.ImageUniqueID];
    }
    
    // 删除相机所有者
    if (exifIfd[piexif.ExifIFD.CameraOwnerName] !== undefined) {
      result.removedFields.push(`CameraOwnerName: ${exifIfd[piexif.ExifIFD.CameraOwnerName]}`);
      delete exifIfd[piexif.ExifIFD.CameraOwnerName];
    }
    
    // 删除机身序列号
    if (exifIfd[piexif.ExifIFD.BodySerialNumber] !== undefined) {
      result.removedFields.push('BodySerialNumber');
      delete exifIfd[piexif.ExifIFD.BodySerialNumber];
    }
    
    // 删除镜头信息
    if (exifIfd[piexif.ExifIFD.LensMake] !== undefined) {
      result.removedFields.push(`LensMake: ${exifIfd[piexif.ExifIFD.LensMake]}`);
      delete exifIfd[piexif.ExifIFD.LensMake];
    }
    if (exifIfd[piexif.ExifIFD.LensModel] !== undefined) {
      result.removedFields.push(`LensModel: ${exifIfd[piexif.ExifIFD.LensModel]}`);
      delete exifIfd[piexif.ExifIFD.LensModel];
    }
    if (exifIfd[piexif.ExifIFD.LensSerialNumber] !== undefined) {
      result.removedFields.push('LensSerialNumber');
      delete exifIfd[piexif.ExifIFD.LensSerialNumber];
    }

    // ===== 4. 删除缩略图 =====
    if (exifObj['1st'] && Object.keys(exifObj['1st']).length > 0) {
      result.removedFields.push('Thumbnail');
      exifObj['1st'] = {};
    }
    if (exifObj['thumbnail']) {
      delete exifObj['thumbnail'];
    }

    // ===== 5. 添加/修改版权信息 =====
    ifd0[piexif.ImageIFD.Copyright] = copyright;
    result.addedFields.push(`Copyright: ${copyright}`);
    
    ifd0[piexif.ImageIFD.Artist] = artist;
    result.addedFields.push(`Artist: ${artist}`);

    // ===== 6. 修改时间信息 =====
    // 获取原始拍摄时间
    const dateTimeOriginal = exifIfd[piexif.ExifIFD.DateTimeOriginal];
    if (dateTimeOriginal) {
      const cleanedDate = formatExifDate(dateTimeOriginal);
      if (cleanedDate) {
        exifIfd[piexif.ExifIFD.DateTimeOriginal] = cleanedDate;
        result.addedFields.push(`DateTimeOriginal: ${cleanedDate}`);
      }
    }

    // 设置时区偏移为 UTC+0
    // OffsetTimeOriginal (tag 0x9011 = 36881)
    exifIfd[36881] = offsetTime;
    result.addedFields.push(`OffsetTimeOriginal: ${offsetTime}`);
    
    // OffsetTimeDigitized (tag 0x9012 = 36882)
    exifIfd[36882] = offsetTime;
    
    // OffsetTime (tag 0x9010 = 36880)
    exifIfd[36880] = offsetTime;

    // 更新 IFD0 中的日期时间
    const dateTime = ifd0[piexif.ImageIFD.DateTime];
    if (dateTime) {
      const cleanedDate = formatExifDate(dateTime);
      if (cleanedDate) {
        ifd0[piexif.ImageIFD.DateTime] = cleanedDate;
      }
    }

    // ===== 7. 写回 EXIF =====
    exifObj['0th'] = ifd0;
    exifObj['Exif'] = exifIfd;
    
    // 清理 EXIF 对象中可能导致序列化失败的无效值
    // preserveKeys: 必须保留的标签 key 列表
    function cleanExifIfd(ifd, preserveKeys = []) {
      if (!ifd || typeof ifd !== 'object') return {};
      const cleaned = {};
      for (const [key, value] of Object.entries(ifd)) {
        // 必须保留的 key 直接复制（即使值可能有问题）
        if (preserveKeys.includes(key) || preserveKeys.includes(Number(key))) {
          if (value !== undefined && value !== null) {
            cleaned[key] = value;
          }
          continue;
        }
        // 跳过无效值
        if (value === undefined || value === null) continue;
        if (typeof value === 'number' && (Number.isNaN(value) || !Number.isFinite(value))) continue;
        // 跳过空数组
        if (Array.isArray(value) && value.length === 0) continue;
        // 跳过包含无效元素的数组
        if (Array.isArray(value)) {
          const hasInvalid = value.some(v => v === undefined || v === null || 
            (typeof v === 'number' && (Number.isNaN(v) || !Number.isFinite(v))));
          if (hasInvalid) continue;
        }
        cleaned[key] = value;
      }
      return cleaned;
    }
    
    // 必须保留的 IFD0 标签（对显示有影响）
    const ifd0PreserveKeys = [
      piexif.ImageIFD.Orientation,  // 照片方向 - 必须保留！
      piexif.ImageIFD.XResolution,
      piexif.ImageIFD.YResolution,
      piexif.ImageIFD.ResolutionUnit,
      piexif.ImageIFD.YCbCrPositioning,
    ];
    
    console.log('[exif-cleaner] ifd0PreserveKeys:', ifd0PreserveKeys);
    console.log('[exif-cleaner] Before clean - exifObj["0th"] keys:', Object.keys(exifObj['0th'] || {}));
    
    // 必须保留的 ExifIFD 标签
    const exifPreserveKeys = [
      piexif.ExifIFD.ColorSpace,
      piexif.ExifIFD.PixelXDimension,
      piexif.ExifIFD.PixelYDimension,
    ];
    
    // 清理所有 IFD（保留关键标签）
    exifObj['0th'] = cleanExifIfd(exifObj['0th'], ifd0PreserveKeys);
    exifObj['Exif'] = cleanExifIfd(exifObj['Exif'], exifPreserveKeys);
    exifObj['GPS'] = cleanExifIfd(exifObj['GPS']);
    exifObj['1st'] = cleanExifIfd(exifObj['1st']);
    exifObj['Interop'] = cleanExifIfd(exifObj['Interop']);
    
    console.log('[exif-cleaner] After clean - exifObj["0th"] keys:', Object.keys(exifObj['0th'] || {}));
    console.log('[exif-cleaner] After clean - exifObj["0th"]:', JSON.stringify(exifObj['0th'], null, 2));
    
    // ★★★ 使用最开始保存的 originalOrientation（双重保险）★★★
    if (originalOrientation !== undefined && originalOrientation !== null) {
      exifObj['0th'][piexif.ImageIFD.Orientation] = originalOrientation;
      console.log('[exif-cleaner] ★ Restored Orientation to exifObj["0th"]:', originalOrientation);
    } else {
      console.warn('[exif-cleaner] ⚠ originalOrientation is undefined/null, cannot restore!');
    }
    
    console.log('[exif-cleaner] Final exifObj["0th"] before dump:', JSON.stringify(exifObj['0th'], null, 2));
    
    let newDataURL;
    let dumpError = null;
    
    // 尝试写回修改后的 EXIF
    try {
      const exifBytes = piexif.dump(exifObj);
      newDataURL = piexif.insert(exifBytes, dataURL);
    } catch (dumpErr) {
      dumpError = dumpErr;
      console.warn('[exif-cleaner] Failed to dump modified EXIF, trying minimal EXIF:', dumpErr.message);
      
      // 如果失败，尝试使用最小化的 EXIF（只保留必要信息）
      try {
        // 保存必要的值（对照片显示有影响的标签）
        const orientation = ifd0[piexif.ImageIFD.Orientation];
        const dateTime = ifd0[piexif.ImageIFD.DateTime];
        const dateTimeOriginal = exifIfd[piexif.ExifIFD.DateTimeOriginal];
        
        // 保存显示相关的其他标签
        const xResolution = ifd0[piexif.ImageIFD.XResolution];
        const yResolution = ifd0[piexif.ImageIFD.YResolution];
        const resolutionUnit = ifd0[piexif.ImageIFD.ResolutionUnit];
        const yCbCrPositioning = ifd0[piexif.ImageIFD.YCbCrPositioning];
        const colorSpace = exifIfd[piexif.ExifIFD.ColorSpace];
        const exifWidth = exifIfd[piexif.ExifIFD.PixelXDimension];
        const exifHeight = exifIfd[piexif.ExifIFD.PixelYDimension];
        
        // 创建最小化的 EXIF 对象
        const minimalExif = {
          '0th': {},
          'Exif': {},
          'GPS': {},
          '1st': {},
          'Interop': {},
        };
        
        // ===== IFD0 标签（显示相关）=====
        // 照片方向（必须保留）
        if (orientation !== undefined) {
          minimalExif['0th'][piexif.ImageIFD.Orientation] = orientation;
        }
        // 分辨率信息（影响打印和某些查看器）
        if (xResolution !== undefined) {
          minimalExif['0th'][piexif.ImageIFD.XResolution] = xResolution;
        }
        if (yResolution !== undefined) {
          minimalExif['0th'][piexif.ImageIFD.YResolution] = yResolution;
        }
        if (resolutionUnit !== undefined) {
          minimalExif['0th'][piexif.ImageIFD.ResolutionUnit] = resolutionUnit;
        }
        // 色度采样位置（影响颜色解析）
        if (yCbCrPositioning !== undefined) {
          minimalExif['0th'][piexif.ImageIFD.YCbCrPositioning] = yCbCrPositioning;
        }
        // 版权信息
        minimalExif['0th'][piexif.ImageIFD.Copyright] = copyright;
        minimalExif['0th'][piexif.ImageIFD.Artist] = artist;
        // 日期时间
        if (dateTime) {
          minimalExif['0th'][piexif.ImageIFD.DateTime] = dateTime;
        }
        
        // ===== ExifIFD 标签（显示相关）=====
        // 色彩空间（影响颜色准确性）
        if (colorSpace !== undefined) {
          minimalExif['Exif'][piexif.ExifIFD.ColorSpace] = colorSpace;
        }
        // 图像尺寸（某些查看器参考）
        if (exifWidth !== undefined) {
          minimalExif['Exif'][piexif.ExifIFD.PixelXDimension] = exifWidth;
        }
        if (exifHeight !== undefined) {
          minimalExif['Exif'][piexif.ExifIFD.PixelYDimension] = exifHeight;
        }
        // 原始拍摄时间
        if (dateTimeOriginal) {
          minimalExif['Exif'][piexif.ExifIFD.DateTimeOriginal] = dateTimeOriginal;
        }
        // 时区信息
        minimalExif['Exif'][36881] = offsetTime; // OffsetTimeOriginal
        minimalExif['Exif'][36882] = offsetTime; // OffsetTimeDigitized
        minimalExif['Exif'][36880] = offsetTime; // OffsetTime
        
        const minimalBytes = piexif.dump(minimalExif);
        newDataURL = piexif.insert(minimalBytes, dataURL);
        
        result.removedFields.push('Some EXIF tags could not be preserved (display-related tags kept)');
      } catch (minimalErr) {
        console.warn('[exif-cleaner] Failed to create minimal EXIF, stripping all EXIF:', minimalErr.message);
        
        // 如果最小化 EXIF 也失败，尝试完全移除 EXIF 然后添加最简单的新 EXIF
        try {
          // 完全移除 EXIF
          const strippedDataURL = piexif.remove(dataURL);
          
          // 创建最简单的 EXIF（只有字符串值和 Orientation 数字，最安全）
          const safeExif = {
            '0th': {},
            'Exif': {},
            'GPS': {},
            '1st': {},
            'Interop': {},
          };
          
          // 只添加最安全的值
          safeExif['0th'][piexif.ImageIFD.Copyright] = copyright;
          safeExif['0th'][piexif.ImageIFD.Artist] = artist;
          
          // ★★★ 恢复 Orientation（这是关键！）★★★
          if (originalOrientation !== undefined && originalOrientation !== null) {
            safeExif['0th'][piexif.ImageIFD.Orientation] = originalOrientation;
            console.log('[exif-cleaner] ★ Level 3 fallback: Restoring Orientation:', originalOrientation);
          }
          
          const safeBytes = piexif.dump(safeExif);
          newDataURL = piexif.insert(safeBytes, strippedDataURL);
          
          result.removedFields.push('All EXIF stripped and rebuilt with minimal safe values (Orientation preserved)');
        } catch (stripErr) {
          console.warn('[exif-cleaner] Failed to create safe EXIF, trying bare strip:', stripErr.message);
          
          // 第四层终极降级：仅移除 EXIF，不添加任何新内容
          try {
            newDataURL = piexif.remove(dataURL);
            result.removedFields.push('All EXIF completely stripped (no new EXIF added)');
          } catch (bareStripErr) {
            // 如果连移除都失败，返回原文件（实际上隐私信息可能已经无法被正常读取了）
            console.error('[exif-cleaner] Failed to strip EXIF entirely:', bareStripErr.message);
            result.success = true;
            result.file = file;
            result.blob = file;
            result.cleanedSize = file.size;
            result.error = `EXIF 处理异常，返回原文件: ${dumpError.message}`;
            return result;
          }
        }
      }
    }
    
    // 转换回 Blob
    const cleanedBlob = dataURLToBlob(newDataURL);
    
    // 创建新的 File 对象
    const cleanedFile = new File(
      [cleanedBlob],
      file.name,
      { type: file.type, lastModified: Date.now() }
    );

    result.success = true;
    result.file = cleanedFile;
    result.blob = cleanedBlob;
    result.cleanedSize = cleanedBlob.size;

    return result;

  } catch (error) {
    result.error = error.message || String(error);
    result.file = file;
    result.blob = file;
    result.cleanedSize = file.size;
    return result;
  }
}

/**
 * 清理 Blob 中的 EXIF 隐私信息
 * 
 * @param {Blob} blob - 原始图片 Blob
 * @param {Object} options - 清理选项
 * @returns {Promise<Object>} 清理结果
 */
export async function cleanupExifFromBlob(blob, options = {}) {
  // 将 Blob 转换为 File
  const file = new File([blob], 'image.jpg', { 
    type: blob.type || 'image/jpeg',
    lastModified: Date.now() 
  });
  
  return cleanupExifFromFile(file, options);
}

/**
 * 批量清理多个文件
 * 
 * @param {File[]} files - 文件数组
 * @param {Object} options - 清理选项
 * @param {Function} onProgress - 进度回调 (current, total, file) => void
 * @returns {Promise<Object>} 批量处理结果
 */
export async function cleanupExifBatch(files, options = {}, onProgress) {
  const results = [];
  let success = 0;
  let failed = 0;
  let totalOriginalSize = 0;
  let totalCleanedSize = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress(i + 1, files.length, file);
    }

    const result = await cleanupExifFromFile(file, options);
    results.push(result);

    totalOriginalSize += result.originalSize;
    totalCleanedSize += result.cleanedSize;

    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return {
    results,
    success,
    failed,
    totalOriginalSize,
    totalCleanedSize,
  };
}

// ============================================
// Vue 组合式 API Hook
// ============================================

/**
 * Vue 组合式 API Hook
 * 
 * @example
 * import { useExifCleaner } from 'https://jixiaoyong.github.io/images/exif-cleaner.js';
 * 
 * const { cleanFile, isProcessing, error } = useExifCleaner();
 * 
 * async function handleUpload(file) {
 *   const result = await cleanFile(file);
 *   if (result.success && result.file) {
 *     // 使用清理后的 result.file 上传
 *   }
 * }
 */
export function useExifCleaner(defaultOptions = {}) {
  let isProcessing = false;
  let error = null;

  async function cleanFile(file, options) {
    isProcessing = true;
    error = null;

    try {
      const result = await cleanupExifFromFile(file, { ...defaultOptions, ...options });
      if (!result.success) {
        error = result.error || '处理失败';
      }
      return result;
    } finally {
      isProcessing = false;
    }
  }

  async function cleanBlob(blob, options) {
    isProcessing = true;
    error = null;

    try {
      const result = await cleanupExifFromBlob(blob, { ...defaultOptions, ...options });
      if (!result.success) {
        error = result.error || '处理失败';
      }
      return result;
    } finally {
      isProcessing = false;
    }
  }

  async function cleanFiles(files, options, onProgress) {
    isProcessing = true;
    error = null;

    try {
      return await cleanupExifBatch(files, { ...defaultOptions, ...options }, onProgress);
    } finally {
      isProcessing = false;
    }
  }

  return {
    cleanFile,
    cleanBlob,
    cleanFiles,
    isProcessing,
    error,
  };
}

// ============================================
// 导出默认对象（兼容性）
// ============================================

export default {
  cleanupExifFromFile,
  cleanupExifFromBlob,
  cleanupExifBatch,
  useExifCleaner,
  isJpegFormat,
  isHeicFormat,
  isSupportedFormat,
  formatFileSize,
  DEFAULT_COPYRIGHT_INFO,
  DEFAULT_OFFSET_TIME,
  PRIVACY_TAGS,
  USEFUL_TAGS,
};
