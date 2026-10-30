<script lang="ts" setup>
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import ReCol from "@/components/ReCol";
import { ReSplitPane } from "@/components/ReSplitPane";
import ReResize from "@/components/ReResize";
import ReCollapseParams from "@/components/ReCollapseParams";
import type {
  CollapseParamSchema,
  CollapseParamValues
} from "@/components/ReCollapseParams";

/** 布局类组件活样例 + props 速查 */
defineOptions({ name: "PlaygroundLayout" });

const { t } = useI18n();

const percent = ref(50);

const resizeBox = reactive({ w: 220, h: 120 });

const collapseParams = reactive({
  value: {
    threshold: 80,
    region: "cn-north-1",
    retention: "30d",
    owner: "ops"
  } as CollapseParamValues,
  schema: [
    {
      key: "threshold",
      label: t("playground.paramThreshold"),
      description: t("playground.paramThresholdDesc"),
      defaultValue: 80
    },
    {
      key: "region",
      label: t("playground.paramRegion"),
      description: t("playground.paramRegionDesc")
    },
    {
      key: "retention",
      label: t("playground.paramRetention"),
      description: t("playground.paramRetentionDesc"),
      defaultValue: "30d"
    },
    {
      key: "owner",
      label: t("playground.paramOwner"),
      description: t("playground.paramOwnerDesc")
    }
  ] as CollapseParamSchema[]
});
</script>

<template>
  <div class="p-4">
    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="font-medium">ReSplitPane</span>
        <code class="ml-2 text-xs text-fg-muted">
          split-set: { minPercent, defaultPercent, split: "vertical" |
          "horizontal" } · v-model:percent
        </code>
      </template>
      <ReSplitPane
        v-model:percent="percent"
        :split-set="{ minPercent: 20, defaultPercent: 50, split: 'vertical' }"
      >
        <template #paneL>
          <div class="flex-c h-40 text-sm text-fg-muted">
            {{ t("playground.paneLeft") }} {{ percent }}%
          </div>
        </template>
        <template #paneR>
          <div class="flex-c h-40 text-sm text-fg-muted">
            {{ t("playground.paneRight") }}
          </div>
        </template>
      </ReSplitPane>
    </el-card>

    <el-row :gutter="12">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReResize</span>
            <code class="ml-2 text-xs text-fg-muted">
              w/h/x/y/z(px) · minw/minh · is-draggable? · is-resizable? ·
              @resizestop / @dragstop
            </code>
          </template>
          <div
            class="relative h-56 overflow-hidden rounded border border-(--el-border-color-lighter)"
          >
            <ReResize
              v-model:w="resizeBox.w"
              v-model:h="resizeBox.h"
              :minw="120"
              :minh="80"
              :x="16"
              :y="16"
              :is-draggable="true"
              class="flex-c rounded bg-(--el-color-primary-light-9) text-sm"
              @resizestop="() => undefined"
              @dragstop="() => undefined"
            >
              {{ resizeBox.w }} × {{ resizeBox.h }}
            </ReResize>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReCollapseParams</span>
            <code class="ml-2 text-xs text-fg-muted">
              params: CollapseParamSchema[] · visibleCount?(3) ·
              defaultOpen?(false) · maxHeight? · v-model:value
            </code>
          </template>
          <ReCollapseParams
            v-model:value="collapseParams.value"
            :params="collapseParams.schema"
            :visible-count="2"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header>
        <span class="font-medium">ReCol</span>
        <code class="ml-2 text-xs text-fg-muted"
          >响应式栅格列：value(xs≤768 每行列数) · xs/sm/md 响应断点</code
        >
      </template>
      <el-row :gutter="12">
        <re-col v-for="index in 4" :key="index" :value="8" :md="6" class="mb-2">
          <div
            class="flex-c h-14 rounded bg-(--el-fill-color-light) text-sm text-fg-muted"
          >
            re-col {{ index }}
          </div>
        </re-col>
      </el-row>
    </el-card>
  </div>
</template>
