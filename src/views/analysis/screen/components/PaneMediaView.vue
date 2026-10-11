<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";

defineOptions({ name: "ScreenPaneMediaView" });

/**
 * 媒体类窗格内容（图片 / 视频 / 自定义 HTML，ADR-090 D3；拆分动机：窗格组件行数门禁）。
 *
 * 口径三条：
 * - 图片与视频地址由服务端与属性面板共同校验（http(s) 或站内根相对路径），这里只渲染；
 * - 视频「静音 + 循环 + 自动播放」是投屏常态，编辑态给 `controls` 便于试播且**不自动播**
 *   （否则拖拽/吸附时画面乱动）；
 * - 自定义 HTML 只渲染 http(s) 的 iframe，`sandbox` 固定收紧；**编辑态禁用指针事件**，
 *   保证点选与拖拽落在外层窗格上（投屏态恢复交互）。
 */
defineProps<{
  pane: ScreenLayoutPane;
  /** 设计态（显示 controls / 锁定 iframe 指针事件） */
  editable?: boolean;
  /** 展示态（投屏或预览）：视频自动播放与 iframe 交互在此态生效 */
  playAnimation?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <template v-if="pane.type === 'image'">
    <img
      v-if="pane.url"
      class="screen-pane__image"
      :src="pane.url"
      :style="{ objectFit: pane.fit ?? 'cover' }"
      alt=""
      data-testid="pane-image"
    />
    <div v-else class="screen-pane__empty" data-testid="pane-image-missing">
      {{ t("dataScreen.imageMissing") }}
    </div>
  </template>

  <template v-else-if="pane.type === 'video'">
    <video
      v-if="pane.url"
      class="screen-pane__video"
      :src="pane.url"
      :poster="pane.poster || undefined"
      :muted="pane.muted !== false"
      :loop="pane.loop !== false"
      :autoplay="playAnimation && pane.autoplay !== false"
      :controls="editable"
      :style="{ objectFit: pane.fit === 'contain' ? 'contain' : 'cover' }"
      playsinline
      data-testid="pane-video"
    />
    <div v-else class="screen-pane__empty" data-testid="pane-video-missing">
      {{ t("dataScreen.videoMissing") }}
    </div>
  </template>

  <template v-else-if="pane.type === 'html'">
    <iframe
      v-if="pane.url"
      class="screen-pane__iframe"
      :class="{ 'is-locked': editable }"
      :src="pane.url"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      referrerpolicy="no-referrer"
      loading="lazy"
      allowfullscreen
      data-testid="pane-html"
    />
    <div v-else class="screen-pane__empty" data-testid="pane-html-missing">
      {{ t("dataScreen.embedMissing") }}
    </div>
  </template>
</template>

<style lang="scss" scoped>
.screen-pane__video {
  width: 100%;
  height: 100%;
  background: #000;
}

.screen-pane__iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

/* 编辑态：iframe 不吃指针事件（否则点选 / 拖拽全被内嵌页面接走） */
.screen-pane__iframe.is-locked {
  pointer-events: none;
}
</style>
