/**
 * 仪表盘卡片上限：与后端 `DASHBOARD_MAX_CARDS` 同口径。
 *
 * 上限按「一屏可用性与读侧成本」收敛（读侧按浏览者逐卡过滤），前端提前禁用
 * 「添加卡片」，避免用户排到一半才在保存时被 400 打回。
 */
export const DASHBOARD_MAX_CARDS = 24;
