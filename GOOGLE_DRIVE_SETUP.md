# Google Drive 自动同步配置指南

## 原理

应用通过 **Google Service Account（服务账号）** 在服务端读写 Google Drive 中的一个 JSON 文件（`pftrack_data.json`）。
所有设备访问同一个 Vercel 部署，数据自动从 Drive 拉取/推送，无需手动导入导出。

---

## 步骤一：创建 Google Cloud 项目和服务账号

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建一个新项目（或使用已有项目）
3. 左侧菜单 → **APIs & Services** → **Library**
4. 搜索 `Google Drive API` → 点击启用（Enable）

5. 左侧菜单 → **APIs & Services** → **Credentials**
6. 点击 `+ CREATE CREDENTIALS` → 选择 `Service account`
7. 填写名称（如 `pftrack-sync`），点击完成
8. 点击刚创建的服务账号 → **Keys** 标签 → `Add Key` → `Create new key` → JSON
9. 下载 JSON 密钥文件（保存好，只能下载一次）

---

## 步骤二：共享 Drive 文件夹给服务账号

1. 打开 [Google Drive](https://drive.google.com/)
2. 新建一个文件夹（如 `PFTRACK`）
3. 右键该文件夹 → **共享**
4. 将服务账号的邮箱地址（格式：`xxx@your-project.iam.gserviceaccount.com`）
   粘贴进去，权限选 **编辑者（Editor）**
5. 点击发送
6. 打开这个文件夹，从浏览器地址栏复制文件夹 ID：
   `https://drive.google.com/drive/folders/` **这里就是ID**

---

## 步骤三：在 Vercel 配置环境变量

前往你的 Vercel 项目 → Settings → Environment Variables，添加以下三个：

| 变量名 | 值来源 |
|--------|--------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON密钥文件中的 `client_email` |
| `GOOGLE_PRIVATE_KEY` | JSON密钥文件中的 `private_key`（完整粘贴，包括 `-----BEGIN...-----END-----`） |
| `GOOGLE_DRIVE_FOLDER_ID` | 步骤二中复制的文件夹ID |

> ⚠️ `GOOGLE_PRIVATE_KEY` 中的换行符在 Vercel 里会自动处理，直接粘贴完整值即可。

---

## 步骤四：安装依赖并重新部署

```bash
npm install googleapis
```

提交代码推送到 GitHub，Vercel 会自动重新部署。

---

## 效果

- 首次访问：如果 Drive 上没有数据文件，会使用本地数据（之前 localStorage 里的数据）
- 之后：每次数据变化 2 秒后自动同步到 Drive
- 手机端打开：自动从 Drive 拉取最新数据，和 PC 端完全一致
- 同步状态会显示在页面左上角（● 同步中 / ● 已同步 / ● 本地存储）

---

## 未配置 Drive 时的行为（降级）

如果没有配置环境变量，应用会自动降级为 `localStorage` 模式，
功能完全正常，只是无法跨设备同步。页面左上角会显示 **● 本地存储**。
