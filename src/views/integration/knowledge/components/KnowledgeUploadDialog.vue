<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";

/**
 * 上传知识库文档：文本入库，不落文件系统。
 *
 * - .md/.markdown/.txt：浏览器 FileReader 读取为文本填充到编辑区，用户可再编辑
 *   后提交——与直接粘贴文本走同一接口（同名覆盖更新）；
 * - .pdf/.docx（7.3 文档解析扩展）：浏览器无法读文本，走 base64 二进制载荷，
 *   服务端解析为纯文本入库（解析失败/扫描件给可读报错）。二进制文件**不可编辑**，
 *   编辑区展示「已选择文件」状态。
 *
 * 表单契约：`getPayload()` 校验并返回载荷，返回 `null` 表示校验未过、
 * 调用方保持弹窗打开；提交与列表刷新由打开方（ReDialog 的 beforeSure）负责。
 */
defineOptions({ name: "KnowledgeUploadDialog" });

const { t } = useI18n();

const MAX_CONTENT = 200_000;
const MAX_BINARY_BYTES = 2 * 1024 * 1024;
const BINARY_TYPES = { pdf: "pdf", docx: "docx" } as const;

const name = ref("");
const content = ref("");
/** 二进制文件态：选择 pdf/docx 后填充（编辑区随之禁用） */
const binary = ref<{ type: "pdf" | "docx"; base64: string } | null>(null);
const fileInput = ref<HTMLInputElement>();

const isBinaryPicked = computed(() => binary.value !== null);
const binaryTypeText = computed(() => binary.value?.type.toUpperCase() ?? "");

const pickFile = () => fileInput.value?.click();

const stripBase64Prefix = (dataUrl: string) =>
  dataUrl.slice(dataUrl.indexOf(",") + 1);

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension in BINARY_TYPES) {
    if (file.size > MAX_BINARY_BYTES) {
      message(t("aiKnowledge.binaryTooLarge"), { type: "warning" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      binary.value = {
        type: extension as "pdf" | "docx",
        base64: stripBase64Prefix(String(reader.result ?? ""))
      };
      content.value = "";
      if (!name.value.trim()) {
        name.value = file.name.replace(/\.(pdf|docx)$/i, "");
      }
    };
    reader.onerror = () =>
      message(t("aiKnowledge.readFileFailed"), { type: "warning" });
    reader.readAsDataURL(file);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    binary.value = null;
    content.value = String(reader.result ?? "");
    if (!name.value.trim()) {
      name.value = file.name.replace(/\.(md|markdown|txt)$/i, "");
    }
  };
  reader.onerror = () =>
    message(t("aiKnowledge.readFileFailed"), { type: "warning" });
  reader.readAsText(file, "utf-8");
};

/** 提交载荷（与后端契约同构的判别联合：文本直传 / 二进制解析二选一） */
type UploadPayload =
  | { name: string; content: string }
  | { name: string; file_type: "pdf" | "docx"; file_b64: string };

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): UploadPayload | null => {
  if (!name.value.trim()) {
    message(t("aiKnowledge.required"), { type: "warning" });
    return null;
  }
  if (binary.value) {
    return {
      name: name.value.trim(),
      file_type: binary.value.type,
      file_b64: binary.value.base64
    };
  }
  if (!content.value.trim()) {
    message(t("aiKnowledge.required"), { type: "warning" });
    return null;
  }
  if (content.value.length > MAX_CONTENT) {
    message(t("aiKnowledge.tooLarge"), { type: "warning" });
    return null;
  }
  return { name: name.value.trim(), content: content.value };
};

defineExpose({ getPayload, isBinaryPicked });
</script>

<template>
  <div>
    <el-form label-width="90px">
      <el-form-item :label="t('aiKnowledge.name')" required>
        <el-input
          v-model="name"
          maxlength="120"
          :placeholder="t('aiKnowledge.namePlaceholder')"
          data-testid="knowledge-name-input"
        />
      </el-form-item>
      <el-form-item :label="t('aiKnowledge.content')" required>
        <div class="w-full">
          <div class="mb-2 flex items-center gap-2">
            <el-button size="small" @click="pickFile">
              {{ t("aiKnowledge.chooseFile") }}
            </el-button>
            <span class="text-xs text-(--el-text-color-secondary)">
              {{ t("aiKnowledge.chooseFileTip") }}
            </span>
            <input
              ref="fileInput"
              type="file"
              accept=".md,.markdown,.txt,.pdf,.docx"
              class="hidden"
              data-testid="knowledge-file-input"
              @change="onFileChange"
            />
          </div>
          <el-alert
            v-if="isBinaryPicked"
            class="mb-2"
            :title="t('aiKnowledge.binarySelected', { type: binaryTypeText })"
            type="info"
            :closable="false"
            data-testid="knowledge-binary-selected"
          />
          <el-input
            v-else
            v-model="content"
            type="textarea"
            :rows="14"
            :placeholder="t('aiKnowledge.contentPlaceholder')"
            data-testid="knowledge-content-input"
          />
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>
