<template>
  <el-config-provider :locale="currentLocale">
    <router-view />
    <ReDialog />
    <ReDrawer />
  </el-config-provider>
</template>

<script lang="ts">
import { ElConfigProvider } from "element-plus";
import { useRouter, useRoute } from "vue-router";
import { useGlobal, useWatermark } from "@pureadmin/utils";
import {
  defineComponent,
  computed,
  watch,
  nextTick,
  ref,
  onMounted,
  onBeforeUnmount
} from "vue";
import { useUserStoreHook } from "@/store/modules/user";
import {
  buildWatermarkText,
  formatWatermarkTime,
  isSiteWatermarkVisible
} from "@/utils/watermark";
import { ReDialog, closeAllDialog } from "@/components/ReDialog";
import { ReDrawer, closeAllDrawer } from "@/components/ReDrawer";
import en from "element-plus/es/locale/lang/en";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import plusEn from "plus-pro-components/es/locale/lang/en";
import plusZhCn from "plus-pro-components/es/locale/lang/zh-cn";
import { $t, transformI18n } from "@/plugins/i18n";

// wangeditor 附件插件注册已迁移至懒加载路径（src/utils/wangEditorBoot.ts），
// 由编辑器异步组件在挂载前调用，避免约 1MB 的编辑器栈进入首屏闭包。

export default defineComponent({
  name: "app",
  components: {
    // 组件名由 ElConfigProvider.name 动态给出（运行时必然为字符串）
    [ElConfigProvider.name as string]: ElConfigProvider,
    ReDialog,
    ReDrawer
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { setWatermark, clear } = useWatermark();
    const { $storage } = useGlobal<GlobalPropertiesApi>();
    const userStore = useUserStoreHook();
    // 设置面板的本地水印（每浏览器独立）
    const watermarkEnable = computed(() => $storage.configure?.watermark);
    const watermarkText = computed(() => $storage.configure?.watermarkText);
    // 站点水印（服务端基本设置下发）：仅「敏感页面」范围内生效
    const siteWatermark = computed(() => userStore.siteWatermark);
    const onLoginPage = computed(() => route.name === "Login");
    const siteWatermarkVisible = computed(() =>
      isSiteWatermarkVisible({
        enabled: !!siteWatermark.value?.enabled,
        paths: siteWatermark.value?.paths,
        path: route.path,
        onLoginPage: onLoginPage.value,
        // 菜单级开关（菜单管理 → 页面水印）置顶强制挂载
        menuWatermark: route.meta?.watermark === true
      })
    );
    const watermarkVisible = computed(
      () => siteWatermarkVisible.value || !!watermarkEnable.value
    );
    // 时间戳按分钟刷新（仅站点水印含时间；本地水印文案由用户自定义，原样使用）
    const watermarkTime = ref(formatWatermarkTime());
    let timer: number | undefined;
    const watermarkContent = computed(() =>
      siteWatermarkVisible.value
        ? buildWatermarkText({
            username: userStore.username,
            nickname: userStore.nickname,
            customText: siteWatermark.value?.text,
            time: watermarkTime.value
          })
        : watermarkText.value
    );
    const currentLocale = computed(() => {
      return $storage.locale?.locale === "zh"
        ? { ...zhCn, ...plusZhCn }
        : { ...en, ...plusEn };
    });
    router.beforeEach(() => {
      closeAllDialog();
      closeAllDrawer();
    });

    onMounted(() => {
      timer = window.setInterval(() => {
        if (siteWatermarkVisible.value)
          watermarkTime.value = formatWatermarkTime();
      }, 60_000);
    });
    onBeforeUnmount(() => {
      if (timer) window.clearInterval(timer);
    });

    watch(
      [watermarkVisible, watermarkContent, onLoginPage],
      async ([visible, text]) => {
        await nextTick();
        if (visible && !onLoginPage.value) {
          // 先清除再挂载：文案分钟级刷新时避免水印节点叠加
          clear();
          // 文案未配置时传空串，避免 canvas 绘制出 "undefined" 文本
          setWatermark(text ?? "", { verticalOffset: 170 });
        } else {
          clear();
        }
      },
      {
        immediate: true
      }
    );

    return {
      currentLocale
    };
  },
  beforeCreate() {
    const { version, name: title } = __APP_INFO__.pkg;
    const { VITE_PUBLIC_PATH, MODE } = import.meta.env;
    // https://github.com/guMcrey/version-rocket/blob/main/README.zh-CN.md#api
    if (MODE === "production") {
      // 版本实时更新检测，只作用于线上环境。
      // 懒加载：version-rocket 及其主题约占 130KB（rendered），不进入首屏闭包；
      // 检测本身是 5 分钟轮询的后台行为，延后到动态 chunk 加载完成即可。
      import("version-rocket")
        .then(({ checkVersion }) =>
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
              buttonText: transformI18n($t("layout.updateNow")),
              primaryColor: "#758bfd"
            }
          )
        )
        .catch(() => {
          // 版本检测不可用（资源/网络异常）不影响主流程，静默忽略
        });
    }
  }
});
</script>
