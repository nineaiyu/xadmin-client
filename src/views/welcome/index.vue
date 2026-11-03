<script lang="ts" setup>
import { markRaw, onMounted, ref } from "vue";
import { loadEcharts } from "@/plugins/echarts";
import ReCol from "@/components/ReCol";
import { ReNormalCountTo } from "@/components/ReCountTo";
import { useRenderFlicker } from "./components/ReFlicker";
import ReSkeleton from "@/components/ReSkeleton";
import ReEmpty from "@/components/ReEmpty";
import { ChartBar, ChartClock, ChartLine, ChartRound } from "./components";
import { AiDailyReportCard } from "./components";
import Segmented from "@/components/ReSegmented";
import { epColor } from "@/utils/chartTheme";
import { useDashboard } from "@/views/welcome/hook";
import dayjs from "dayjs";

/** echarts 懒加载就绪后再渲染图表组件（useECharts 在初始化时同步读取 $echarts） */
const echartsReady = ref(false);
onMounted(async () => {
  await loadEcharts();
  echartsReady.value = true;
});
defineOptions({
  name: "Welcome"
});

const {
  t,
  chartData,
  optionsBasis,
  userLoginList,
  operateLogList,
  userActiveList,
  userRegisterList,
  scopeLimited,
  loading,
  loadFailed,
  dailyReport,
  reload
} = useDashboard();
let curWeek = ref(1);

/** 操作日志时间线节点色：首条主色标记「最新」，其余禁用灰——五色循环无信息含义；
    组件实例一次性创建——渲染期重复创建会让节点在每次重渲染时闪动 */
const timelineIconLatest = markRaw(
  useRenderFlicker({ background: "var(--el-color-primary)" })
);
const timelineIconRest = markRaw(
  useRenderFlicker({ background: "var(--el-text-color-disabled)" })
);
const timelineIconOf = (index: number) =>
  index === 0 ? timelineIconLatest : timelineIconRest;
</script>

