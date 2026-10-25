<script lang="ts" setup>
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { renderRichText } from "../utils/richText";

defineOptions({ name: "ScreenRichTextEditor" });

/**
 * 富文本编辑器：**选区包裹按钮 + 实时预览**。
 *
 * 为什么不是 `contenteditable` 所见即所得：粘贴清洗、输入法、撤销栈、选区模型与安全面
 * 要全量翻新（收益/风险不匹配，ADR 里已登记为触发制）。这里用「标记编辑 + 右侧实时渲染」，
 * 工具条按钮作用于 textarea 的当前选区——所见即所得的部分由预览承担。
 *
 * 数据是纯文本标记（`text_format = rich`），渲染复用 `utils/richText`（转义 + 白名单），
 * 因此预览与投屏逐像素同源。
 */
const props = defineProps<{
  modelValue: string;
  /** 编辑区行数（属性面板里给一个合适的默认） */
  rows?: number;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const { t } = useI18n();

const textareaRef = ref<HTMLTextAreaElement>();
const value = computed(() => props.modelValue ?? "");

/**
 * 当前选区（**原生 textarea** 才有 `selectionStart/End`；用 el-input 组件会被包一层，
 * 拿到的是组件实例、两个属性为 undefined，`slice(undefined)` 会退化成「整串复制」）。
 * 元素尚未挂载时退化为「插到末尾」，保证按钮永远有确定行为。
 */
function selectionRange(): { start: number; end: number } {
  const el = textareaRef.value;
  const length = value.value.length;
  if (!el) return { start: length, end: length };
  const start = Number.isFinite(el.selectionStart) ? el.selectionStart : length;
  const end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : start;
  return { start, end: Math.max(start, end) };
}
const preview = computed(() => renderRichText(value.value));

/** 行内包裹（粗 / 斜 / 下划线 / 删除线 / 颜色）：有选区内嵌选中文本，无选区插入占位 */
function wrapSelection(prefix: string, suffix = prefix) {
  const el = textareaRef.value;
  if (!el) return;
  const { selectionStart: start, selectionEnd: end } = el;
  const selected =
    value.value.slice(start, end) || t("dataScreen.richPlaceholder");
  const next =
    value.value.slice(0, start) +
    prefix +
    selected +
    suffix +
    value.value.slice(end);
  emit("update:modelValue", next);
  void focusRange(
    start + prefix.length,
    start + prefix.length + selected.length
  );
}

/** 链接 / 图片：包裹成 `[文本](https://)` 形态，URL 留空由用户就地补全 */
function insertLink(kind: "link" | "image") {
  const { start, end } = selectionRange();
  const selected =
    value.value.slice(start, end) || t("dataScreen.richPlaceholder");
  const snippet =
    kind === "link" ? `[${selected}](https://)` : `![${selected}](https://)`;
  const next = value.value.slice(0, start) + snippet + value.value.slice(end);
  emit("update:modelValue", next);
  // 光标落到 `https://` 之后，方便直接粘贴地址
  const urlStart = start + snippet.length - 1;
  void focusRange(urlStart, urlStart);
}

/** 列表：给选中的每一行加前缀；无选区时插入一个占位项（按钮不至于「点了没反应」） */
function prefixLines(marker: (_position: number) => string) {
  const { start, end } = selectionRange();
  const head = value.value.slice(0, start);
  const tail = value.value.slice(end);
  const body =
    value.value.slice(start, end) || `${t("dataScreen.richPlaceholder")}`;
  const lines = body.split("\n");
  const rendered = lines
    .map((line, index) => (line ? `${marker(index)}${line}` : line))
    .join("\n");
  // 无选区（插在光标处）时补一个换行，避免和上一行黏在一起
  const prefix = head && !head.endsWith("\n") ? "\n" : "";
  const next = `${head}${prefix}${rendered}${tail}`;
  emit("update:modelValue", next);
  // 光标收在插入内容末尾（**不选中**）：接着点下一个块级按钮时不会把这段替换掉
  const caret = start + prefix.length + rendered.length;
  void focusRange(caret, caret);
}

/** 表格：插入 2×2 骨架（表头 + 一行数据），单元格就地编辑；文案走词条（en 不插中文示例） */
function insertTable() {
  const snippet = `| ${t("dataScreen.richTableCol1")} | ${t(
    "dataScreen.richTableCol2"
  )} |\n| --- | --- |\n| ${t("dataScreen.richTableCell")} | ${t(
    "dataScreen.richTableCell"
  )} |`;
  const { start, end } = selectionRange();
  const prefix =
    start > 0 && !value.value.slice(0, start).endsWith("\n") ? "\n" : "";
  const next = `${value.value.slice(0, start)}${prefix}${snippet}${value.value.slice(end)}`;
  emit("update:modelValue", next);
  // 光标收在插入内容末尾（**不选中**）：接着点下一个块级按钮时不会把这段替换掉
  const caret = start + prefix.length + snippet.length;
  void focusRange(caret, caret);
}

async function focusRange(start: number, end: number) {
  await nextTick();
  const el = textareaRef.value;
  if (!el) return;
  el.focus();
  el.setSelectionRange(start, end);
}

const TOOLS: {
  key: string;
  testid: string;
  label: string;
  run: () => void;
}[] = [
  {
    key: "bold",
    testid: "rich-tool-bold",
    label: "dataScreen.richBold",
    run: () => wrapSelection("**")
  },
  {
    key: "italic",
    testid: "rich-tool-italic",
    label: "dataScreen.richItalic",
    run: () => wrapSelection("*")
  },
  {
    key: "underline",
    testid: "rich-tool-underline",
    label: "dataScreen.richUnderline",
    run: () => wrapSelection("__")
  },
  {
    key: "strike",
    testid: "rich-tool-strike",
    label: "dataScreen.richStrike",
    run: () => wrapSelection("~~")
  },
  {
    key: "color",
    testid: "rich-tool-color",
    label: "dataScreen.richColor",
    // 默认插入一个占位颜色（用户改成自己的色值即可），避免把具体色值写死进业务
    run: () => wrapSelection("[c=#rrggbb]", "[/c]")
  },
  {
    key: "link",
    testid: "rich-tool-link",
    label: "dataScreen.richLink",
    run: () => insertLink("link")
  },
  {
    key: "image",
    testid: "rich-tool-image",
    label: "dataScreen.richImage",
    run: () => insertLink("image")
  },
  {
    key: "ul",
    testid: "rich-tool-ul",
    label: "dataScreen.richList",
    run: () => prefixLines(() => "- ")
  },
  {
    key: "ol",
    testid: "rich-tool-ol",
    label: "dataScreen.richOrderedList",
    run: () => prefixLines(index => `${index + 1}. `)
  },
  {
    key: "table",
    testid: "rich-tool-table",
    label: "dataScreen.richTable",
    run: () => insertTable()
  }
];
</script>

<template>
  <div class="rich-editor" data-testid="rich-editor">
    <div class="rich-editor__tools">
      <el-button
        v-for="tool in TOOLS"
        :key="tool.key"
        size="small"
        text
        :data-testid="tool.testid"
        @mousedown.prevent
        @click="tool.run"
      >
        {{ t(tool.label) }}
      </el-button>
    </div>
    <textarea
      ref="textareaRef"
      class="rich-editor__input"
      :rows="rows ?? 4"
      data-testid="inspector-text"
      :value="modelValue"
      @input="
        emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
      "
    />
    <!-- 实时预览：与投屏同一个渲染函数，标记写错立刻可见 -->
    <div class="rich-editor__preview" data-testid="rich-preview">
      <span class="rich-editor__preview-label">
        {{ t("dataScreen.richPreview") }}
      </span>
      <!-- eslint-disable-next-line vue/no-v-html -- 内容由 utils/richText 生成（先转义再套白名单） -->
      <div class="rich-editor__preview-body" v-html="preview" />
    </div>
    <div class="rich-editor__hint">{{ t("dataScreen.richTextHint") }}</div>
  </div>
</template>

<style lang="scss" scoped>
.rich-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.rich-editor__tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  :deep(.el-button) {
    padding: var(--space-1) var(--space-2);
  }
}

