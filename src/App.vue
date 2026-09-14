<template>
  <el-config-provider :locale="currentLocale">
    <router-view />
    <ReDialog />
    <ReDrawer />
  </el-config-provider>
</template>

<script lang="ts">
import { checkVersion } from "version-rocket";
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
  isWatermarkPath
} from "@/utils/watermark";
import { ReDialog, closeAllDialog } from "@/components/ReDialog";
import { ReDrawer, closeAllDrawer } from "@/components/ReDrawer";
import en from "element-plus/es/locale/lang/en";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import plusEn from "plus-pro-components/es/locale/lang/en";
import plusZhCn from "plus-pro-components/es/locale/lang/zh-cn";
import { Boot, type IModuleConf } from "@wangeditor/editor";
import attachmentModuleExport from "@wangeditor/plugin-upload-attachment";
import { $t, transformI18n } from "@/plugins/i18n";

/**
 * 附件菜单插件（uploadAttachment / downloadAttachment）的兼容解包。
 *
 * 该插件是 webpack 产出的 UMD 包，CJS 导出为 `{ __esModule: true, default: module }`：
 * - Vite 5（esbuild 预打包）会按 __esModule 解包，默认导入即真模块；
 * - Vite 8（rolldown 预打包）不再解包，默认导入拿到 `{ default: module }` 外壳，
 *   传给 Boot.registerModule 会因读不到 menus 而静默跳过注册（不抛错、难排查），
 *   编辑器工具栏随后抛 "Not found menu item factory by key 'uploadAttachment'"，
 *   表现为通知公告等富文本表单的创建页报错。
 * 这里按「取含 menus 的那一层」解包，两种打包行为都可用。
 */
const attachmentModule = ((): Partial<IModuleConf> => {
  const raw = attachmentModuleExport as unknown as {
    menus?: unknown;
    default?: Partial<IModuleConf>;
  };
  if (raw?.menus) return raw as Partial<IModuleConf>;
  return raw?.default ?? (raw as Partial<IModuleConf>);
})();

// 注册。要在创建编辑器之前注册，且只能注册一次，不可重复注册（HMR 重入时静默跳过）。
try {
  Boot.registerModule(attachmentModule);
} catch (e) {
  console.log(e);
}

export default defineComponent({
  name: "app",
  components: {
    [ElConfigProvider.name]: ElConfigProvider,
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
    const siteWatermarkVisible = computed(
      () =>
        !!siteWatermark.value?.enabled &&
        !onLoginPage.value &&
        isWatermarkPath(route.path, siteWatermark.value?.paths)
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
          setWatermark(text, { verticalOffset: 170 });
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
          buttonText: transformI18n($t("layout.updateNow")),
          primaryColor: "#758bfd"
        }
      );
    }
  }
});
</script>
