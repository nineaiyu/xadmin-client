<template>
  <el-config-provider :locale="currentLocale">
    <router-view />
    <ReDialog />
    <ReDrawer />
  </el-config-provider>
</template>

<script lang="ts">
import { ElConfigProvider } from "element-plus/es/components/config-provider/index.mjs";
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
import { useWatermarkStoreHook } from "@/store/modules/watermark";
import {
  buildWatermarkRenderOptions,
  defaultSiteWatermark,
  formatWatermarkTime,
  isSiteWatermarkVisible,
  renderWatermarkText
} from "@/utils/watermark";
import { ReDialog } from "@/components/ReDialog";
import { ReDrawer } from "@/components/ReDrawer";
import en from "element-plus/es/locale/lang/en";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import plusEn from "plus-pro-components/es/locale/lang/en";
import plusZhCn from "plus-pro-components/es/locale/lang/zh-cn";
import { $t, transformI18n } from "@/plugins/i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { emitter } from "@/utils/mitt";
import { checkUpdatesEnabled } from "@/utils/autoUpdate";

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
    const confirm = useConfirm();
    const { setWatermark, clear } = useWatermark();
    const { $storage } = useGlobal<GlobalPropertiesApi>();
    const userStore = useUserStoreHook();
    // 站点水印（服务端「水印设置」下发，样式含字号/透明度/旋转角/颜色）
    const watermarkStore = useWatermarkStoreHook();
    const siteWatermark = computed(() => watermarkStore.siteWatermark);
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
    const watermarkVisible = computed(() => siteWatermarkVisible.value);
    // 时间戳按分钟刷新（文案末尾带时间，便于定位泄露时点）
    const watermarkTime = ref(formatWatermarkTime());
    let timer: number | undefined;
    const watermarkContent = computed(() =>
      renderWatermarkText(siteWatermark.value?.template ?? "", {
        username: userStore.username,
        nickname: userStore.nickname,
        phone: userStore.phone,
        email: userStore.email,
        pk: userStore.pk,
        time: watermarkTime.value
      })
    );
    const currentLocale = computed(() => {
      return $storage.locale?.locale === "zh"
        ? { ...zhCn, ...plusZhCn }
        : { ...en, ...plusEn };
    });
    // 路由切换关弹层已迁至 router/index.ts 的 beforeEach（与其它导航守卫集中管理）

    // 巡检处置联动：管理员要求改密时引导到个人配置页（每会话提示一次，改密即清除标记）
    let forcePasswordNotified = false;
    watch(
      () => userStore.mustChangePassword,
      value => {
        if (!value || forcePasswordNotified) return;
        if (route.path === "/settings/basic") return;
        forcePasswordNotified = true;
        confirm(transformI18n($t("forcePassword.tip")), {
          title: transformI18n($t("forcePassword.title")),
          confirmButtonText: transformI18n($t("forcePassword.submit")),
          cancelButtonText: transformI18n($t("forcePassword.later"))
        }).then(ok => {
          if (ok) router.push("/settings/basic");
        });
      },
      { immediate: true }
    );

    onMounted(() => {
      timer = window.setInterval(() => {
        if (siteWatermarkVisible.value)
          watermarkTime.value = formatWatermarkTime();
      }, 60_000);
    });

    /**
     * 版本实时更新检测（仅线上环境 + 「自动检查更新」开关开启）：轮询部署端
     * version.json，发现新版本时弹刷新提示。
     *
     * 懒加载：version-rocket 及其主题约占 130KB（rendered），不进入首屏闭包；
     * 开关在设置面板（「关于」页签）切换时经全局事件实时启停轮询。
     */
    const VERSION_CHECK_POLLING_MS = 300_000;
    const { version: appVersion, name: appTitle } = __APP_INFO__.pkg;
    const { VITE_PUBLIC_PATH, MODE } = import.meta.env;

    function startVersionCheck() {
      // chartTheme 仅此处用到：随版本检查按需加载，不进首屏闭包
      Promise.all([import("version-rocket"), import("@/utils/chartTheme")])
        .then(([{ checkVersion }, { epColor }]) =>
          checkVersion(
            // config
            {
              pollingTime: VERSION_CHECK_POLLING_MS,
              localPackageVersion: appVersion,
              originVersionFileUrl: `${location.origin}${VITE_PUBLIC_PATH}version.json`
            },
            // options
            {
              title: appTitle,
              description: transformI18n($t("layout.updateCheck")),
              buttonText: transformI18n($t("layout.updateNow")),
              primaryColor: epColor("primary")
            }
          )
        )
        .catch(() => {
          // 版本检测不可用（资源/网络异常）不影响主流程，静默忽略
        });
    }

    function stopVersionCheck() {
      import("version-rocket")
        .then(({ unCheckVersion }) =>
          unCheckVersion({ closeDialog: true, closeWorker: true })
        )
        .catch(() => undefined);
    }

    function applyCheckUpdates(enabled: boolean) {
      if (enabled) startVersionCheck();
      else stopVersionCheck();
    }

    if (MODE === "production" && checkUpdatesEnabled()) {
      startVersionCheck();
    }
    emitter.on("checkUpdatesChange", applyCheckUpdates);

    onBeforeUnmount(() => {
      if (timer) window.clearInterval(timer);
      emitter.off("checkUpdatesChange", applyCheckUpdates);
    });

    // 渲染样式随站点配置（字号/透明度/旋转角）；样式变化同样触发重挂载
    const watermarkOptions = computed(() =>
      buildWatermarkRenderOptions(siteWatermark.value ?? defaultSiteWatermark)
    );
    watch(
      [watermarkVisible, watermarkContent, watermarkOptions, onLoginPage],
      async ([visible]) => {
        await nextTick();
        if (visible && !onLoginPage.value) {
          // 先清除再挂载：文案/样式刷新时避免水印节点叠加
          clear();
          setWatermark(watermarkContent.value, watermarkOptions.value);
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
  }
});
</script>
