import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * O3 Office 在线预览 E2E（ADR-013）：docx → heavy 队列 LibreOffice 转 PDF →
 * 预览抽屉内嵌渲染。首次预览会经历「转换中（1006/425）→ 轮询重试 → 就绪」。
 *
 * 样本用 LibreOffice 自身把 txt 转成 docx（避免把二进制样本入库）；
 * 未安装 LibreOffice 的环境（如默认 CI）跳过本用例。
 */

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** 与后端 office_converter_bin 的探测口径一致：PATH 与 macOS 常见安装路径 */
const SOFFICE_CANDIDATES = [
  "soffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice"
];

function findSoffice(): string | null {
  for (const candidate of SOFFICE_CANDIDATES) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // 继续探测下一个
    }
  }
  return null;
}

const SOFFICE = findSoffice();

/** 生成真实 docx 样本（LibreOffice 把 txt 转为 docx） */
function buildSampleDocx(soffice: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "xadmin-office-e2e-"));
  try {
    const txt = join(dir, "sample.txt");
    writeFileSync(txt, "XADMIN OFFICE PREVIEW\nE2E SAMPLE\n");
    execFileSync(
      soffice,
      ["--headless", "--convert-to", "docx", "--outdir", dir, txt],
      { stdio: "ignore" }
    );
    return readFileSync(join(dir, "sample.docx"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("文件中心：Office 在线预览（docx 转换后 PDF 内嵌渲染）", async ({
  page
}) => {
  test.skip(!SOFFICE, "本机未安装 LibreOffice，跳过 Office 预览链路");
  await login(page);

  const filename = `e2e-office-${Date.now()}.docx`;
  const uploadResp = await page.request.post(
    `${FRONT_URL}/api/system/file/upload`,
    {
      multipart: {
        file: {
          name: filename,
          mimeType: DOCX_MIME,
          buffer: buildSampleDocx(SOFFICE as string)
        }
      }
    }
  );
  expect((await uploadResp.json()).code).toBe(1000);

  await openMenuPath(page, ["系统管理"], "/system/file/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  const row = page.locator(".el-table__row", { hasText: filename }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });

  await row.getByRole("button", { name: "预览" }).click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  // 首次预览触发转换：抽屉先显示「转换中」，产物就绪后轮询拿到 PDF 并内嵌
  await expect(drawer.locator(".preview-frame")).toBeVisible({
    timeout: 60_000
  });
});
