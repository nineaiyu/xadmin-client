<template>
  <el-config-provider :locale="currentLocale">
    <router-view />
    <ReDialog />
  </el-config-provider>
</template>

<script lang="ts">
import { defineComponent, nextTick } from "vue";
import { ElConfigProvider } from "element-plus";
import zhCn from "element-plus/lib/locale/lang/zh-cn";
import en from "element-plus/lib/locale/lang/en";
import { ReDialog } from "@/components/ReDialog";

import { useWatermark } from "@pureadmin/utils";
export default defineComponent({
  name: "app",
  components: {
    [ElConfigProvider.name]: ElConfigProvider,
    ReDialog
  },
  computed: {
    currentLocale() {
      return this.$storage.locale?.locale === "zh" ? zhCn : en;
    }
  },
  mounted() {
    const { setWatermark } = useWatermark();
    nextTick(() => {
      setWatermark("xadmin", {
        globalAlpha: 0.25, // 值越低越透明
        gradient: [
          { value: 0, color: "magenta" },
          { value: 0.5, color: "blue" },
          { value: 1.0, color: "red" }
        ]
      });
    });
  }
});
</script>
