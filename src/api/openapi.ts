import type { components, operations, paths } from "@/api/types/openapi";

/**
 * 全量 OpenAPI 契约的消费入口（`pnpm gen:openapi-types` 生成）。
 *
 * 新增接口优先从 `OpenApiSchemas` 取请求/响应类型，避免再手写一份形状；
 * 既有手写 API 模块保持现状，本入口不强制回迁。元数据协议的五份手写契约
 * （`search-columns` / `search-fields` 等）仍是页面渲染的权威类型。
 */
export type OpenApiSchemas = components["schemas"];
export type OpenApiOperations = operations;
export type OpenApiPaths = paths;
