<!-- 标题格式：<type>(<scope>): <subject>，与 commitlint 一致 -->

## 变更说明

<!-- 做了什么、为什么；关联任务号或 Issue（Closes #xx） -->

-

## 变更类型

- [ ] feat 新功能
- [ ] fix 缺陷修复
- [ ] refactor 重构（无行为变更，纯搬迁）
- [ ] perf 性能优化
- [ ] docs 文档
- [ ] test 测试补齐
- [ ] ci/build 工程化
- [ ] ⚠️ 破坏性变更 / 涉及前后端契约（说明与 server 的同步方案）

## 自查清单

- [ ] `pnpm lint` 通过（无显式 any，no-explicit-any 为 error）
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test:coverage` 全绿（含覆盖率阈值）
- [ ] 涉及元数据契约：`pnpm gen:metadata-types` 已执行且 `src/api/types/` 已同步
- [ ] 页面开发优先 `BaseApi` + `RePlusPage`，无重复 CRUD 模板
- [ ] 用户态读写走 Pinia / utils 封装，无直接 localStorage/cookie 调用
- [ ] 新文件 ≤400 行，巨型文件拆分符合 composables 约定

## 验证方式

<!-- 本地如何验证（操作路径/截图） -->
