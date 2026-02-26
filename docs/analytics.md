# Analytics & Privacy

Borg UI collects **anonymous usage statistics** to help improve the product. We believe in **radical transparency**.

## Full Transparency

**[View our analytics dashboard publicly](https://analytics.nullcodeai.dev/)** - See exactly what we collect in real-time. No login required.

## What We Track

### We DO Collect

**Page Views:**
- Which pages you visit (Dashboard, Repositories, Archives, etc.)
- Navigation patterns and page transitions
- Session duration and visit frequency

**Feature Usage:**
- Button clicks (Backup Now, Create Repository, etc.)
- Feature interactions (mounting archives, scheduling backups)
- Settings changes (non-sensitive preferences)
- Search queries within the app

**Technical Information:**
- Browser type and version
- Operating system
```markdown
# 分析与隐私

Borg UI 收集**匿名使用统计数据**以帮助改进产品，我们遵循**高度透明**的原则。

## 完全透明

**[公开查看我们的分析仪表盘](https://analytics.nullcodeai.dev/)** — 实时查看我们收集的内容，无需登录。

## 我们收集什么

### 我们会收集

**页面访问：**
- 你访问了哪些页面（仪表盘、仓库、归档等）
- 导航模式与页面切换
- 会话时长与访问频率

**功能使用：**
- 按钮点击（立即备份、创建仓库等）
- 功能交互（挂载归档、调度备份）
- 设置更改（非敏感偏好项）
- 应用内搜索查询

**技术信息：**
- 浏览器类型与版本
- 操作系统
- 屏幕分辨率与设备类型
- 语言偏好
- 错误率与崩溃报告

**我们跟踪的事件：**
- 仓库操作（创建、编辑、删除、查看信息）
- 备份操作（开始、完成、失败）
- 归档浏览（挂载、卸载、文件提取）
- 调度操作（创建、编辑、删除、启用/禁用）
- SSH 连接管理（创建、测试、删除）
- 维护任务（compact、check、prune）
- 认证事件（登录、登出）

### 我们不会收集

- **密码** 或认证令牌
- **加密密钥** 或口令
- **备份数据** 或文件内容
- **文件路径** 或仓库名称
- **SSH 密钥** 或连接凭证
- **IP 地址** — 我们不收集或存储 IP 地址，所有跟踪在不记录 IP 的情况下进行。
- **主机名** — 不收集计算机名或主机名
- **用户标识** — 不跨会话追踪个人用户
- **仓库 URL** 或存储位置
- **个人信息**（除自愿提交外）
- **归档内容** 或文件名
- **Cookies** — 我们不使用 cookie 进行跟踪

## 我们为何收集这些数据

收集分析数据用于：
- **了解功能使用情况** — 哪些功能更有价值
- **更快修复错误** — 找出用户遇到问题的地方
- **确定开发优先级** — 专注用户最需要的功能
- **改善用户体验** — 发现用户工作流的痛点
- **保证平台兼容性** — 覆盖不同浏览器/设备
- **衡量产品成功度** — 跟踪采用率与留存

## 如何选择退出

分析功能**默认开启**，你可以随时关闭：

1. 打开 Borg UI
2. 前往 **Settings → Preferences**
3. 关闭 **“Enable anonymous usage analytics”**
4. 页面会重新加载且停止发送分析数据

你的偏好会保存在数据库中，并在所有会话中生效。

## 技术实现

**分析平台：** [Matomo](https://matomo.org/)（开源、自托管）
- **实例地址：** `https://analytics.nullcodeai.dev`
- **不使用第三方服务**（不使用 Google Analytics、Mixpanel 等）
- **数据由我们控制**
- **开源可审计** — 你可以查看源码

**隐私保护措施：**
- **不记录 IP**
- **不使用 Cookies**（无 Cookie 跟踪）
- **不使用用户 ID**
- **无持久标识符** — 每次会话匿名
- **尊重 Do Not Track**（浏览器 DNT 设置会被尊重）

**跟踪方式：**
- 从我们服务器加载 JavaScript 跟踪代码
- 事件以 HTTP POST 发送到 Matomo 实例
- 数据为完全匿名，无法关联到个人
- 每次发送前都会校验用户偏好

**数据流程：**
1. 用户触发操作（例如点击“立即备份”）
2. 前端检查是否启用分析（从数据库读取）
3. 若启用，则发送匿名事件到 Matomo（不含 IP、用户 ID、Cookies）
4. 若禁用，则在客户端丢弃事件（不发送）

## 数据保留

- **聚合数据：** 为趋势分析长期保留（页面访问计数、功能使用统计等）
- **无个人级数据：** 我们不收集可识别个人的数据，因此不存在需删除的个人级数据
- **用户偏好：** 仅保存在本地 Borg UI 数据库，不会发送到分析服务器

## 隐私权利

你有以下权利：
- **随时选择退出**（Settings → Preferences）
- **查看收集的数据**（公开仪表盘，均为聚合匿名数据）
- **就我们的做法提问**
- **对我们收集内容提供反馈** — 若你不同意某项收集，请在仓库中 [打开 issue](https://github.com/karanhudia/borg-ui/issues)

**重要说明：** 由于我们不收集任何可识别个人的信息（无 IP、无用户 ID、无 Cookies），因此不存在需要删除的个体级数据。所有数据均为匿名聚合统计。

## 中央化分析模型

**说明：** Borg UI 使用**中央化分析模型**：
- 所有 Borg UI 实例向统一的 Matomo 实例发送匿名数据
- 这样有助于我们了解全球范围的使用模式
- 单个安装不可被识别
- 实例之间不进行追踪

我们选择中央化模型以便更好地理解产品的全球使用情况，同时通过匿名化保护隐私。

## 开源与透明

- 跟踪代码开源（查看 `frontend/src/utils/matomo.ts`）
- 提供公开仪表盘（无隐藏、无秘密）
- 隐私政策在仓库中（`PRIVACY.md`）
- 产品内置了选择退出机制

## 联系方式

有关分析或隐私的问题：
- **打开 issue：** [GitHub Issues](https://github.com/karanhudia/borg-ui/issues)
- **讨论区：** [GitHub Discussions](https://github.com/karanhudia/borg-ui/discussions)
- **查看实时数据：** [Analytics Dashboard](https://analytics.nullcodeai.dev/)

---

**最后更新：** 2026 年 1 月 18 日

**我们的承诺：** 我们只收集有助于提升产品的数据。不进行隐藏跟踪、不出售数据、也不使用暗箱手法。始终保持透明、以用户为中心。

```
