<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import ReIconPicker from "@/components/ReIconPicker";
import ReAnimateSelector from "@/components/ReAnimateSelector";
import ReImageVerify from "@/components/ReImageVerify";
import ReSliderCaptcha from "@/components/ReSliderCaptcha";

/** 输入类组件活样例 + props 速查（全部为纯前端自包含组件，无业务 API 依赖） */
defineOptions({ name: "PlaygroundInput" });

const { t } = useI18n();

const iconValue = ref("ep/edit");
const animateValue = ref("");
const verifyPassed = ref(false);
// ReImageVerify 的 v-model 是验证码串（parent 拿输入值与其比对），不是布尔
const imageCode = ref("");
</script>

<template>
  <div class="p-4">
    <el-row :gutter="12">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReIconPicker</span>
            <code class="ml-2 text-xs text-fg-muted"
              >v-model: string（离线图标名，见 offlineIcon.ts）</code
            >
          </template>
          <ReIconPicker v-model="iconValue" />
          <p class="mt-2 text-xs text-fg-muted">v-model = {{ iconValue }}</p>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReAnimateSelector</span>
            <code class="ml-2 text-xs text-fg-muted"
              >v-model: string（animate.css 类名）· placeholder?</code
            >
          </template>
          <ReAnimateSelector v-model="animateValue" />
          <p class="mt-2 text-xs text-fg-muted">
            v-model = {{ animateValue || "-" }}
          </p>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReImageVerify</span>
            <code class="ml-2 text-xs text-fg-muted"
              >v-model: 当前验证码串（parent 拿输入值与其比对）· expose:
              getImgCode()</code
            >
          </template>
          <div class="w-60">
            <ReImageVerify v-model="imageCode" />
          </div>
          <p class="mt-2 text-xs text-fg-muted">
            v-model = {{ imageCode || "-" }}
          </p>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReSliderCaptcha</span>
            <code class="ml-2 text-xs text-fg-muted"
              >v-model: 是否通过 · @success / @failed / @restore（键盘 +
              触屏可达）</code
            >
          </template>
          <div class="w-90 max-w-full">
            <ReSliderCaptcha v-model="verifyPassed" />
          </div>
          <p class="mt-2 text-xs text-fg-muted">
            {{ t("playground.verifyState") }}: {{ verifyPassed }}
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
