存放两个博客用到的图片资源

图片等资源官方推荐使用git lfs，详细步骤参考官网https://git-lfs.github.com/或者gitlab的中文版本https://docs.gitlab.cn/jh/topics/git/lfs/


简单来说有以下五步：

1. 安装git lfs客户端

2. 在需要支持git lfs的git仓库下面执行 `git lfs install`初始化

3. 使用`git lfs track "*.png"`添加需要使用git lfs追踪的文件

4. 将上述步骤生成的`.gitattributes`文件也加入git追踪

5. 正常使用git命令添加需要追踪的文件并提交远程仓库即可，后续也只需要执行本步骤即可

