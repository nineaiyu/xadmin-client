<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";
import { exportPlan, type SavedPlan } from "../utils/plan-storage";

defineOptions({ name: "CodegenSavedPlans" });

const props = defineProps<{
  plans: SavedPlan[];
}>();

const emit = defineEmits<{
  load: [plan: SavedPlan];
  remove: [name: string];
  save: [name: string];
  importPlans: [json: string];
}>();

const { t } = useI18n();
const confirm = useConfirm();

const selected = ref("");
const fileInput = ref<HTMLInputElement>();

async function onSave() {
  try {
    const { value } = await ElMessageBox.prompt(
      t("codegen.planSavePrompt"),
      t("codegen.planSave"),
      { inputPattern: /\S+/, inputErrorMessage: t("codegen.planNameRequired") }
    );
    emit("save", value.trim());
  } catch {
    // 用户取消
  }
}

function onLoad(name: string) {
  const plan = props.plans.find(item => item.name === name);
  if (plan) emit("load", plan);
}

async function onRemove(name: string) {
  if (
    !(await confirm(t("codegen.planDeleteConfirm"), {
      title: t("codegen.planDelete")
    }))
  ) {
    return;
  }
  emit("remove", name);
}

function onExport() {
  const plan = props.plans.find(item => item.name === selected.value);
  if (!plan) return;
  const blob = new Blob([exportPlan(plan)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `codegen-plan-${plan.name}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function onImportClick() {
  fileInput.value?.click();
}

async function onImportChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  emit("importPlans", await file.text());
}

function notifyEmpty() {
  message(t("codegen.planPickFirst"), { type: "warning" });
}
</script>

<template>
  <div class="flex items-center gap-1 flex-wrap">
    <el-select
      v-model="selected"
      size="small"
      clearable
      filterable
      class="w-44!"
      :placeholder="t('codegen.planPick')"
    >
      <el-option
        v-for="plan in plans"
        :key="plan.name"
        :value="plan.name"
        :label="plan.name"
      >
        <div class="flex-bc gap-2">
          <span>{{ plan.name }}</span>
          <!-- 方案仅存浏览器 localStorage（不落库），条目上明示，避免误解为服务端数据 -->
          <el-tag size="small" type="info" class="shrink-0">
            {{ t("codegen.planLocalDraft") }}
          </el-tag>
        </div>
      </el-option>
    </el-select>
    <el-button size="small" @click="onSave">
      {{ t("codegen.planSave") }}
    </el-button>
    <el-button
      size="small"
      type="primary"
      :disabled="!selected"
      @click="selected ? onLoad(selected) : notifyEmpty()"
    >
      {{ t("codegen.planLoad") }}
    </el-button>
    <el-button size="small" :disabled="!selected" @click="onExport">
      {{ t("codegen.planExport") }}
    </el-button>
    <el-button
      size="small"
      type="danger"
      plain
      :disabled="!selected"
      @click="selected ? onRemove(selected) : notifyEmpty()"
    >
      {{ t("codegen.planDelete") }}
    </el-button>
    <el-button size="small" @click="onImportClick">
      {{ t("codegen.planImport") }}
    </el-button>
    <input
      ref="fileInput"
      type="file"
      accept="application/json"
      class="hidden"
      @change="onImportChange"
    />
  </div>
</template>
