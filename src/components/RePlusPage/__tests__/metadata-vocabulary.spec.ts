import { describe, expect, it, vi } from "vitest";

// 与 registry.spec.ts 同款隔离：渲染器映射文件的异步叶子组件在 vitest SSR
// 链路会触发 router 循环导入崩溃；本测试只关心映射键，不需要真实组件
vi.mock("../src/components/UploadFiles.vue", () => ({ default: {} }));
vi.mock("../src/components/UploadFile.vue", () => ({ default: {} }));
vi.mock("../src/components/PhoneInput.vue", () => ({ default: {} }));
vi.mock("../src/components/JsonInput.vue", () => ({ default: {} }));
vi.mock("../src/components/SuggestSelect.vue", () => ({ default: {} }));

import { builtinDetailRenderers } from "../src/utils/renderers-detail";
import { builtinFormRenderers } from "../src/utils/renderers-form";
import { builtinSearchRenderers } from "../src/utils/renderers-search";
// 服务端 docs/schema 的镜像副本（pnpm sync:contract 同步，check:contract 校验）；
// 词表单一事实源在服务端 common/core/modelset/input_types.py（锁步由服务端测试守护）
import searchColumnsSchema from "../../../../contract/schema/search-columns.schema.json";
import searchFieldsSchema from "../../../../contract/schema/search-fields.schema.json";

/**
 * input_type 词表 ⇄ 渲染器注册表 双向覆盖对账（稳定公共契约）。
 *
 * 服务端词表经 docs/schema 的 input_type 枚举（封闭核心）+ anyOf pattern（开放
 * api-* 前缀族）+ x-fallback-rendered（回退呈现登记）下发到本仓镜像；本测试
 * 保证两侧互不漂移：
 * - 词表内非回退类型至少有一张内置渲染器映射（后端承诺必有渲染归宿）；
 * - 回退登记类型不得出现在任何内置映射（回退语义即"无内置渲染器"）；
 * - 内置映射键不得超出词表（前端不得发明后端未登记的 input_type）。
 * 任一方向漂移的处置：走扩展流程（登记词表 → 同步 Schema → 补注册表）。
 */

type InputTypeSchema = {
  anyOf?: Array<{ enum?: string[]; pattern?: string; type?: string }>;
  "x-fallback-rendered"?: string[];
};

const extractContract = (schema: {
  items: { properties: { input_type: InputTypeSchema } };
}) => {
  const property = schema.items.properties.input_type;
  const [enumBranch, patternBranch] = property.anyOf ?? [];
  return {
    vocabulary: new Set(enumBranch?.enum ?? []),
    fallback: new Set(property["x-fallback-rendered"] ?? []),
    pattern: patternBranch?.pattern
  };
};

const builtinKeys = new Set([
  ...Object.keys(builtinSearchRenderers),
  ...Object.keys(builtinFormRenderers),
  ...Object.keys(builtinDetailRenderers)
]);

describe("input_type 词表 ⇄ 渲染器注册表 对账", () => {
  const columnsContract = extractContract(searchColumnsSchema);
  const fieldsContract = extractContract(searchFieldsSchema);

  it("两份镜像 Schema 的词表与回退登记一致（服务端锁步对账的本地兜底）", () => {
    expect(fieldsContract.vocabulary).toEqual(columnsContract.vocabulary);
    expect(fieldsContract.fallback).toEqual(columnsContract.fallback);
    expect(columnsContract.pattern).toBe("^api-");
    expect(fieldsContract.pattern).toBe("^api-");
  });

  it("词表非回退类型均有内置渲染器；回退类型无内置渲染器", () => {
    const uncovered = [...columnsContract.vocabulary].filter(
      type =>
        !columnsContract.fallback.has(type) &&
        !builtinKeys.has(type) &&
        !type.startsWith("api-")
    );
    expect(
      uncovered,
      `词表类型缺少内置渲染器：${uncovered.join("、")}——补 renderers-*.tsx 映射或改登 x-fallback-rendered（扩展流程）`
    ).toEqual([]);
    const misRegistered = [...columnsContract.fallback].filter(type =>
      builtinKeys.has(type)
    );
    expect(
      misRegistered,
      `回退登记类型存在内置渲染器（回退语义失效）：${misRegistered.join("、")}`
    ).toEqual([]);
  });

  it("内置渲染器键均已在词表登记", () => {
    const undeclared = [...builtinKeys].filter(
      type => !columnsContract.vocabulary.has(type) && !type.startsWith("api-")
    );
    expect(
      undeclared,
      `前端注册表存在后端未登记的 input_type：${undeclared.join("、")}——在服务端 DECLARED_INPUT_TYPES 登记（扩展流程）`
    ).toEqual([]);
  });
});
