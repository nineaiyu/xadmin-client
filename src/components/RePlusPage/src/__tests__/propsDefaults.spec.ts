import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RePlusPage 三元语义 prop 的运行时默认值守护。
 *
 * 背景：Vue 对 `type: Boolean` 的 prop 有隐式缺省——未传且未声明 default 时
 * 归一为 false。因此「缺省 = 开启，显式传 false 才关闭」的开关型 prop 必须在
 * withDefaults 里显式给出默认值，否则缺省即被关闭（fetchSearchFields 曾因此让
 * 分离式 search-fields 元数据请求永不发出，内嵌列表的搜索区字段全空）。
 *
 * 形态说明：本 spec 走源码层断言而非挂载组件——RePlusPage 的模块依赖图会经
 * store/router 引到 @/api/auth，jsdom 下存在既有模块环（BaseApi 未初始化），
 * 挂载即失败；而本守护只关心「默认值是否被声明」这一编译期契约，读源码即足够。
 */
// vitest 的 runner 运行在 jsdom 环境，import.meta.url 不是 file 协议，按仓库根解析
const sourcePath = resolve(
  process.cwd(),
  "src/components/RePlusPage/src/index.vue"
);

/** 截取 withDefaults 第二个入参（默认值字面量）的块内容，并剔除行注释 */
function readDefaultsBlock(): string {
  const raw = readFileSync(sourcePath, "utf8");
  const anchor = raw.indexOf("withDefaults(");
  if (anchor < 0) {
    throw new Error("未在组件源码中找到 withDefaults 声明");
  }

  const begin = raw.indexOf("{", anchor);
  let depth = 0;
  let end = begin;
  for (let i = begin; i < raw.length; i++) {
    if (raw[i] === "{") depth += 1;
    if (raw[i] === "}" && (depth -= 1) === 0) {
      end = i;
      break;
    }
  }
  return raw.slice(begin + 1, end).replace(/\/\/.*$/gm, "");
}

describe("RePlusPage prop 默认值", () => {
  it("fetchSearchFields 默认 true（缺省不声明会被 Vue 归一为 false）", () => {
    expect(readDefaultsBlock()).toMatch(/fetchSearchFields:\s*true/);
  });

  it("allowAsyncExport 仍保持 undefined 默认（异步导出开关按页面权限兜底）", () => {
    expect(readDefaultsBlock()).toMatch(/allowAsyncExport:\s*undefined/);
  });
});
