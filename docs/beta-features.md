# Beta Features

Beta features allow gradual rollout of new functionality while maintaining stability. Admin users can enable beta features via the Settings UI to test new capabilities.

## Available Features

### New Repository Wizard (Beta)

A redesigned step-based repository wizard with improved UX, validation, and mobile support.

**Status:** Beta
**Default:** Disabled
**Added:** v1.46.0
```markdown
# 测试版功能（Beta Features）

测试版功能允许在保持稳定性的前提下逐步发布新功能。管理员可在设置界面启用 beta 功能以进行测试。

## 可用功能

### 新仓库向导（Beta）

重新设计的分步仓库向导，改进了用户体验、校验和移动端支持。

**状态：** Beta
**默认：** 禁用
**引入版本：** v1.46.0

功能亮点：
- 分步流程和进度指示
- 卡片式位置选择界面
- 更友好的校验与错误提示
- 响应式移动端设计
- 实时命令预览
- 更完善的 SSH 连接管理

## 启用 Beta 功能

**管理员操作：**

1. 前往 **Settings → Appearance**
2. 在 **Beta Features** 区域找到对应开关
3. 切换“Use New Repository Wizard”以启用或禁用
4. 更改即时生效，无需重建

**注意：** 只有管理员可以访问 beta 功能开关。

## 测试建议

若要协助测试：

1. 在设置中启用功能
2. 在 https://github.com/karanhudia/borg-ui/issues 提交问题
3. 在生产环境使用前充分测试
4. 随时可通过设置回退到稳定版本

## 功能生命周期

Beta 功能遵循以下进程：

1. **Beta**（当前）- 默认禁用，管理员可选择启用测试
2. **正式可用（GA）** - 默认对所有用户启用
3. **弃用（Deprecated）** - 计划移除的旧功能
4. **移除（Removed）** - 仅保留新版本

当前时间线：
- 新仓库向导：Beta → 在 v1.47.0 转为 GA → 在 v1.48.0 移除旧版

## 说明

- Beta 功能为运行时设置（无需重建）
- 配置保存在数据库中，重启后保持生效
- 切换版本不会导致数据丢失
- 稳定版与测试版共用数据库
- 可在设置中随时切换回稳定版

```
