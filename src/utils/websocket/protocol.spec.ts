import { describe, expect, it } from "vitest";

import wsFrameSchema from "../../../contract/schema/ws-frame.schema.json";
import { MessageAction } from "./protocol";

/**
 * 双端动作枚举对账（服务端 `tests/unit/common/test_contract_schemas.py` 同口径）。
 *
 * 新增 WebSocket 动作时的漂移面：只改前端常量（后端不认）、或只改后端 MessageAction
 * 与 docs/schema（前端生成类型与本地常量都落后）。这里以仓库内镜像 schema 为准做集合
 * 相等断言——镜像本身由 `pnpm check:contract` 与服务端 docs/schema 对齐。
 */
describe("WebSocket 动作枚举对账", () => {
  const schemaActions = new Set<string>(
    (wsFrameSchema as { definitions: { action: { enum: string[] } } })
      .definitions.action.enum
  );
  const localActions = new Set<string>(Object.values(MessageAction));

  it("本地常量与契约 schema 集合完全一致", () => {
    expect([...localActions].sort()).toEqual([...schemaActions].sort());
  });

  it("动作值为非空小写标识（帧壳按字符串比较，禁止驼峰/大写）", () => {
    for (const action of localActions) {
      expect(action).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
