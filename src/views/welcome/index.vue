<script lang="ts" setup>
import { markRaw, ref } from "vue";
import ReCol from "@/components/ReCol";
import { randomGradient, useDark } from "@pureadmin/utils";
import { ReNormalCountTo } from "@/components/ReCountTo";
import { useRenderFlicker } from "@/components/ReFlicker";
import { ChartBar, ChartLine, ChartRound, ChartClock } from "./components";
import Segmented from "@/components/ReSegmented";
import { useDashboard } from "@/views/welcome/hook";
import dayjs from "dayjs";

defineOptions({
  name: "Welcome"
});

const { isDark } = useDark();
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
        class="mb-[18px]"
      >
        <el-card class="line-card" shadow="never">
          <div class="flex justify-between">
            <span class="text-md font-medium">
              {{ item.name }}
            </span>
            <div
              :style="{
                backgroundColor: isDark ? 'transparent' : item.bgColor
              }"
              class="w-8 h-8 flex justify-center items-center rounded-md"
            >
              <IconifyIconOffline
                :color="item.color"
                :icon="item.icon"
                width="18"
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
              <p class="font-medium text-green-500">{{ item.percent }}</p>
            </div>
            <ChartLine
              v-if="item.data.length > 1"
              :color="item.color"
              :data="item.data"
              class="!w-1/2"
            />
            <ChartRound v-else class="!w-1/2" />
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
        class="mb-[18px]"
      >
        <el-card
          :body-style="{ padding: '0' }"
          class="line-card"
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
        class="mb-[18px]"
      >
        <el-card class="line-card" shadow="never">
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
              <p class="text-sm font-thin text-green-500">
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
              <p class="text-sm font-thin text-violet-500">
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
        class="mb-[18px]"
      >
        <el-card class="bar-card" shadow="never">
          <div class="flex justify-between">
            <span class="text-md font-medium">{{
              t("welcome.userAnalysis")
            }}</span>
            <Segmented v-model="curWeek" :options="optionsBasis" />
          </div>
          <div class="flex justify-between items-start mt-3">
            <ChartBar
              :showData="curWeek ? userLoginList : userRegisterList"
              :title="optionsBasis[curWeek].label"
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
        class="mb-[18px]"
      >
        <el-card shadow="never">
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
                :icon="
                  markRaw(
                    useRenderFlicker({
                      background: randomGradient({
                        randomizeHue: true
                      })
                    })
                  )
                "
                :timestamp="
                  dayjs(item.created_time).format('YYYY-MM-DD HH:mm:ss')
                "
                center
                placement="top"
              >
                <p class="text-text_color_regular text-sm">
                  {{
                    `${item?.creator?.username} ${item.method} ${item.module} ${item.system} ${item?.browser}`
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
  --el-card-border-color: none;

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
  margin: 20px 20px 0 !important;
}
</style>
