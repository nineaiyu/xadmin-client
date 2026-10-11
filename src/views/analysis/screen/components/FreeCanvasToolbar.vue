<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import type { FreeTemplate } from "../utils/freeTemplates";
import {
  FREE_GRID_DEFAULT_STEP,
  FREE_GRID_STEPS,
  type FreeGridSnap
} from "../utils/freeSnap";
import { ZOOM_STEPS } from "../utils/viewport";
import type { TemplateApplyMode } from "../utils/createFreeEditor";
import TemplateVersionsDialog from "./TemplateVersionsDialog.vue";

defineOptions({ name: "ScreenFreeCanvasToolbar" });

/**
 * 自由画布工具条（模式内第二行）：显示缩放 + 复制粘贴 + 网格吸附 + 模板（内置 /
 * 我的 / 团队 + JSON 导入导出）。
 *
 * 弹窗类交互（命名 / 可见性 / 替换确认 / 文件选择）留在本组件，数据效果一律交给
 * 组合层（`createFreeEditor`）执行——工具条只收集意图并上抛，不碰窗格数据。
 * 「二选一」的弹窗（可见性、导入方式）统一用「确认 = 前者 / 取消 = 后者」，
 * 语义写进各自的标题文案，避免多写一层自绘对话框。
 */
const props = defineProps<{
  zoom: number;
  /** 是否处于「适应窗口」跟随态（高亮用） */
  autoFit: boolean;
  canCopy: boolean;
  canPaste: boolean;
  templates: FreeTemplate[];
  /** 团队模板（服务端，与本地模板分开渲染，便于按来源分组） */
  serverTemplates?: FreeTemplate[];
  /** 元素级网格吸附（ADR-088，默认关） */
  gridSnap?: FreeGridSnap;
}>();

const emit = defineEmits<{
  zoom: [value: number];
  fit: [];
  copy: [];
  paste: [];
  grid: [value: FreeGridSnap];
  saveTemplate: [name: string];
  saveServerTemplate: [
    payload: {
      name: string;
      /** 分组名（可空 = 未分组） */
      group: string;
      visibility: "personal" | "shared";
    }
  ];
  applyTemplate: [payload: { id: string; mode: TemplateApplyMode }];
  renameTemplate: [payload: { id: string; name: string }];
  removeTemplate: [id: string];
  exportTemplate: [id: string];
  renameServerTemplate: [payload: { id: string; name: string }];
  removeServerTemplate: [id: string];
  importTemplate: [payload: { raw: string; mode: TemplateApplyMode }];
  /** 模板回滚（版本历史弹窗触发） */
  rollbackTemplate: [payload: { id: string; version: number }];
  /** 从云端粘贴（跨设备剪贴板） */
  pasteCloud: [];
}>();

const { t } = useI18n();

const zoomLabel = (value: number) => `${Math.round(value * 100)}%`;

const serverTemplates = computed(() => props.serverTemplates ?? []);
/** 团队模板按分组聚合（空分组排最后并归到「未分组」） */
const serverGroups = computed(() => {
  const buckets = new Map<string, FreeTemplate[]>();
  for (const item of serverTemplates.value) {
    const key = (item.group ?? "").trim();
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([group, items]) => ({ group, items }));
});

/* 版本历史弹窗（自管拉取，回滚经组合层执行） */
const versionsVisible = ref(false);
const versionsId = ref("");
const versionsName = ref("");
function openVersions(id: string, name: string) {
  versionsId.value = id;
  versionsName.value = name;
  versionsVisible.value = true;
}
const gridSnap = computed<FreeGridSnap>(
  () => props.gridSnap ?? { enabled: false, step: FREE_GRID_DEFAULT_STEP }
);

