<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { knowledgeApi } from "@/api/system/knowledge";

/**
 * 上传知识库文档（ADR-033）：文本入库，不落文件系统。
 *
 * 「选择本地 Markdown 文件」由浏览器 FileReader 读取为文本填充到编辑区，
 * 用户可再编辑后提交——与直接粘贴文本走同一接口（同名覆盖更新）。
 */
defineOptions({ name: "KnowledgeUploadDialog" });

const props = defineProps<{
  onSaved?: () => void;
}>();

const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const MAX_CONTENT = 200_000;
const name = ref("");
const content = ref("");
const saving = ref(false);
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

const submit = async () => {
  if (!name.value.trim() || !content.value.trim()) {
    message(t("aiKnowledge.required"), { type: "warning" });
    return;
  }
  if (content.value.length > MAX_CONTENT) {
    message(t("aiKnowledge.tooLarge"), { type: "warning" });
    return;
  }
  saving.value = true;
  try {
    const res = await knowledgeApi.upload(name.value.trim(), content.value);
    if (res.code === 1000) {
      message(res.detail ?? t("aiKnowledge.uploadDone"), { type: "success" });
      props.onSaved?.();
      emit("close");
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  } finally {
    saving.value = false;
  }
};
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
            <span class="text-xs text-gray-400">
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
    <div class="flex justify-end gap-2">
      <el-button @click="emit('close')">{{ t("buttons.cancel") }}</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        {{ t("buttons.save") }}
      </el-button>
    </div>
  </div>
</template>
