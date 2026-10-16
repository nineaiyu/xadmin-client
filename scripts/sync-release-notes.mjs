/**
 * 把 tag 区间的完整提交变更同步进 GitHub Release 说明。
 *
 * 背景：发布说明由 release-drafter 生成，它**只汇总 Pull Request**——直接推送到
 * 主干的提交不会出现在 Release 中（表现为「提交上千条、Release 只有几条」）。
 * 发布流水线在 Release 创建后调用本脚本，用按提交类型分组的完整列表替换
 * 「版本变化」段，保留模板其余段落（升级提示等）。
 *
 * 用法：node scripts/sync-release-notes.mjs <prevTag> <tag>
 * 依赖：git（读取区间提交）、gh（读写 Release，需 GITHUB_TOKEN 或已登录）。
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** 分组顺序与标题（未列出的 type 归入「其他」） */
const TYPE_LABELS = [
  ["feat", "新功能"],
  ["fix", "缺陷修复"],
  ["perf", "性能优化"],
  ["refactor", "重构"],
  ["docs", "文档"],
  ["test", "测试"],
  ["chore", "构建与杂项"],
  ["ci", "持续集成"]
];

/** conventional commit 头部：type(scope)!: subject */
const COMMIT_HEADER = /^([a-zA-Z]+)(\([^)]*\))?!?:\s*(.*)$/;

/** 需要被替换的段落标题（release-config.yml 模板中的「版本变化」） */
const CHANGES_HEADING = "## 版本变化";

const run = (file, args) =>
  execFileSync(file, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

/** 从 origin 远程地址解析 owner/repo（失败时回退默认值） */
function repoSlug() {
  try {
    const url = run("git", ["config", "--get", "remote.origin.url"]).trim();
    const matched = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
    return matched ? matched[1] : "nineaiyu/xadmin-client";
  } catch {
    return "nineaiyu/xadmin-client";
  }
}

/** 按提交类型分组生成「版本变化」段（全部提交，折叠呈现） */
export function buildChangesSection(prevTag, tag) {
  const raw = run("git", [
    "log",
    "--no-merges",
    "--format=%h\t%s",
    `${prevTag}..${tag}`
  ]);
  const buckets = new Map([
    ...TYPE_LABELS.map(([key]) => [key, []]),
    ["其他", []]
  ]);
  let total = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const [sha, subject] = line.split("\t");
    total += 1;
    const matched = subject.match(COMMIT_HEADER);
    const key =
      matched && buckets.has(matched[1].toLowerCase())
        ? matched[1].toLowerCase()
        : "其他";
    const text = matched ? matched[3].trim() : subject.trim();
    const scope = matched ? (matched[2] ?? "").replace(/[()]/g, "") : "";
    buckets
      .get(key)
      .push(
        scope ? `- \`${sha}\` **${scope}** ${text}` : `- \`${sha}\` ${text}`
      );
  }

  const lines = [
    `${CHANGES_HEADING}  What's Changed`,
    "",
    `> 本版包含 ${prevTag} → ${tag} 区间内 **${total} 个提交**（按提交类型分组；` +
      "release-drafter 仅汇总 PR，直接推送的提交由本段补齐）。",
    ""
  ];
  for (const [key, label] of [...TYPE_LABELS, ["其他", "其他"]]) {
    const items = buckets.get(key);
    if (!items.length) continue;
    lines.push(
      `<details><summary><b>${label} ${key}（${items.length}）</b></summary>`,
      "",
      ...items,
      "",
      "</details>",
      ""
    );
  }
  lines.push(
    `**完整变更日志**：https://github.com/${repoSlug()}/compare/${prevTag}...${tag}`
  );
  return lines.join("\n");
}

/** 用新生成的变更段替换 body 中「版本变化」至下一个二级标题之间的内容 */
export function replaceChangesSection(body, changes) {
  const start = body.indexOf(CHANGES_HEADING);
  if (start === -1) return `${changes}\n\n${body}`.trim() + "\n";
  const rest = body.slice(start + CHANGES_HEADING.length);
  const matched = rest.match(/\n## /);
  const tail = matched ? rest.slice(matched.index + 1) : "";
  return `${body.slice(0, start)}${changes}\n\n${tail}`.trim() + "\n";
}

function main() {
  const [prevTag, tag] = process.argv.slice(2);
  if (!prevTag || !tag) {
    console.error("用法：node scripts/sync-release-notes.mjs <prevTag> <tag>");
    process.exit(2);
  }

  const changes = buildChangesSection(prevTag, tag);
  const body = run("gh", [
    "release",
    "view",
    tag,
    "--json",
    "body",
    "-q",
    ".body"
  ]);
  const merged = replaceChangesSection(body, changes);

  const notesPath = join(
    mkdtempSync(join(tmpdir(), "release-notes-")),
    "notes.md"
  );
  writeFileSync(notesPath, merged, "utf8");
  run("gh", ["release", "edit", tag, "--notes-file", notesPath]);
  console.log(`release notes synced for ${tag} (${prevTag}..${tag})`);
}

if (process.argv[1] && process.argv[1].endsWith("sync-release-notes.mjs")) {
  main();
}
