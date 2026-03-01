# 云端同步配置指南（Upstash Redis）

## 原理

应用通过 **Upstash Redis** 在服务端存储数据。
所有设备访问同一个 Vercel 部署时，数据自动从 Upstash 拉取/推送，无需手动导入导出。

---

## 配置步骤

### 第一步：在 Vercel 创建 Upstash Redis

1. 进入你的 Vercel 项目 → 顶部点「**Storage**」标签
2. 点「**Upstash**」旁边的箭头 → 选 **Redis** → Create
3. 取名（如 `pftrack-redis`），选**免费套餐**，选离你近的区域，点创建
4. 创建后点「**Connect to Project**」→ 选你的项目 → 确认

完成后 Vercel 会自动注入以下两个环境变量，无需手动填写：
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 第二步：安装 SDK

在项目终端里运行：

```bash
npm install @upstash/redis
```

### 第三步：部署

提交代码并推送到 GitHub，Vercel 自动重新部署。

---

## 效果

- 首次访问：如果 Redis 里没有数据，会使用浏览器本地数据
- 之后：每次数据变化约 2 秒后自动同步到 Upstash
- 手机端打开：自动从 Upstash 拉取最新数据，和 PC 端完全一致
- 同步状态显示在页面左上角

## 未配置时的行为（降级）

如果没有配置 Upstash，应用会自动降级为 `localStorage` 模式，
所有功能正常，只是无法跨设备同步。页面左上角会显示 **● 本地存储**。

---

## 免费额度

| 指标 | 免费限制 |
|------|---------|
| 存储 | 256 MB |
| 每日请求 | 10,000 次 |
| 并发连接 | 100 |

对个人投资组合完全够用。
