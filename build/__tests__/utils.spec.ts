import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { getPackageSize } from "../utils";

/**
 * 体积统计（构建装饰性输出）的容错守护。
 *
 * 回归背景：`closeBundle` 里 `readdir(outDir)` 失败曾直接 `throw err`，经异步回调
 * 变成未捕获异常，把 `pnpm build` 打成 exit 1——vite 8（rolldown）下 closeBundle
 * 可能早于产物落盘，CI Linux 确定性复现（发布构建此前从未真正执行到该步骤）。
 * 统计不是门禁（真实门禁是 `check:bundle-size`），目录/条目读取失败必须静默返回。
 */
describe("getPackageSize", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs
      .splice(0)
      .forEach(dir => rmSync(dir, { recursive: true, force: true }));
  });

  it("目录不存在时不抛错且不回调（closeBundle 早于产物落盘）", async () => {
    const missing = join(tmpdir(), `xadmin-missing-${Date.now()}`);
    let called = false;

    const settled = new Promise<void>(resolve => {
      getPackageSize({
        folder: missing,
        callback: () => {
          called = true;
          resolve();
        }
      });
      // 留出异步回调窗口：旧实现会在此窗口内抛出未捕获异常使测试失败
      setTimeout(resolve, 80);
    });

    await expect(settled).resolves.toBeUndefined();
    expect(called).toBe(false);
  });

  it("目录存在时回调文件总大小", async () => {
    const dir = join(tmpdir(), `xadmin-size-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    writeFileSync(join(dir, "a.txt"), "12345");
    writeFileSync(join(dir, "b.txt"), "123");

    const size = await new Promise<number | string>(resolve => {
      getPackageSize({ folder: dir, callback: resolve, format: false });
    });

    expect(size).toBe(8);
  });
});