.rich-editor__preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px dashed var(--screen-border);
  border-radius: var(--el-border-radius-base);
}

.rich-editor__preview-label {
  font-size: var(--el-font-size-extra-small);
  color: var(--screen-fg-dim);
}

/* 原生 textarea：面板里与 el-input 观感一致（保留选择 API 与粘贴行为） */
.rich-editor__input {
  width: 100%;
  padding: var(--space-2);
  font-family: var(--el-font-family);
  font-size: var(--el-font-size-small);
  line-height: 1.6;
  color: var(--el-text-color-primary);
  resize: vertical;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);

  &:focus {
    outline: none;
    border-color: var(--el-color-primary);
  }
}

/* 预览区沿用窗格内的富文本样式（深色底） */
.rich-editor__preview-body {
  overflow: auto;
  font-size: var(--el-font-size-small);
  color: var(--screen-fg);
  overflow-wrap: anywhere;

  :deep(p) {
    margin: 0;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 1.4em;
    margin: 0;
  }

  :deep(a) {
    color: inherit;
    text-decoration: underline;
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
  }

  :deep(th),
  :deep(td) {
    padding: 0.2em 0.5em;
    text-align: left;
    border: 1px solid var(--screen-border);
  }
}

.rich-editor__hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: var(--screen-fg-dim);
}
</style>
