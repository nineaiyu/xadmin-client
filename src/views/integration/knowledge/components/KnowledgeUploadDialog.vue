<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";

/**
 * 上传知识库文档：文本入库，不落文件系统。
 *
 * 「选择本地 Markdown 文件」由浏览器 FileReader 读取为文本填充到编辑区，
 * 用户可再编辑后提交——与直接粘贴文本走同一接口（同名覆盖更新）。
 *
 * 表单契约：`getPayload()` 校验并返回载荷，返回 `null` 表示校验未过、
 * 调用方保持弹窗打开；提交与列表刷新由打开方（ReDialog 的 beforeSure）负责。
 */
defineOptions({ name: "KnowledgeUploadDialog" });

const { t } = useI18n();

const MAX_CONTENT = 200_000;
const name = ref("");
const content = ref("");
const fileInput = ref<HTMLInputElement>();

const pickFile = () => fileInput.value?.click();

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    content.value = String(reader.result ?? "");
    if (!name.value.trim()) {
      name.value = file.name.replace(/\.(md|markdown|txt)$/i, "");
    }
  };
  reader.onerror = () =>
    message(t("aiKnowledge.readFileFailed"), { type: "warning" });
  reader.readAsText(file, "utf-8");
};

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): { name: string; content: string } | null => {
  if (!name.value.trim() || !content.value.trim()) {
    message(t("aiKnowledge.required"), { type: "warning" });
    return null;
  }
  if (content.value.length > MAX_CONTENT) {
    message(t("aiKnowledge.tooLarge"), { type: "warning" });
    return null;
  }
  return { name: name.value.trim(), content: content.value };
};

defineExpose({ getPayload });
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
              accept=".md,.markdown,.txt"
              class="hidden"
              data-testid="knowledge-file-input"
              @change="onFileChange"
            />
          </div>
          <el-input
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
