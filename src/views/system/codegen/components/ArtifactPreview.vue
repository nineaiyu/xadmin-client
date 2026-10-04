<script lang="ts" setup>
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Download, CopyDocument } from "@element-plus/icons-vue";
import { downloadByData } from "@pureadmin/utils";
import { message } from "@/utils/message";
import type { CodegenArtifact } from "@/api/system/codegen";

defineOptions({ name: "CodegenArtifactPreview" });

const props = defineProps<{
  artifacts: CodegenArtifact[];
  loading: boolean;
}>();

const { t } = useI18n();

const activeKey = ref("");
const active = computed(
  () => props.artifacts.find(item => item.key === activeKey.value) ?? null
);

watch(
  () => props.artifacts,
  list => {
    activeKey.value = list[0]?.key ?? "";
  }
);

/** 产物按落点分组：后端仓 / 前端仓 / 菜单种子 / 说明文档；notice 产物单列 */
type ArtifactGroup = { key: string; title: string; items: CodegenArtifact[] };

const groups = computed<ArtifactGroup[]>(() => {
  const server: CodegenArtifact[] = [];
  const client: CodegenArtifact[] = [];
  const seed: CodegenArtifact[] = [];
  const root: CodegenArtifact[] = [];
  for (const item of props.artifacts) {
    if (item.path.startsWith("xadmin-server/")) server.push(item);
    else if (item.path.startsWith("xadmin-client/")) client.push(item);
    else if (item.path.includes("loadjson/")) seed.push(item);
    else root.push(item);
  }
  const built: ArtifactGroup[] = [];
  if (server.length)
    built.push({
      key: "server",
      title: t("codegen.groupServer"),
      items: server
    });
  if (client.length)
    built.push({
      key: "client",
      title: t("codegen.groupClient"),
      items: client
    });
  if (seed.length)
    built.push({ key: "seed", title: t("codegen.groupSeed"), items: seed });
  if (root.length)
    built.push({ key: "root", title: t("codegen.groupRoot"), items: root });
  return built;
});

function fileName(item: CodegenArtifact) {
  return item.path ? item.path.split("/").slice(-1)[0] : item.label;
}

// ------------------------------------------------------------- 语法高亮
const hljs = shallowRef<
  null | (typeof import("highlight.js/lib/core"))["default"]
>(null);

onMounted(async () => {
  const [{ default: core }, python, typescript, xml, json, markdown] =
    await Promise.all([
      import("highlight.js/lib/core"),
      import("highlight.js/lib/languages/python"),
      import("highlight.js/lib/languages/typescript"),
      import("highlight.js/lib/languages/xml"),
      import("highlight.js/lib/languages/json"),
      import("highlight.js/lib/languages/markdown")
    ]);
  core.registerLanguage("python", python.default);
  core.registerLanguage("typescript", typescript.default);
  core.registerLanguage("xml", xml.default);
  core.registerLanguage("json", json.default);
  core.registerLanguage("markdown", markdown.default);
  hljs.value = core;
});

function detectLanguage(path: string) {
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".vue")) return "xml";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "";
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const highlighted = computed(() => {
  const content = active.value?.content ?? "";
  if (!content) return "";
  const language = detectLanguage(active.value?.path ?? "");
  const engine = hljs.value;
  if (!engine || !language) return escapeHtml(content);
  try {
    return engine.highlight(content, { language }).value;
  } catch {
    return escapeHtml(content);
  }
});

const lineNumbers = computed(() => {
  const total = (active.value?.content ?? "").split("\n").length;
  return Array.from({ length: total }, (_, index) => index + 1).join("\n");
});

// ------------------------------------------------------------- 复制 / 单文件下载
async function copyActive() {
  const content = active.value?.content ?? "";
  if (!content) {
    message(t("codegen.copyEmpty"), { type: "warning" });
    return;
  }
  await navigator.clipboard.writeText(content);
  message(t("codegen.copyOk"), { type: "success" });
}

function downloadActive() {
  const item = active.value;
  if (!item?.content) return;
  downloadByData(
    new Blob([item.content], { type: "text/plain;charset=utf-8" }),
    fileName(item) || "artifact.txt"
  );
  message(t("codegen.downloadStarted"), { type: "success" });
}
</script>

<template>
  <div class="flex gap-2 codegen-preview">
    <el-scrollbar class="w-60 shrink-0 border border-[#e5e7eb] rounded">
      <div v-for="group in groups" :key="group.key" class="py-1">
        <div
          class="px-3 py-1 text-xs font-medium text-gray-400 bg-[#f5f7fa] sticky top-0"
        >
          {{ group.title }}
        </div>
        <div
          v-for="item in group.items"
          :key="item.key"
          class="px-3 py-1.5 cursor-pointer text-sm hover:bg-[#f5f7fa]"
          :class="{
            'bg-[#ecf5ff] text-(--el-color-primary)': item.key === activeKey
          }"
          @click="activeKey = item.key"
        >
          <div class="flex items-center gap-1">
            <span class="truncate">{{ fileName(item) }}</span>
            <el-tag v-if="item.label === '后续步骤'" size="small" type="info">
              MD
            </el-tag>
          </div>
          <div class="text-xs text-gray-400 truncate">
            {{ item.path || item.notice }}
          </div>
        </div>
      </div>
    </el-scrollbar>
    <el-card
      shadow="never"
      class="flex-1 overflow-hidden codegen-preview__body"
    >
      <template #header>
        <div class="flex-bc gap-2">
          <span class="text-xs text-gray-500 truncate">
            {{ active?.path || active?.notice || t("codegen.previewEmpty") }}
          </span>
          <span class="flex items-center gap-1 shrink-0">
            <el-tooltip :content="t('codegen.copyCode')" placement="top">
              <el-button
                size="small"
                text
                :icon="CopyDocument"
                @click="copyActive"
              />
            </el-tooltip>
            <el-tooltip :content="t('codegen.downloadFile')" placement="top">
              <el-button
                size="small"
                text
                :icon="Download"
                @click="downloadActive"
              />
            </el-tooltip>
          </span>
        </div>
      </template>
      <el-alert
        v-if="active?.notice && !active?.content"
        :title="active.notice"
        type="warning"
        :closable="false"
      />
      <div v-else class="flex h-full overflow-auto codegen-preview__code">
        <pre
          class="m-0 text-xs/5 select-none text-right px-2 text-gray-300 sticky left-0 bg-white"
          >{{ lineNumbers }}</pre>
        <!-- highlight 输出由本组件构造（escapeHtml / hljs.highlight），不存在用户注入面 -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <pre class="m-0 text-xs/5 whitespace-pre flex-1 px-2"><code
            class="hljs"
            v-html="highlighted"
        /></pre>
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.codegen-preview {
  height: calc(100vh - 420px);
  min-height: 360px;
}

.codegen-preview__body {
  :deep(.el-card__body) {
    height: calc(100% - 57px);
    padding: 0;
  }

  .codegen-preview__code {
    min-height: 100%;
  }
}
</style>
