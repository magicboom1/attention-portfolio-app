# Attention Portfolio (App)

> 我这周到底把自己安排成什么样了？

轻量级的项目精力负荷诊断工具（Attention / Project Load Diagnosis）：输入每个任务的剩余工时、本周计划、DDL 与延期后果，系统自动聚合出 Project 状态（DORMANT / ACTIVE / HEAVY / BURNING）与 Portfolio 状态（CLEAR / FOCUSED / LOADED / BURNING OUT），并给出 Primary Pressure 归因。

**在线使用**：<https://magicboom1.github.io/attention-portfolio-app/>

## 特性

- 单文件静态网页（`index.html`），无账号、无服务器、无依赖
- 数据只存在你所用设备的浏览器 localStorage，不上传任何内容
- Mobile-first，手机为第一验收环境
- 支持导出 / 导入 JSON 做本地备份与迁移
- 计算规则透明可解释：`node tests.mjs` 运行 73 项回归测试（Case A–V）

设计文档与计算基线在主仓库（私有）中维护，此仓库仅承载应用部署。
