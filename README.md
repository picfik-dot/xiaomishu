# 小秘书 PWA

这是一个可部署到 GitHub Pages 的 PWA 页面项目。

## 访问方式

部署后访问：

- https://picfik-dot.github.io/xiaomishu/

## 说明

- 入口文件：index.html
- PWA 清单：manifest.webmanifest
- Service Worker：service-worker.js

## 在线后端部署

如果你希望前端托管在 GitHub Pages 上，并且让页面能够通过坚果云同步数据，建议另外部署在线后端服务。

后端服务支持以下接口：

- `GET /api/data` 读取当前数据
- `POST /api/data` 保存并尝试同步到坚果云
- `POST /api/sync-now` 手动触发坚果云同步

### 前端设置

在“设置”页中填写：

- 后端 API 地址：例如 `https://your-backend.example.com`
- 坚果云 Base URL：例如 `https://dav.jianguoyun.com/dav/`
- 用户名、应用密码、远程文件路径

### 启动后端服务

```bash
npm install
npm start
```

如果你有可用域名或云服务器，把 `server.js` 部署到那里即可。前端只要填写后端地址，就能在 GitHub Pages 上正常访问并同步数据。
