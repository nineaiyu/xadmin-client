import { getPluginsList } from "./build/plugins";
import { exclude, include } from "./build/optimize";
import { type ConfigEnv, loadEnv, type UserConfigExport } from "vite";
import {
  __APP_INFO__,
  alias,
  pathResolve,
  root,
  wrapperEnv,
  createProxyConfig
} from "./build/utils";

export default ({ mode }: ConfigEnv): UserConfigExport => {
  const { VITE_CDN, VITE_PORT, VITE_COMPRESSION, VITE_PUBLIC_PATH } =
    wrapperEnv(loadEnv(mode, root));
  return {
    base: VITE_PUBLIC_PATH,
    root,
    resolve: {
      alias
    },
    // 服务端渲染
    server: {
      // 端口号
      port: VITE_PORT,
      host: "0.0.0.0",
      // 本地跨域代理 https://cn.vitejs.dev/config/server-options.html#server-proxy
      proxy: createProxyConfig({
        "http://127.0.0.1:8896": ["/api", "/media", "/api-docs"],
        "ws://127.0.0.1:8896": ["/ws"]
      }),
      // 预热文件以提前转换和缓存结果，降低启动期间的初始页面加载时长并防止转换瀑布
      warmup: {
        clientFiles: ["./index.html", "./src/{views,components}/*"]
      }
    },
    plugins: getPluginsList(VITE_CDN, VITE_COMPRESSION),
    // https://cn.vitejs.dev/config/dep-optimization-options.html#dep-optimization-options
    optimizeDeps: {
      include,
      exclude
    },
    build: {
      // https://cn.vitejs.dev/guide/build.html#browser-compatibility
      target: "es2015",
      sourcemap: false,
      // 消除打包大小超过500kb警告
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        input: {
          index: pathResolve("./index.html", import.meta.url)
        },
        // 静态资源分类打包
        output: {
          chunkFileNames: "static/js/[name]-[hash].js",
          entryFileNames: "static/js/[name]-[hash].js",
          assetFileNames: "static/[ext]/[name]-[hash].[ext]"
        }
      }
    },
    define: {
      __INTLIFY_PROD_DEVTOOLS__: false,
      __APP_INFO__: JSON.stringify(__APP_INFO__)
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler"
        }
      }
    }
  };
};