<template>
  <div>
    <div class="page-head">
      <h2 class="page-head__title">{{ t("welcome.title") }}</h2>
      <p class="page-head__subtitle">{{ t("welcome.subtitle") }}</p>
    </div>
    <el-alert
      v-if="loadFailed"
      type="error"
      :closable="false"
      show-icon
      class="mb-4"
      :title="t('welcome.loadFailed')"
    >
      <el-button link type="primary" size="small" @click="reload">
        {{ t("buttons.reload") }}
      </el-button>
    </el-alert>
    <el-alert
      v-if="scopeLimited"
      type="warning"
      :closable="false"
      show-icon
      class="mb-4"
      :title="t('welcome.dataScopeLimited')"
    />
    <!-- 首屏不使用入场动画：内容首帧可见（LCP），位移动画也不计入布局位移（CLS） -->
    <el-row :gutter="24" justify="space-around">
      <!-- AI 日报卡：开关关闭 / 未授权 / 未配置时 dailyReport 为 null，整卡不渲染（视觉零变更） -->
      <re-col v-if="dailyReport" :xs="24" class="mb-6">
        <AiDailyReportCard :report="dailyReport" />
      </re-col>
      <re-col
        v-for="(item, index) in chartData"
        :key="index"
        :md="12"
        :sm="12"
        :value="6"
        :xs="24"
        class="mb-6"
      >
        <el-card class="app-card line-card group" shadow="never">
          <div class="flex justify-between">
            <span class="text-sm text-fg-muted">{{ item.name }}</span>
            <IconifyIconOffline
              :color="epColor(item.tone)"
              :icon="item.icon"
              width="20"
              height="20"
              class="group-hover:animate-scale-bounce"
            />
          </div>
          <div class="flex justify-between items-start mt-3">
            <div class="w-1/2">
              <ReNormalCountTo
                v-if="!loading"
                :duration="item.duration"
                :endVal="item.value"
                :fontSize="'var(--display-size-stat)'"
                :startVal="0"
              />
              <ReSkeleton v-else variant="fill" class="h-8! w-1/2!" />
              <p class="text-xs font-medium text-(--success-text)">
                {{ item.percent }}
              </p>
            </div>
            <ChartLine
              v-if="echartsReady && item.data.length > 1"
              :color="epColor(item.tone)"
              :data="item.data"
              class="w-1/2!"
            />
            <ChartRound v-else-if="echartsReady" class="w-1/2!" />
            <!-- echarts 懒加载就绪前：等高骨架占位，防止图表区塌陷（CLS） -->
            <ReSkeleton v-else variant="fill" class="h-15! w-1/2!" />
          </div>
        </el-card>
      </re-col>
      <re-col :md="12" :sm="12" :value="6" :xs="24" class="mb-6">
        <el-card
          :body-style="{ padding: '0' }"
          class="app-card line-card"
          shadow="never"
        >
          <ChartClock />
        </el-card>
      </re-col>
      <re-col
        v-for="(item, index) in userActiveList"
        :key="index"
        :md="12"
        :sm="12"
        :value="6"
        :xs="24"
        class="mb-6"
      >
        <el-card class="app-card line-card" shadow="never">
          <div class="flex justify-between">
            <span class="text-sm text-fg-muted">{{ item.name }}</span>
          </div>
          <div class="flex justify-between items-start mt-3">
            <div class="w-1/2">
              <ReNormalCountTo
                v-if="!loading"
                :duration="item.duration"
                :endVal="item.value[1]"
                :fontSize="'var(--display-size-stat)'"
                :startVal="0"
              />
              <ReSkeleton v-else variant="fill" class="h-8! w-1/2!" />
              <p class="text-xs font-medium text-(--success-text)">
                {{ t("welcome.registerUser") }}
              </p>
            </div>
            <div class="w-1/2">
              <ReNormalCountTo
                v-if="!loading"
                :duration="item.duration"
                :endVal="item.value[2]"
                :fontSize="'var(--display-size-stat)'"
                :startVal="0"
              />
              <ReSkeleton v-else variant="fill" class="h-8! w-1/2!" />
              <p class="text-sm font-medium text-(--el-color-primary-dark-2)">
                {{ t("welcome.activeUser") }}
              </p>
            </div>
          </div>
        </el-card>
      </re-col>

      <re-col :value="16" :xs="24" class="mb-6">
        <el-card class="app-card bar-card" shadow="never">
          <div class="flex justify-between">
            <span class="text-base font-semibold">{{
              t("welcome.userAnalysis")
            }}</span>
            <Segmented v-model="curWeek" :options="optionsBasis" />
          </div>
          <div class="flex justify-between items-start mt-3">
            <ChartBar
              v-if="echartsReady"
              :showData="curWeek ? userLoginList : userRegisterList"
              :title="optionsBasis[curWeek].label"
              :variant="curWeek ? 'login' : 'register'"
            />
            <ReSkeleton v-else variant="fill" class="h-100!" />
          </div>
        </el-card>
      </re-col>

      <re-col :value="8" :xs="24" class="mb-6">
        <el-card class="app-card" shadow="never">
          <div class="flex justify-between">
            <span class="text-base font-semibold">{{
              t("welcome.operateLog")
            }}</span>
          </div>
          <el-scrollbar class="mt-3" max-height="410" tabindex="0">
            <ReEmpty
              v-if="!operateLogList.length"
              :description="t('welcome.noOperateLog')"
              :image-size="60"
            />
            <el-timeline v-else>
              <el-timeline-item
                v-for="(item, index) in operateLogList"
                :key="item.pk ?? item.id ?? index"
                :icon="timelineIconOf(index)"
                :timestamp="
                  dayjs(item.created_time).format('YYYY-MM-DD HH:mm:ss')
                "
                center
                placement="top"
              >
                <p
                  class="truncate text-sm text-fg-muted"
                  :title="`${item?.creator?.username ?? ''} ${item.method} ${item.module} ${item.system} ${item?.browser ?? ''}`"
                >
                  {{
                    `${item?.creator?.username ?? ""} ${item.method} ${item.module} ${item.system} ${item?.browser ?? ""}`
                  }}
                </p>
              </el-timeline-item>
            </el-timeline>
          </el-scrollbar>
        </el-card>
      </re-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card) {
  /* 隐藏 el-scrollbar 滚动条 */
  .el-scrollbar__bar {
    display: none;
  }

  /* el-timeline 每一项上下、左右边距 */
  .el-timeline-item {
    margin: 0 var(--space-1-5);
  }

  /* 时间线时间戳：EP 缺省 secondary 灰在白底对比度不足 4.5:1
     （axe color-contrast serious，webkit 渲染临界），正文灰加深一档 */
  .el-timeline-item__timestamp {
    color: var(--el-text-color-regular);
  }
}
</style>
