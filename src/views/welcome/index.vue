<script lang="ts" setup>
import { markRaw, onMounted, ref } from "vue";
import { loadEcharts } from "@/plugins/echarts";
import ReCol from "@/components/ReCol";
import { ReNormalCountTo } from "@/components/ReCountTo";
import { useRenderFlicker } from "@/components/ReFlicker";
import { ChartBar, ChartClock, ChartLine, ChartRound } from "./components";
import Segmented from "@/components/ReSegmented";
import { epColor, epColorLight, type EpColorName } from "@/utils/chartTheme";
import { useDashboard } from "@/views/welcome/hook";

/** echarts 懒加载就绪后再渲染图表组件（useECharts 在初始化时同步读取 $echarts） */
const echartsReady = ref(false);
onMounted(async () => {
  await loadEcharts();
  echartsReady.value = true;
});
import dayjs from "dayjs";

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
  userRegisterList
} = useDashboard();
let curWeek = ref(1);

/** 操作日志时间线节点色：按 EP 语义色循环（原为随机渐变，刷新观感不一致且不跟主题）；
    组件实例一次性创建——渲染期重复创建会让节点在每次重渲染时闪动 */
const timelineTones: EpColorName[] = [
  "primary",
  "success",
  "warning",
  "danger",
  "info"
];
const timelineIcons = timelineTones.map(tone =>
  markRaw(useRenderFlicker({ background: `var(--el-color-${tone})` }))
);
</script>

<template>
  <div>
    <el-row :gutter="24" justify="space-around">
      <re-col
        v-for="(item, index) in chartData"
        :key="index"
        v-motion
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 80 * (index + 1)
          }
        }"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :md="12"
        :sm="12"
        :value="6"
        :xs="24"
        class="mb-4.5"
      >
        <el-card class="app-card line-card" shadow="never">
          <div class="flex justify-between">
            <span class="text-md font-medium">
              {{ item.name }}
            </span>
            <div
              :style="{ backgroundColor: epColorLight(item.tone) }"
              class="size-8 flex-c rounded-md"
            >
              <IconifyIconOffline
                :color="epColor(item.tone)"
                :icon="item.icon"
                width="18"
                height="18"
              />
            </div>
          </div>
          <div class="flex justify-between items-start mt-3">
            <div class="w-1/2">
              <ReNormalCountTo
                :duration="item.duration"
                :endVal="item.value"
                :fontSize="'1.6em'"
                :startVal="100"
              />
              <p class="font-medium text-(--el-color-success)">
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
          </div>
        </el-card>
      </re-col>
      <re-col
        v-motion
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 80 * 4
          }
        }"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :md="12"
        :sm="12"
        :value="6"
        :xs="24"
        class="mb-4.5"
      >
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
        v-motion
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 80 * (index + 1)
          }
        }"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :md="12"
        :sm="12"
        :value="6"
        :xs="24"
        class="mb-4.5"
      >
        <el-card class="app-card line-card" shadow="never">
          <div class="flex justify-between">
            <span class="text-md font-medium"> {{ item.name }}</span>
          </div>
          <div class="flex justify-between items-start mt-3">
            <div class="w-1/2">
              <ReNormalCountTo
                :duration="item.duration"
                :endVal="item.value[1]"
                :fontSize="'1.6em'"
                :startVal="100"
              />
              <p class="text-sm font-thin text-(--el-color-success)">
                {{ t("welcome.registerUser") }}
              </p>
            </div>
            <div class="w-1/2">
              <ReNormalCountTo
                :duration="item.duration"
                :endVal="item.value[2]"
                :fontSize="'1.6em'"
                :startVal="100"
              />
              <p class="text-sm font-thin text-(--el-color-primary)">
                {{ t("welcome.activeUser") }}
              </p>
            </div>
          </div>
        </el-card>
      </re-col>

      <re-col
        v-motion
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 400
          }
        }"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :value="16"
        :xs="24"
        class="mb-4.5"
      >
        <el-card class="app-card bar-card" shadow="never">
          <div class="flex justify-between">
            <span class="text-md font-medium">{{
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
          </div>
        </el-card>
      </re-col>

      <re-col
        v-motion
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 640
          }
        }"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :value="8"
        :xs="24"
        class="mb-4.5"
      >
        <el-card class="app-card" shadow="never">
          <div class="flex justify-between">
            <span class="text-md font-medium">{{
              t("welcome.operateLog")
            }}</span>
          </div>
          <el-scrollbar class="mt-3" max-height="410">
            <el-timeline>
              <el-timeline-item
                v-for="(item, index) in operateLogList"
                :key="index"
                :icon="timelineIcons[index % timelineIcons.length]"
                :timestamp="
                  dayjs(item.created_time).format('YYYY-MM-DD HH:mm:ss')
                "
                center
                placement="top"
              >
                <p class="text-text_color_regular text-sm">
                  {{
                    `${item?.creator?.username ?? ""} ${item.method} ${item.module} ${item.system} ${item?.browser}`
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
    margin: 0 6px;
  }
}

.main-content {
  --main-content-margin: 20px 20px 0;
}
</style>
