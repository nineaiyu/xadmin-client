// @ts-check

/** @type {import("stylelint").Config} */
export default {
  extends: [
    "stylelint-config-standard",
    "stylelint-config-html/vue",
    "stylelint-config-recess-order"
  ],
  plugins: ["stylelint-scss", "stylelint-order", "stylelint-prettier"],
  overrides: [
    {
      files: ["**/*.(css|html|vue)"],
      customSyntax: "postcss-html"
    },
    {
      files: ["*.scss", "**/*.scss"],
      customSyntax: "postcss-scss",
      extends: [
        "stylelint-config-standard-scss",
        "stylelint-config-recommended-vue/scss"
      ]
    },
    {
      // T2 存量豁免：下列文件在「禁止新增 !important」门禁落地前已含 !important，
      // 逐个甄别依赖视觉回归门禁（当前没有），因此只冻结存量、不强制清零，
      // 随页面迭代用 EP 变量/降特异性替代；新文件不得进入本清单。
      files: [
        "**/assets/iconfont/iconfont.css",
        "**/views/account/index.vue",
        "**/views/about/index.vue",
        "**/components/RePlusPage/src/components/UploadFile.vue",
        "**/components/RePlusPage/src/components/UploadFiles.vue",
        "**/components/RePlusPage/src/components/TagInput.vue",
        "**/components/ReAnimateSelector/src/index.vue",
        "**/style/sidebar.scss",
        "**/style/element-plus.scss",
        "**/style/transition.scss",
        "**/style/dark.scss",
        "**/layout/components/lay-content/index.vue",
        "**/layout/components/lay-tag/index.scss"
      ],
      rules: {
        "declaration-no-important": null
      }
    }
  ],
  rules: {
    "prettier/prettier": true,
    "selector-class-pattern": null,
    "no-descending-specificity": null,
    // T2 治理：禁止新增 !important（存量 13 个文件在下方 overrides 中豁免；
    // 替代手段：EP CSS 变量 / 提高选择器特异性 / :where() 降特异性）
    "declaration-no-important": true,
    "scss/dollar-variable-pattern": null,
    "selector-pseudo-class-no-unknown": [
      true,
      {
        ignorePseudoClasses: ["deep", "global"]
      }
    ],
    "selector-pseudo-element-no-unknown": [
      true,
      {
        ignorePseudoElements: ["v-deep", "v-global", "v-slotted"]
      }
    ],
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "tailwind",
          "apply",
          "variants",
          "responsive",
          "screen",
          "function",
          "if",
          "each",
          "include",
          "mixin",
          "use"
        ]
      }
    ],
    "rule-empty-line-before": [
      "always",
      {
        ignore: ["after-comment", "first-nested"]
      }
    ],
    "unit-no-unknown": [true, { ignoreUnits: ["rpx"] }],
    "order/order": [
      [
        "dollar-variables",
        "custom-properties",
        "at-rules",
        "declarations",
        {
          type: "at-rule",
          name: "supports"
        },
        {
          type: "at-rule",
          name: "media"
        },
        "rules"
      ],
      { severity: "warning" }
    ]
  },
  ignoreFiles: [
    "**/*.js",
    "**/*.ts",
    "**/*.jsx",
    "**/*.tsx",
    "report.html",
    "playwright-report/**",
    "test-results/**"
  ]
};
