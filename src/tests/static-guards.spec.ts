import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 范式类静态守护（只减不增）：
 * - 外链 target="_blank" 必须带 rel="noopener noreferrer"；
 * - 破坏性确认走 useConfirm 的 danger 档，不再手写危险色类名；
 * - 本地失败壳统一走 apiFailure，不再手写 code:-1。
 */

const SRC = path.resolve(process.cwd(), "src");
const CODE_EXT = new Set([".vue", ".ts", ".tsx"]);
const SKIP_DIRS = new Set(["node_modules", "__tests__", "dist"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(full));
      continue;
    }
    if (!CODE_EXT.has(path.extname(entry.name))) continue;
    if (entry.name.includes(".spec.")) continue;
    out.push(full);
  }
  return out;
}

const files = walk(SRC);

describe("静态范式守护", () => {
  it("外链 target=_blank 必须带 noopener noreferrer", () => {
    const violations: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!/target\s*[:=]\s*["']_blank["']/.test(line)) return;
        const window = lines.slice(index, index + 4).join("\n");
        if (/rel\s*[:=]\s*["'][^"']*noopener[^"']*noreferrer/i.test(window))
          return;
        violations.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
      });
    }
    expect(violations).toEqual([]);
  });

  it("破坏性确认不得再手写危险色类名（改用 danger: true）", () => {
    // 两个确认封装自身实现 danger 档，允许出现类名；业务调用点一律用 danger
    const wrappers = new Set([
      path.join(SRC, "hooks", "useConfirm.ts"),
      path.join(SRC, "hooks", "useMessageBox.ts")
    ]);
    const violations = files
      .filter(file => !wrappers.has(file))
      .filter(file =>
        fs
          .readFileSync(file, "utf8")
          .includes('confirmButtonClass: "el-button--danger"')
      );
    expect(violations.map(file => path.relative(process.cwd(), file))).toEqual(
      []
    );
  });

  it("不得用 Math.random() 作为组件 key 强制重建", () => {
    const violations = files
      .filter(file =>
        /:key\s*=\s*["'][^"']*Math\.random|key:\s*Math\.random/.test(
          fs.readFileSync(file, "utf8")
        )
      )
      .map(file => path.relative(process.cwd(), file));
    expect(violations).toEqual([]);
  });

  it("本地失败壳统一走 apiFailure（apiError.ts 之外不得手写 code:-1）", () => {
    const violations = files
      .filter(file => !file.endsWith(path.join("utils", "apiError.ts")))
      .filter(file => /code\s*:\s*-1/.test(fs.readFileSync(file, "utf8")));
    expect(violations.map(file => path.relative(process.cwd(), file))).toEqual(
      []
    );
  });
});

describe("无障碍静态守护", () => {
  it("viewport 不得禁用缩放（WCAG 1.4.4：禁 maximum-scale / minimum-scale / user-scalable）", () => {
    const html = fs.readFileSync(
      path.resolve(process.cwd(), "index.html"),
      "utf8"
    );
    const viewport = html.match(/<meta[^>]*name="viewport"[^>]*>/)?.[0] ?? "";
    expect(viewport, "index.html 必须声明 viewport meta").toBeTruthy();
    expect(viewport).not.toMatch(/maximum-scale/i);
    expect(viewport).not.toMatch(/minimum-scale/i);
    expect(viewport).not.toMatch(/user-scalable/i);
  });

  it("登录页窄视口兜底与 dvh 双写不得回退", () => {
    const raw = fs.readFileSync(path.join(SRC, "style", "login.scss"), "utf8");
    // 只对声明本体断言：剥掉注释，避免修复说明里的「原 overflow: hidden」字样误报
    const scss = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    // ≤1180px 断点内的窄视口兜底（≤354px 视口表单不再被裁）
    expect(scss).toContain("width: min(290px, 100%)");
    // vh/dvh 双写（移动端动态工具栏）
    expect(scss).toContain("height: 100dvh");
    // .login-box 不得重新裁内容（裁切曾使窄视口登录不可用且无滚动出口）
    expect(scss).not.toMatch(/\.login-box\s*\{[^}]*overflow:\s*hidden/);
  });
});
