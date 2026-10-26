<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { downloadBlob } from "@/utils/download";
import { useConfirm } from "@/hooks/useConfirm";
import { usePrompt } from "@/hooks/useMessageBox";
import { useUserStoreHook } from "@/store/modules/user";
import { exportPlan, type SavedPlan } from "../utils/plan-service";

defineOptions({ name: "CodegenSavedPlans" });

const props = defineProps<{
  plans: SavedPlan[];
}>();

const emit = defineEmits<{
  load: [plan: SavedPlan];
  remove: [pk: string];
  save: [name: string, isShared: boolean];
  update: [pk: string, patch: { name?: string; is_shared?: boolean }];
  importPlans: [json: string];
}>();

const { t } = useI18n();
const confirm = useConfirm();
const prompt = usePrompt();
const currentUsername = useUserStoreHook().username;

/** 当前选中项（按主键，允许本人与共享方案同名共存） */
const selected = ref("");
/** 共享方案仅创建者可删除；本人方案始终可删 */
const canRemoveSelected = computed(() => {
  const plan = props.plans.find(item => item.pk === selected.value);
  if (!plan) return false;
  return !plan.isShared || plan.creatorName === currentUsername;
});
/** 当前选中方案（编辑/共享动作的目标） */
const selectedPlan = computed(() =>
  props.plans.find(item => item.pk === selected.value)
);
/** 只有本人方案可改名/切换共享 */
const canEditSelected = computed(
  () =>
    Boolean(selectedPlan.value) &&
    (!selectedPlan.value!.isShared ||
      selectedPlan.value!.creatorName === currentUsername)
);
/** 保存时是否共享给同页用户 */
const sharedOnSave = ref(false);
const fileInput = ref<HTMLInputElement>();

async function onSave() {
  const result = await prompt(
    t("codegen.planSavePrompt"),
    t("codegen.planSave"),
    { inputPattern: /\S+/, inputErrorMessage: t("codegen.planNameRequired") }
  );
  if (!result?.value.trim()) return;
  emit("save", result.value.trim(), sharedOnSave.value);
}

async function onRename() {
  const plan = selectedPlan.value;
  if (!plan) return notifyEmpty();
  const result = await prompt(
    t("codegen.planRenamePrompt"),
    t("codegen.planRename"),
    {
      inputValue: plan.name,
      inputPattern: /\S+/,
      inputErrorMessage: t("codegen.planNameRequired")
    }
  );
  if (!result?.value.trim()) return;
  emit("update", plan.pk, { name: result.value.trim() });
}

async function onToggleShared() {
  const plan = selectedPlan.value;
  if (!plan) return notifyEmpty();
  if (
    !(await confirm(
      plan.isShared
        ? t("codegen.planUnshareConfirm")
        : t("codegen.planShareConfirm"),
      { title: t("codegen.planShare") }
    ))
  ) {
    return;
  }
  emit("update", plan.pk, { is_shared: !plan.isShared });
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
  downloadBlob(`codegen-plan-${plan.name}.json`, blob);
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
    <el-button
      size="small"
      data-testid="codegen-plan-rename"
      :disabled="!canEditSelected"
      @click="onRename"
    >
      {{ t("codegen.planRename") }}
    </el-button>
    <el-button
      size="small"
      data-testid="codegen-plan-share"
      :disabled="!canEditSelected"
      @click="onToggleShared"
    >
      {{
        selectedPlan?.isShared
          ? t("codegen.planUnshare")
          : t("codegen.planShare")
      }}
    </el-button>
    <el-button size="small" :disabled="!selected" @click="onExport">
      {{ t("codegen.planExport") }}
    </el-button>
    <el-button
      size="small"
      type="danger"
      plain
      data-testid="codegen-plan-delete"
      :disabled="!selected || !canRemoveSelected"
      :title="
        selected && !canRemoveSelected
          ? t('codegen.planSharedDeleteDenied')
          : ''
      "
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
