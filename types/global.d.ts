import type { ECharts, graphic } from "echarts";
import type { TableColumns } from "@pureadmin/table";

/**
 * 全局类型声明，无需引入直接在 `.vue` 、`.ts` 、`.tsx` 文件使用即可获得类型提示
 */
declare global {
  /**
   * 平台的名称、版本、运行所需的`node`和`pnpm`版本、依赖、最后构建时间的类型提示
   */
  const __APP_INFO__: {
    pkg: {
      name: string;
      version: string;
      engines: {
        node: string;
        pnpm: string;
      };
      dependencies: Recordable<string>;
      devDependencies: Recordable<string>;
    };
    lastBuildTime: string;
  };

  /**
   * Window 的类型提示
   */
  interface Window {
    // Global vue app instance
    __APP__: App<Element>;
    webkitCancelAnimationFrame: (handle: number) => void;
    mozCancelAnimationFrame: (handle: number) => void;
    oCancelAnimationFrame: (handle: number) => void;
    msCancelAnimationFrame: (handle: number) => void;
    webkitRequestAnimationFrame: (callback: FrameRequestCallback) => number;
    mozRequestAnimationFrame: (callback: FrameRequestCallback) => number;
    oRequestAnimationFrame: (callback: FrameRequestCallback) => number;
    msRequestAnimationFrame: (callback: FrameRequestCallback) => number;
  }

  /**
   * Document 的类型提示
   */
  interface Document {
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
  }

  /**
   * 打包压缩格式的类型声明
   */
  type ViteCompression =
    | "none"
    | "gzip"
    | "brotli"
    | "both"
    | "gzip-clear"
    | "brotli-clear"
    | "both-clear";

  /**
   * 全局自定义环境变量的类型声明
   * @see {@link https://pure-admin.github.io/pure-admin-doc/pages/config/#%E5%85%B7%E4%BD%93%E9%85%8D%E7%BD%AE}
   */
  interface ViteEnv {
    VITE_PORT: number;
    VITE_PUBLIC_PATH: string;
    VITE_ROUTER_HISTORY: string;
    VITE_CDN: boolean;
    VITE_HIDE_HOME: string;
    VITE_COMPRESSION: ViteCompression;
    /** 生产构建认证 Cookie 的 Secure 开关：默认开启；内网 HTTP 测试服构建时置 false */
    VITE_COOKIE_SECURE: string;
  }

  /**
   *  继承 `@pureadmin/table` 的 `TableColumns` ，方便全局直接调用
   */
  type TableColumnList = Array<TableColumns>;
  /** 圆角档位（设置面板 →「圆角」）：除 default 外均按比例缩放 --radius-* 令牌 */
  type RadiusScaleType = "none" | "small" | "default" | "large" | "xlarge";
  /** 字号档位（设置面板 →「字号」）：只缩放文字令牌，根字号保持 16px；custom 档读 fontScaleCustom */
  type FontScaleType = "small" | "default" | "large" | "custom";
  /** 页面切换动画预设（none 为直接切换）；与 style/transition.scss 的类名前缀一致 */
  type PageTransitionType =
    | "none"
    | "fade-transform"
    | "fade-slide"
    | "fade-up"
    | "fade-down"
    | "fade-scale";
  /**
   * 对应 `public/platform-config.json` 文件的类型声明
   * @see {@link https://pure-admin.github.io/pure-admin-doc/pages/config/#platform-config-json}
   */
  interface PlatformConfigs {
    Version?: string;
    Title?: string;
    FixedHeader?: boolean;
    HiddenSideBar?: boolean;
    MultiTagsCache?: boolean;
    MaxTagsLevel?: number;
    KeepAlive?: boolean;
    Locale?: string;
    Layout?: string;
    Theme?: string;
    /** 手点主题色（预设名或 custom）；缺省回落到 Theme（皮肤名），两者可分离 */
    ThemeColor?: string;
    DarkMode?: boolean;
    ThemeMode?: string;
    Grey?: boolean;
    Weak?: boolean;
    HideTabs?: boolean;
    HideFooter?: boolean;
    Stretch?: boolean | number;
    SidebarStatus?: boolean;
    EpThemeColor?: string;
    ShowLogo?: boolean;
    TagsStyle?: string;
    /** 顶栏滚动自动隐藏（下滑隐藏 / 上滑显示） */
    HeaderAutoHide?: boolean;
    /** 内容区紧凑模式（收紧留白并居中限宽） */
    CompactMode?: boolean;
    /** 圆角档位（none / small / default / large / xlarge）：缩放 --radius-* 令牌 */
    Radius?: RadiusScaleType;
    /** 字号档位（small / default / large / custom）：缩放 --font-size-* 令牌，根字号不随之变化 */
    FontScale?: FontScaleType;
    /** 自定义字号的基准字号（px，12~20）：仅 FontScale=custom 时生效 */
    FontScaleCustom?: number;
    /** 侧栏手风琴：同级菜单只展开一项 */
    SidebarAccordion?: boolean;
    /** 侧栏底部折叠按钮显隐 */
    SidebarCollapseButton?: boolean;
    /** 半暗侧栏：浅色外观下侧栏保持深色调色板 */
    SemiDarkSidebar?: boolean;
    /** 浅色外观下顶栏用深色调色板 */
    SemiDarkHeader?: boolean;
    /** 侧栏宽度（px，160~320）；折叠宽度与 hover 弹出菜单不随此值变化 */
    SidebarWidth?: number;
    /** 折叠态悬停临时展开（仅视觉层，不写回存储） */
    SidebarExpandOnHover?: boolean;
    /** 侧栏右缘拖拽调宽把手 */
    SidebarDraggable?: boolean;
    /** 折叠态侧栏显示菜单标题（图标在上、标题在下，仅垂直布局） */
    SidebarCollapsedShowTitle?: boolean;
    /** 点击顶层父级菜单展开时自动激活并跳转第一个子菜单 */
    SidebarAutoActivateChild?: boolean;
    /** 固定顶栏：关闭后顶栏随页面一起滚动 */
    HeaderFixed?: boolean;
    /** 显示面包屑（顶栏左侧路径导航） */
    BreadcrumbVisible?: boolean;
    /** 面包屑细分：显示图标 / 显示首页项 / 仅一项时隐藏 / 样式（normal|background） */
    BreadcrumbShowIcon?: boolean;
    BreadcrumbShowHome?: boolean;
    BreadcrumbHideOnlyOne?: boolean;
    BreadcrumbStyle?: "normal" | "background";
    /** 页签最大数量（0 = 不限制，超出后自动关闭最旧的非固定页签） */
    MaxTagsCount?: number;
    /** 顶栏组件显隐：菜单搜索 / 语言切换 / 全屏 / 锁屏 / 消息通知 */
    NavbarSearch?: boolean;
    NavbarLanguage?: boolean;
    NavbarFullscreen?: boolean;
    NavbarLock?: boolean;
    NavbarNotice?: boolean;
    /** 顶栏补充按钮：刷新当前页 / 折叠侧栏 / 明暗切换 */
    NavbarRefresh?: boolean;
    NavbarSidebarToggle?: boolean;
    NavbarThemeToggle?: boolean;
    /** 页签中键关闭 */
    TagsMiddleClickClose?: boolean;
    /** 滚轮横向滚动页签条 */
    TagsWheelSwitch?: boolean;
    /** 页签条：显示页签图标 / 刷新按钮 / 更多按钮 */
    TagsShowIcon?: boolean;
    TagsShowRefresh?: boolean;
    TagsShowMore?: boolean;
    /** 动态标题：document.title 随路由变化 */
    DynamicTitle?: boolean;
    /** 设置入口总开关；入口位置：header（顶栏齿轮）| fixed（右下角悬浮球） */
    EnablePreferences?: boolean;
    PreferencesPosition?: "header" | "fixed";
    /** 全局页面切换动画预设（none 表示不做过渡） */
    PageTransition?: PageTransitionType;
    /** 路由切换：顶部进度条 / 内容区 loading 遮罩 */
    TransitionProgress?: boolean;
    TransitionLoading?: boolean;
    /** ⌘/Ctrl + K 唤起命令面板 */
    ShortcutSearch?: boolean;
    ShortcutLock?: boolean;
    ShortcutSidebar?: boolean;
    /** 快捷键总开关：关闭后键位自定义全部失效（顶栏按钮不受影响） */
    ShortcutEnable?: boolean;
    /** 键位串：小写 `mod+alt+shift+<key>`，空串 = 不启用该动作 */
    ShortcutLockKeys?: string;
    ShortcutSidebarKeys?: string;
    ShortcutSearchKeys?: string;
    ShortcutPreferencesKeys?: string;
    ShortcutLogoutKeys?: string;
    MenuArrowIconNoTransition?: boolean;
    CachingAsyncRoutes?: boolean;
    TooltipEffect?: Effect;
    ResponsiveStorageNameSpace?: string;
    MenuSearchHistory?: number;
    /** 可拖拽分栏页面的左栏宽度百分比：{页面标识: percent}，前端整包读写 */
    SplitPanes?: Record<string, number>;
  }

  /**
   * 与 `PlatformConfigs` 类型不同，这里是缓存到浏览器本地存储的类型声明
   * @see {@link https://pure-admin.github.io/pure-admin-doc/pages/config/#platform-config-json}
   */
  interface StorageConfigs {
    version?: string;
    title?: string;
    fixedHeader?: boolean;
    hiddenSideBar?: boolean;
    multiTagsCache?: boolean;
    keepAlive?: boolean;
    locale?: string;
    layout?: string;
    theme?: string;
    darkMode?: boolean;
    grey?: boolean;
    weak?: boolean;
    hideTabs?: boolean;
    hideFooter?: boolean;
    sidebarStatus?: boolean;
    epThemeColor?: string;
    themeColor?: string;
    themeMode?: string;
    showLogo?: boolean;
    tagsStyle?: string;
    menuSearchHistory?: number;
    username?: string;
  }

  /**
   * `responsive-storage` 本地响应式 `storage` 的类型声明
   */
  interface ResponsiveStorage {
    locale: {
      locale?: string;
    };
    layout: {
      layout?: string;
      theme?: string;
      darkMode?: boolean;
      sidebarStatus?: boolean;
      epThemeColor?: string;
      themeColor?: string;
      themeMode?: string;
    };
    configure: {
      grey?: boolean;
      weak?: boolean;
      hideTabs?: boolean;
      hideFooter?: boolean;
      showLogo?: boolean;
      tagsStyle?: string;
      multiTagsCache?: boolean;
      stretch?: boolean | number;
      headerAutoHide?: boolean;
      compactMode?: boolean;
      radius?: RadiusScaleType;
      fontScale?: FontScaleType;
      /** 自定义字号基准（px）：fontScale=custom 时写入 --font-scale 倍率 */
      fontScaleCustom?: number;
      sidebarAccordion?: boolean;
      sidebarCollapseButton?: boolean;
      /** 半暗侧栏（`html.semi-dark-sidebar`，暗色外观下自动失效） */
      semiDarkSidebar?: boolean;
      semiDarkHeader?: boolean;
      /** 侧栏宽度（px）：由 JS 写入 `--sidebar-width`，默认档撤除内联覆写 */
      sidebarWidth?: number;
      /** 折叠态悬停临时展开 / 侧栏拖拽调宽 */
      sidebarExpandOnHover?: boolean;
      sidebarDraggable?: boolean;
      /** 折叠态侧栏显示菜单标题 / 点击顶层父级展开时自动激活第一个子菜单 */
      sidebarCollapsedShowTitle?: boolean;
      sidebarAutoActivateChild?: boolean;
      /** 固定顶栏：关闭后走非固定头布局（顶栏随内容滚动） */
      headerFixed?: boolean;
      /** 显示面包屑 */
      breadcrumbVisible?: boolean;
      /** 面包屑细分：显示图标 / 显示首页项 / 仅一项时隐藏 / 样式 */
      breadcrumbShowIcon?: boolean;
      breadcrumbShowHome?: boolean;
      breadcrumbHideOnlyOne?: boolean;
      breadcrumbStyle?: "normal" | "background";
      /** 页签最大数量（0 = 不限制） */
      maxTagsCount?: number;
      /** 顶栏组件显隐 */
      navbarSearch?: boolean;
      navbarLanguage?: boolean;
      navbarFullscreen?: boolean;
      navbarLock?: boolean;
      navbarNotice?: boolean;
      navbarRefresh?: boolean;
      navbarSidebarToggle?: boolean;
      navbarThemeToggle?: boolean;
      tagsMiddleClickClose?: boolean;
      tagsWheelSwitch?: boolean;
      tagsShowIcon?: boolean;
      tagsShowRefresh?: boolean;
      tagsShowMore?: boolean;
      dynamicTitle?: boolean;
      enablePreferences?: boolean;
      preferencesPosition?: "header" | "fixed";
      pageTransition?: PageTransitionType;
      transitionProgress?: boolean;
      transitionLoading?: boolean;
      shortcutSearch?: boolean;
      shortcutLock?: boolean;
      shortcutSidebar?: boolean;
      shortcutEnable?: boolean;
      shortcutLockKeys?: string;
      shortcutSidebarKeys?: string;
      shortcutSearchKeys?: string;
      shortcutPreferencesKeys?: string;
      shortcutLogoutKeys?: string;
    };
    tags?: Array<Recordable>;
    /** 右键「固定」的标签（fullPath 列表） */
    pinnedTags?: string[];
  }

  /**
   * 扩展 `echarts`
   */

  interface EChartsType extends ECharts {
    graphic: graphic;
  }

  /**
   * 平台里所有组件实例都能访问到的全局属性对象的类型声明
   */
  interface GlobalPropertiesApi {
    $echarts: EChartsType;
    $storage: ResponsiveStorage;
    $config: PlatformConfigs;
  }

  /**
   * 扩展 `Element`
   */
  interface Element {
    // v-ripple 作用于 src/directives/ripple/index.ts 文件
    _ripple?: {
      enabled?: boolean;
      centered?: boolean;
      class?: string;
      circle?: boolean;
      touched?: boolean;
    };
  }
}
