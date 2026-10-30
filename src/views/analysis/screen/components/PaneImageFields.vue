<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { isValidPaneImageUrl } from "../utils/layout";

/**
 * 图片窗格的属性段（自 PaneInspector 拆分，行数门禁）。
 *
 * 地址行内校验口径见 utils/layout 的 isValidPaneImageUrl（http(s) 或根相对路径，
 * 空值 = 尚未配置不报错）；输入过程只提示不阻断，保存时服务端仍会再校验一次。
 */
defineOptions({ name: "ScreenPaneImageFields" });

const props = defineProps<{
  pane: ScreenLayoutPane;
}>();

const emit = defineEmits<{
  update: [patch: Partial<ScreenLayoutPane>];
}>();

const { t } = useI18n();

const imageUrlError = computed(() =>
  isValidPaneImageUrl(props.pane.url) ? "" : t("dataScreen.imageUrlInvalid")
);

const onImageFitChange = (fit: "cover" | "contain" | "fill") => {
  emit("update", { fit });
};
</script>

<template>
  <el-form-item
    :label="t('dataScreen.imageUrl')"
    required
    :error="imageUrlError"
  >
    <el-input
      :model-value="pane.url ?? ''"
      placeholder="https://"
      data-testid="inspector-image-url"
      @update:model-value="emit('update', { url: $event })"
    />
  </el-form-item>
  <el-form-item :label="t('dataScreen.imageFit')">
    <el-radio-group
      :model-value="pane.fit ?? 'cover'"
      data-testid="inspector-image-fit"
      @change="onImageFitChange($event as 'cover')"
    >
      <el-radio-button value="cover">
        {{ t("dataScreen.fitCover") }}
      </el-radio-button>
      <el-radio-button value="contain">
        {{ t("dataScreen.fitContain") }}
      </el-radio-button>
      <el-radio-button value="fill">
        {{ t("dataScreen.fitFill") }}
      </el-radio-button>
    </el-radio-group>
  </el-form-item>
</template>
