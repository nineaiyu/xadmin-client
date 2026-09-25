<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import {
  getScreenCommandState,
  sendScreenCommand,
  type ScreenCommandPayload,
  type ScreenCommandState,
  type ScreenItem
} from "@/api/system/analysis";

/**
 * 大屏远程控制面板（ReDialog 内容组件，hideFooter）。
 *
 * 控制态由服务端缓存（system/ws_screen.py）；本面板只做「读取当前态 + 下发指令」，
 * 展示端经 ws/screen/<pk> 被动接收。切换/翻页后展示端进入 manual 停轮播，
 * 「恢复轮播」回到 auto。指令成功后原地刷新状态，弹窗保持打开可连续操作。
 */
defineOptions({ name: "ScreenControlForm" });

const props = defineProps<{
  /** 目标大屏 */
  row: ScreenItem;
  /** 该大屏的仪表盘（pk/name，由页面按 row.dashboards 过滤后传入） */
  dashboards: { pk: string; name: string }[];
}>();

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const state = ref<ScreenCommandState>({
  mode: "auto",
  index: 0,
  refresh_rev: 0,
  rev: 0,
  ts: ""
});
const loading = ref(false);
/** 切换目标（默认选中当前展示页） */
const targetPk = ref("");

const pageText = computed(
  () => `${state.value.index + 1} / ${props.dashboards.length || 0}`
);
const modeText = computed(() =>
  state.value.mode === "manual"
    ? t("dataScreen.controlManual")
    : t("dataScreen.controlAuto")
);
/** 翻页范围以服务端仪表盘清单为准（展示端可能跳过不可见项） */
const canPage = computed(() => props.dashboards.length > 1);

const syncTarget = () => {
  targetPk.value = props.dashboards[state.value.index]?.pk ?? "";
};

const loadState = async () => {
  const res = await getScreenCommandState(props.row.pk);
  if (res.code !== SUCCESS_CODE) return;
  state.value = res.data.state;
  syncTarget();
};

/** 下发指令：成功后原地回写控制态；失败提示但保持弹窗（可重试） */
const apply = async (payload: ScreenCommandPayload) => {
  loading.value = true;
  try {
    // 异常归一为可读失败结果：避免请求异常时函数抛出、按钮 loading 悬挂
    const res = await sendScreenCommand(props.row.pk, payload).catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error),
      data: { state: state.value }
    }));
    if (res.code === SUCCESS_CODE) {
      state.value = res.data.state;
      syncTarget();
      message(t("dataScreen.controlSent"), { type: "success" });
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  } finally {
    loading.value = false;
  }
};

const switchTo = () => {
  if (!targetPk.value) return;
  void apply({ command: "switch", dashboard_pk: targetPk.value });
};

const goPage = (offset: number) => {
  const target = state.value.index + offset;
  if (target < 0 || target >= props.dashboards.length) return;
  void apply({ command: "page", index: target });
};

/** 重拉展示端数据（不改变浏览位置与轮播模式） */
const refreshData = () => void apply({ command: "refresh" });

/** 恢复自动轮播（展示端从当前页继续） */
const resumeAuto = () => void apply({ command: "auto" });

onMounted(loadState);
</script>

<template>
  <el-form label-width="90px">
    <el-form-item :label="t('dataScreen.controlState')">
      <el-tag size="small" :type="state.mode === 'manual' ? 'warning' : 'info'">
        {{ modeText }}
      </el-tag>
      <span class="ml-2 text-sm text-(--el-text-color-regular)">
        {{ t("dataScreen.controlPageText") }} {{ pageText }}
      </span>
    </el-form-item>
    <el-form-item :label="t('dataScreen.controlSwitch')">
      <div class="flex w-full items-center gap-2">
        <el-select
          v-model="targetPk"
          class="flex-1"
          filterable
          :placeholder="t('dataScreen.controlSwitchHint')"
        >
          <el-option
            v-for="item in dashboards"
            :key="item.pk"
            :value="item.pk"
            :label="item.name"
          />
        </el-select>
        <el-button type="primary" :loading="loading" @click="switchTo">
          {{ t("dataScreen.controlApply") }}
        </el-button>
      </div>
    </el-form-item>
    <el-form-item :label="t('dataScreen.controlPage')">
      <el-button-group>
        <el-button :disabled="!canPage || state.index <= 0" @click="goPage(-1)">
          {{ t("dataScreen.controlPrev") }}
        </el-button>
        <el-button
          :disabled="!canPage || state.index >= dashboards.length - 1"
          @click="goPage(1)"
        >
          {{ t("dataScreen.controlNext") }}
        </el-button>
      </el-button-group>
      <el-button class="ml-2" :loading="loading" @click="refreshData">
        {{ t("dataScreen.controlRefresh") }}
      </el-button>
      <el-button
        class="ml-2"
        :disabled="state.mode === 'auto'"
        :loading="loading"
        @click="resumeAuto"
      >
        {{ t("dataScreen.controlResume") }}
      </el-button>
    </el-form-item>
  </el-form>
  <div class="mt-1 text-xs text-(--el-text-color-regular)">
    {{ t("dataScreen.controlHint") }}
  </div>
  <div class="mt-4 flex justify-end">
    <el-button @click="emit('close')">{{ t("dataScreen.close") }}</el-button>
  </div>
</template>
