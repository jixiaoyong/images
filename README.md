存放两个博客用到的图片资源

图片等资源官方推荐使用git lfs，详细步骤参考官网 https://git-lfs.github.com/ 或者gitlab的中文版本 https://docs.gitlab.cn/jh/topics/git/lfs/


简单来说有以下五步：

1. 安装git lfs客户端

2. 在需要支持git lfs的git仓库下面执行 `git lfs install`初始化

3. 使用`git lfs track "*.png"`添加需要使用git lfs追踪的文件

4. 将上述步骤生成的`.gitattributes`文件也加入git追踪

5. 正常使用git命令添加需要追踪的文件并提交远程仓库即可，后续也只需要执行本步骤即可

---

## Scripts

### exif-cleaner.js

浏览器端 EXIF 隐私信息清理工具（ES Module），用于在上传图片前删除隐私元数据并添加版权信息。

**支持格式：** JPEG/JPG、HEIC/HEIF（转换为 JPEG）

**功能：**
- 删除 GPS 定位、设备信息、MakerNotes、缩略图等隐私数据
- 添加版权和作者信息
- 设置时区为 UTC+0

**使用方式：**
```javascript
import { cleanupExifFromFile } from 'https://jixiaoyong.github.io/images/scripts/exif-cleaner.js';

const result = await cleanupExifFromFile(file);
if (result.success) {
  // 使用 result.file 上传
}
```

---

### image-resizer.js

浏览器端图片缩放压缩工具（ES Module），支持按比例缩放并压缩为 WebP/JPEG/PNG。

**支持格式：** JPEG、PNG、WebP（GIF 直接返回原图）

**功能：**
- 按 maxWidth/maxHeight 保持比例缩放
- 原图较小时不放大，直接返回
- 内存缓存，避免重复处理
- 自动检测 WebP 支持，不支持则降级为 JPEG

**使用方式：**
```javascript
import { resizeImage } from 'https://jixiaoyong.github.io/images/scripts/image-resizer.js';

const result = await resizeImage('https://example.com/photo.jpg', {
  maxWidth: 800,
  maxHeight: 600,
  format: 'webp',  // 'webp' | 'jpeg' | 'png'
  quality: 0.8,
});

if (result.success) {
  img.src = result.url;  // Blob URL
}
```