/** 命名输入（保存 / 重命名共用）：取消返回 null，输入为空由 inputValidator 拦住 */
async function askName(title: string, initial = ""): Promise<string | null> {
  const answer = await ElMessageBox.prompt(
    t("dataScreen.templateNamePrompt"),
    title,
    {
      inputValue: initial,
      confirmButtonText: t("dataScreen.templateSave"),
      cancelButtonText: t("dataScreen.cancel"),
      inputValidator: value =>
        Boolean(value?.trim()) || t("dataScreen.templateNameRequired")
    }
  ).catch(() => null);
  const value = (answer as { value?: string } | null)?.value;
  return value?.trim() ? value.trim() : null;
}

/** 可选文本（取消 = 空串）：用于「分组名」这类可留空的输入 */
async function askOptionalText(title: string, prompt: string): Promise<string> {
  const answer = await ElMessageBox.prompt(prompt, title, {
    confirmButtonText: t("dataScreen.templateSave"),
    cancelButtonText: t("dataScreen.cancel")
  }).catch(() => null);
  return String((answer as { value?: string } | null)?.value ?? "").trim();
}

async function onSaveTemplate() {
  const name = await askName(t("dataScreen.templateSave"));
  if (name) emit("saveTemplate", name);
}

/** 另存为团队模板：名称 + 可见性（确认 = 团队共享，取消 = 仅自己可见） */
async function onSaveServerTemplate() {
  const name = await askName(t("dataScreen.templateSaveServer"));
  if (!name) return;
  const group = await askOptionalText(
    t("dataScreen.templateGroup"),
    t("dataScreen.templateGroupPrompt")
  );
  const shared = await ElMessageBox.confirm(
    t("dataScreen.templateVisibilityHint"),
    t("dataScreen.templateSaveServer"),
    {
      confirmButtonText: t("dataScreen.templateVisibilityShared"),
      cancelButtonText: t("dataScreen.templateVisibilityPersonal")
    }
  )
    .then(() => true)
    .catch(() => false);
  emit("saveServerTemplate", {
    name,
    group: group ?? "",
    visibility: shared ? "shared" : "personal"
  });
}

const fileInput = ref<HTMLInputElement>();

function onImportClick() {
  fileInput.value?.click();
}

/** 导入：读文件 → 选方式（确认 = 替换当前画布，取消 = 追加） */
async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const raw = await file.text().catch(() => "");
  if (!raw) return;
  const replace = await ElMessageBox.confirm(
    t("dataScreen.templateImportModeHint"),
    t("dataScreen.templateImport"),
    {
      confirmButtonText: t("dataScreen.templateApplyReplace"),
      cancelButtonText: t("dataScreen.templateApplyAppend")
    }
  )
    .then(() => true)
    .catch(() => false);
  emit("importTemplate", { raw, mode: replace ? "replace" : "append" });
}

async function onCommand(command: string) {
  const [action, id] = command.split(":");
  if (!id) return;
  if (action === "append") {
    emit("applyTemplate", { id, mode: "append" });
    return;
  }
  if (action === "replace") {
    const confirmed = await ElMessageBox.confirm(
      t("dataScreen.templateReplaceConfirm"),
      t("dataScreen.templateMenu"),
      { confirmButtonText: t("dataScreen.templateApplyReplace") }
    ).catch(() => null);
    if (confirmed) emit("applyTemplate", { id, mode: "replace" });
    return;
  }
  if (action === "rename") {
    const name = await askName(t("dataScreen.templateRename"));
    if (name) emit("renameTemplate", { id, name });
    return;
  }
  if (action === "remove") {
    const confirmed = await ElMessageBox.confirm(
      t("dataScreen.templateDeleteConfirm"),
      t("dataScreen.templateDelete")
    ).catch(() => null);
    if (confirmed) emit("removeTemplate", id);
    return;
  }
  if (action === "server-rename") {
    const name = await askName(t("dataScreen.templateRename"));
    if (name) emit("renameServerTemplate", { id, name });
    return;
  }
  if (action === "server-remove") {
    const confirmed = await ElMessageBox.confirm(
      t("dataScreen.templateDeleteConfirm"),
      t("dataScreen.templateDelete")
    ).catch(() => null);
    if (confirmed) emit("removeServerTemplate", id);
    return;
  }
  if (action === "versions") {
    const target = serverTemplates.value.find(item => item.id === id);
    openVersions(id, target?.name ?? "");
    return;
  }
  if (action === "export") emit("exportTemplate", id);
}
</script>

