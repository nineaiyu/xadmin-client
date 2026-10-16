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
  remove: [pk: string];
  save: [name: string, isShared: boolean];
  importPlans: [json: string];
}>();

const { t } = useI18n();
const confirm = useConfirm();

/** 当前选中项（按主键，允许本人与共享方案同名共存） */
const selected = ref("");
/** 保存时是否共享给同页用户 */
const sharedOnSave = ref(false);
const fileInput = ref<HTMLInputElement>();

async function onSave() {
  try {
    const { value } = await ElMessageBox.prompt(
      t("codegen.planSavePrompt"),
      t("codegen.planSave"),
      { inputPattern: /\S+/, inputErrorMessage: t("codegen.planNameRequired") }
    );
    emit("save", value.trim(), sharedOnSave.value);
  } catch {
    // 用户取消
  }
}

function onLoad(pk: string) {
  const plan = props.plans.find(item => item.pk === pk);
  if (plan) emit("load", plan);
}

async function onRemove(pk: string) {
  if (
    !(await confirm(t("codegen.planDeleteConfirm"), {
      title: t("codegen.planDelete")
    }))
  ) {
    return;
  }
  emit("remove", pk);
}

function onExport() {
  const plan = props.plans.find(item => item.pk === selected.value);
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
      data-testid="codegen-plan-select"
      size="small"
      clearable
      filterable
      class="w-44!"
      :placeholder="t('codegen.planPick')"
    >
      <el-option
        v-for="plan in plans"
        :key="plan.pk"
        :value="plan.pk"
        :label="plan.name"
      >
        <div class="flex-bc gap-2">
          <span>{{ plan.name }}</span>
          <!-- 方案存服务端；共享方案对同页其他用户只读可见 -->
          <el-tag
            v-if="plan.isShared"
            size="small"
            type="success"
            class="shrink-0"
          >
            {{ t("codegen.planShared") }}
          </el-tag>
        </div>
      </el-option>
    </el-select>
    <el-button size="small" data-testid="codegen-plan-save" @click="onSave">
      {{ t("codegen.planSave") }}
    </el-button>
    <el-checkbox v-model="sharedOnSave" size="small" class="ml-1!">
      {{ t("codegen.planShareOnSave") }}
    </el-checkbox>
    <el-button
      size="small"
      type="primary"
      data-testid="codegen-plan-load"
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
      data-testid="codegen-plan-delete"
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
