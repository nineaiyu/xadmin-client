<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { groupTemplates, type FreeTemplate } from "../utils/freeTemplates";
import {
  FREE_GRID_DEFAULT_STEP,
  FREE_GRID_STEPS,
  type FreeGridSnap
} from "../utils/freeSnap";
import { ZOOM_STEPS } from "../utils/viewport";
import {
  useTemplateToolbarCommands,
  type FreeCanvasToolbarEmits
} from "../utils/templateToolbar";
import TemplateVersionsDialog from "./TemplateVersionsDialog.vue";

defineOptions({ name: "ScreenFreeCanvasToolbar" });

/**
 * 自由画布工具条（模式内第二行）：显示缩放 + 复制粘贴 + 网格吸附 + 模板（内置 /
 * 我的 / 团队 + JSON 导入导出）。
 *
 * 弹窗类交互与命令分发在 utils/templateToolbar.ts（行数门禁抽出），数据效果
 * 一律交给组合层（`createFreeEditor`）执行——工具条只收集意图并上抛，不碰窗格数据。
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
  /** 元素级网格吸附（默认关） */
  gridSnap?: FreeGridSnap;
}>();

const emit = defineEmits<FreeCanvasToolbarEmits>();

const { t } = useI18n();

const zoomLabel = (value: number) => `${Math.round(value * 100)}%`;

const serverTemplates = computed(() => props.serverTemplates ?? []);
/** 团队模板按分组聚合（空分组排最后并归到「未分组」；排序口径在纯函数里，可单测） */
const serverGroups = computed(() => groupTemplates(serverTemplates.value));

const gridSnap = computed<FreeGridSnap>(
  () => props.gridSnap ?? { enabled: false, step: FREE_GRID_DEFAULT_STEP }
);

/** 模板命令交互（命名 / 确认 / 导入 / 版本历史状态，见 utils/templateToolbar.ts） */
const {
  versionsVisible,
  versionsId,
  versionsName,
  fileInput,
  onSaveTemplate,
  onSaveServerTemplate,
  onImportClick,
  onFilePicked,
  onCommand
} = useTemplateToolbarCommands({ t, emit, serverTemplates });
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
    <!-- 跨设备剪贴板：读服务端槽位后走同一条插入链路 -->
    <el-button
      size="small"
      data-testid="free-paste-cloud"
      @click="emit('pasteCloud')"
    >
      {{ t("dataScreen.pasteCloud") }}
    </el-button>
    <el-button
      size="small"
      data-testid="free-clear-cloud"
      @click="emit('clearCloud')"
    >
      {{ t("dataScreen.clearCloud") }}
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
              <el-dropdown-item :command="`server-detail:${item.id}`">
                {{ t("dataScreen.templateDetail") }} · {{ item.name }}
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
