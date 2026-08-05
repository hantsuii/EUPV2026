# Cloudflare Pages 门户站点

这是静态门户，用于统一展示模块入口。

## 本地预览

在本目录下：

```powershell
cd D:\Project\portal-site
python -m http.server 8080
```

浏览器打开：`http://localhost:8080`

## 发布到 Cloudflare Pages

- 连接此仓库
- Build command: 留空（或 `echo ok`）
- Build output directory: `/`

## 配置模块

编辑 `modules.json`：
- 修改 `销售数据分析` 的 `url` 为真实 Streamlit 地址
- 新增模块时按相同结构追加对象
