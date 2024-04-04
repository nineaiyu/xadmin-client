<template>
  <el-config-provider :locale="currentLocale">
    <router-view />
    <ReDialog />
  </el-config-provider>
</template>

<script lang="ts">
import { defineComponent, nextTick } from "vue";
import { checkVersion } from "version-rocket";
import { ElConfigProvider } from "element-plus";
import en from "element-plus/dist/locale/en.mjs";
import { ReDialog } from "@/components/ReDialog";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
import { $t, transformI18n } from "@/plugins/i18n";
import { useWatermark } from "@pureadmin/utils";
import { Boot } from "@wangeditor/editor";
import attachmentModule from "@wangeditor/plugin-upload-attachment";
import plusEn from "plus-pro-components/es/locale/lang/en";
import plusZhCn from "plus-pro-components/es/locale/lang/zh-cn";

Boot.registerModule(attachmentModule);
export default defineComponent({
  name: "app",
  components: {
    [ElConfigProvider.name]: ElConfigProvider,
    ReDialog
  },
  computed: {
    currentLocale() {
      return this.$storage.locale?.locale === "zh"
        ? { ...zhCn, ...plusZhCn }
        : { ...en, ...plusEn };
    }
  },
  mounted() {
    const { setWatermark } = useWatermark();
    nextTick(() => {
      setWatermark("xadmin", {
        globalAlpha: 0.1, // 值越低越透明
        gradient: [
          { value: 0, color: "magenta" },
          { value: 0.5, color: "blue" },
          { value: 1.0, color: "red" }
        ]
      });
    });
  },
  beforeCreate() {
    const { version, name: title } = __APP_INFO__.pkg;
    const { VITE_PUBLIC_PATH, MODE } = import.meta.env;
    // https://github.com/guMcrey/version-rocket/blob/main/README.zh-CN.md#api
    if (MODE === "production") {
      // 版本实时更新检测，只作用于线上环境
      checkVersion(
        // config
        {
          // 5分钟检测一次版本
          pollingTime: 300000,
          localPackageVersion: version,
          originVersionFileUrl: `${location.origin}${VITE_PUBLIC_PATH}version.json`
        },
        // options
        {
          title,
          description: transformI18n($t("layout.updateCheck")),
          buttonText: transformI18n($t("layout.updateNow"))
        }
      );
    }
  }
});
</script>
