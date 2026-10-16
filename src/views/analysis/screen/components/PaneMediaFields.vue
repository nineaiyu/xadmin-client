<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { isValidPaneEmbedUrl, isValidPaneImageUrl } from "../utils/layout";

defineOptions({ name: "ScreenPaneMediaFields" });

/**
 * 视频 / 自定义 HTML 窗格的属性字段（ADR-090 D3，拆分动机：属性面板行数门禁）。
 *
 * 地址口径与服务端一致：视频与图片同口径（http(s) 或站内根相对路径），
 * **自定义 HTML 只收 http(s) 绝对地址**（iframe src，不接受原样 HTML）；输入过程只提示，
 * 保存时服务端仍会再校验一次。
 */
const props = defineProps<{ pane: ScreenLayoutPane }>();

const emit = defineEmits<{ update: [patch: Partial<ScreenLayoutPane>] }>();

const { t } = useI18n();

const isVideo = computed(() => props.pane.type === "video");
const isHtml = computed(() => props.pane.type === "html");

const urlError = computed(() => {
  const url = props.pane.url;
  if (isHtml.value) {
    return isValidPaneEmbedUrl(url) ? "" : t("dataScreen.embedUrlInvalid");
  }
  return isValidPaneImageUrl(url) ? "" : t("dataScreen.imageUrlInvalid");
});
const posterError = computed(() =>
  isValidPaneImageUrl(props.pane.poster) ? "" : t("dataScreen.imageUrlInvalid")
);

/** 布尔开关缺省视为 true（静音 / 循环 / 自动播放），只有显式关掉才下发 */
const flag = (key: "muted" | "loop" | "autoplay") =>
  computed({
    get: () => props.pane[key] !== false,
    set: (value: boolean) => emit("update", { [key]: value })
  });
const muted = flag("muted");
const loop = flag("loop");
const autoplay = flag("autoplay");
</script>

<template>
  <el-form-item :label="t('dataScreen.paneUrl')" required>
    <el-input
      :model-value="pane.url ?? ''"
      :placeholder="t('dataScreen.urlPlaceholder')"
      data-testid="inspector-media-url"
      @update:model-value="emit('update', { url: $event })"
    />
    <div v-if="urlError" class="pane-media__error">{{ urlError }}</div>
  </el-form-item>

  <template v-if="isVideo">
    <el-form-item :label="t('dataScreen.panePoster')">
      <el-input
        :model-value="pane.poster ?? ''"
        :placeholder="t('dataScreen.urlPlaceholder')"
        data-testid="inspector-video-poster"
        @update:model-value="emit('update', { poster: $event })"
      />
      <div v-if="pane.poster && posterError" class="pane-media__error">
        {{ posterError }}
      </div>
    </el-form-item>
    <el-form-item :label="t('dataScreen.imageFit')">
      <el-radio-group
        :model-value="pane.fit ?? 'cover'"
        data-testid="inspector-video-fit"
        @change="emit('update', { fit: $event as 'cover' })"
      >
        <el-radio-button value="cover">
          {{ t("dataScreen.fitCover") }}
        </el-radio-button>
        <el-radio-button value="contain">
          {{ t("dataScreen.fitContain") }}
        </el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('dataScreen.videoMuted')">
      <el-switch v-model="muted" data-testid="inspector-video-muted" />
    </el-form-item>
    <el-form-item :label="t('dataScreen.videoLoop')">
      <el-switch v-model="loop" data-testid="inspector-video-loop" />
    </el-form-item>
    <el-form-item :label="t('dataScreen.videoAutoplay')">
      <el-switch v-model="autoplay" data-testid="inspector-video-autoplay" />
    </el-form-item>
    <div class="pane-media__hint">{{ t("dataScreen.videoHint") }}</div>
  </template>

  <div v-if="isHtml" class="pane-media__hint">
    {{ t("dataScreen.embedHint") }}
  </div>
</template>

<style lang="scss" scoped>
.pane-media__error {
  margin-top: var(--space-1);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-color-danger);
}

.pane-media__hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: var(--screen-fg-dim);
}
</style>