<template>
  <div class="free-toolbar" data-testid="free-toolbar">
    <span class="free-toolbar__label">{{ t("dataScreen.zoom") }}</span>
    <el-select
      class="free-toolbar__zoom"
      :model-value="zoom"
      size="small"
      data-testid="free-zoom-select"
      @change="emit('zoom', Number($event))"
    >
      <el-option
        v-for="step in ZOOM_STEPS"
        :key="step"
        :label="zoomLabel(step)"
        :value="step"
      />
    </el-select>
    <el-button
      size="small"
      :type="autoFit ? 'primary' : 'default'"
      data-testid="free-zoom-fit"
      :title="t('dataScreen.zoomKeyboardHint')"
      @click="emit('fit')"
    >
      {{ t("dataScreen.zoomFit") }}
    </el-button>
    <el-button
      size="small"
      data-testid="free-zoom-100"
      @click="emit('zoom', 1)"
    >
      {{ t("dataScreen.zoomReset") }}
    </el-button>

    <el-divider direction="vertical" />
    <el-button
      size="small"
      :disabled="!canCopy"
      data-testid="free-copy"
      @click="emit('copy')"
    >
      {{ t("dataScreen.copy") }}
    </el-button>
    <el-button
      size="small"
      :disabled="!canPaste"
      data-testid="free-paste"
      @click="emit('paste')"
    >
      {{ t("dataScreen.paste") }}
    </el-button>
    <!-- 跨设备剪贴板（ADR-090 D4）：读服务端槽位后走同一条插入链路 -->
    <el-button
      size="small"
      data-testid="free-paste-cloud"
      @click="emit('pasteCloud')"
    >
      {{ t("dataScreen.pasteCloud") }}
    </el-button>

    <el-divider direction="vertical" />
    <!-- 元素级网格吸附：参考线优先（命中参考线时不落网格），键盘微调不受影响 -->
    <el-switch
      :model-value="gridSnap.enabled"
      size="small"
      data-testid="free-grid-snap"
      :active-text="t('dataScreen.gridSnap')"
      @update:model-value="
        emit('grid', { ...gridSnap, enabled: Boolean($event) })
      "
    />
    <el-select
      class="free-toolbar__grid"
      :model-value="gridSnap.step"
      size="small"
      :disabled="!gridSnap.enabled"
      data-testid="free-grid-step"
      @change="emit('grid', { ...gridSnap, step: Number($event) })"
    >
      <el-option
        v-for="step in FREE_GRID_STEPS"
        :key="step"
        :label="`${step}px`"
        :value="step"
      />
    </el-select>

    <el-divider direction="vertical" />
    <el-dropdown trigger="click" @command="onCommand">
      <el-button size="small" data-testid="free-template-menu">
        {{ t("dataScreen.templateMenu") }}
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item disabled>
            {{ t("dataScreen.templateGroupBuiltin") }}
          </el-dropdown-item>
          <template v-for="item in templates" :key="item.id">
            <el-dropdown-item :command="`replace:${item.id}`">
              {{ t("dataScreen.templateApplyReplace") }} · {{ item.name }}
            </el-dropdown-item>
            <el-dropdown-item :command="`append:${item.id}`">
              {{ t("dataScreen.templateApplyAppend") }} · {{ item.name }}
            </el-dropdown-item>
          </template>
          <el-dropdown-item disabled divided>
            {{ t("dataScreen.templateGroupServer") }}
          </el-dropdown-item>
          <el-dropdown-item
            v-if="serverTemplates.length === 0"
            disabled
            data-testid="free-template-server-empty"
          >
            {{ t("dataScreen.templateServerEmpty") }}
          </el-dropdown-item>
          <template v-for="bucket in serverGroups" :key="`grp-${bucket.group}`">
            <el-dropdown-item v-if="bucket.group" disabled>
              {{ bucket.group }}
            </el-dropdown-item>
            <template v-for="item in bucket.items" :key="`sv-${item.id}`">
              <el-dropdown-item :command="`replace:${item.id}`">
                {{ t("dataScreen.templateApplyReplace") }} · {{ item.name }}
              </el-dropdown-item>
              <el-dropdown-item :command="`append:${item.id}`">
                {{ t("dataScreen.templateApplyAppend") }} · {{ item.name }}
              </el-dropdown-item>
            </template>
          </template>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <el-button
      size="small"
      data-testid="free-template-save"
      @click="onSaveTemplate"
    >
      {{ t("dataScreen.templateSave") }}
    </el-button>
    <el-button
      size="small"
      data-testid="free-template-save-server"
      @click="onSaveServerTemplate"
    >
      {{ t("dataScreen.templateSaveServer") }}
    </el-button>
    <el-button
      size="small"
      data-testid="free-template-import"
      @click="onImportClick"
    >
      {{ t("dataScreen.templateImport") }}
    </el-button>
    <TemplateVersionsDialog
      v-model="versionsVisible"
      :template-id="versionsId"
      :template-name="versionsName"
      @rollback="emit('rollbackTemplate', { id: versionsId, version: $event })"
    />

    <input
      ref="fileInput"
      class="free-toolbar__file"
      type="file"
      accept="application/json,.json"
      data-testid="free-template-import-input"
      @change="onFilePicked"
    />

    <el-dropdown trigger="click" @command="onCommand">
      <el-button size="small" data-testid="free-template-manage">
        {{ t("dataScreen.templateManage") }}
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-if="
              templates.every(item => item.builtin) &&
              serverTemplates.length === 0
            "
            disabled
          >
            {{ t("dataScreen.templateEmptyMine") }}
          </el-dropdown-item>
          <template v-for="item in templates" :key="item.id">
            <template v-if="!item.builtin">
              <el-dropdown-item :command="`rename:${item.id}`" divided>
                {{ t("dataScreen.templateRename") }} · {{ item.name }}
              </el-dropdown-item>
              <el-dropdown-item :command="`export:${item.id}`">
                {{ t("dataScreen.templateExport") }} · {{ item.name }}
              </el-dropdown-item>
              <el-dropdown-item :command="`remove:${item.id}`">
                {{ t("dataScreen.templateDelete") }} · {{ item.name }}
              </el-dropdown-item>
            </template>
          </template>
          <template v-for="item in serverTemplates" :key="`manage-${item.id}`">
            <template v-if="item.is_owner !== false">
              <el-dropdown-item :command="`versions:${item.id}`" divided>
                {{ t("dataScreen.templateVersions") }} · {{ item.name }}
              </el-dropdown-item>
              <el-dropdown-item :command="`export:${item.id}`">
                {{ t("dataScreen.templateExport") }} · {{ item.name }}
              </el-dropdown-item>
              <el-dropdown-item :command="`server-rename:${item.id}`">
                {{ t("dataScreen.templateRename") }} · {{ item.name }}
              </el-dropdown-item>
              <el-dropdown-item :command="`server-remove:${item.id}`">
                {{ t("dataScreen.templateDelete") }} · {{ item.name }}
              </el-dropdown-item>
            </template>
          </template>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style lang="scss" scoped>
.free-toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2) var(--space-5);
  background: var(--screen-surface);
  border-bottom: 1px solid var(--screen-border);
}

.free-toolbar__label {
  font-size: var(--el-font-size-extra-small);
  color: var(--screen-fg-dim);
}

.free-toolbar__zoom {
  width: 110px;
}

.free-toolbar__grid {
  width: 90px;
}

/* 文件选择由按钮代理（原生 input 隐藏，避免多一个可见控件） */
.free-toolbar__file {
  display: none;
}
</style>
