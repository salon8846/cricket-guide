# 首版审核移除 AppsFlyer SDK 清单

目标：首版审核包内不出现 AppsFlyer SDK。运行时代码开关只能阻止 SDK 执行，不能保证二进制内没有 SDK 痕迹；首版必须从依赖、Expo plugin、原生注入和相关配置中移除。

当前业务代码已经收口到归因抽象层。首版处理重点是移除 SDK 依赖和配置，不需要再改业务流程。

## 需要移除

### 依赖

- `package.json`
  - 移除 `react-native-appsflyer`
- `package-lock.json`
  - 更新 lock 文件
  - 确保没有 `react-native-appsflyer`

### Expo 配置

- `app.json`
  - 移除 `react-native-appsflyer` plugin 配置
  - 移除 `./plugins/withAppsFlyerAndroidDeepLink`
  - 移除 `./plugins/withAppsFlyerIosDeepLink`

### AppsFlyer OneLink 配置

如果首版审核要求包内不出现 AppsFlyer 相关能力，需要同时移除明确属于 OneLink 的域名配置：

- `app.json` iOS `associatedDomains`
  - `applinks:baseapp.onelink.me`
- `app.json` Android `intentFilters`
  - `host: baseapp.onelink.me`

普通业务 universal link 域名可保留，只移除明确属于 AppsFlyer / OneLink 的域名。

### 原生生成产物

如果本地或 CI 已经执行过带 SDK 配置的 prebuild，需要重新生成干净原生工程：

```bash
npx expo prebuild --clean
```

如果项目提交了 `ios/` 或 `android/`，还需要确认原生工程中没有 AppsFlyer 注入代码、framework、manifest provider、service 或 build 配置。

## 验证

首版打包前先检查依赖和 Expo 配置：

```bash
grep -En "react-native-appsflyer|AppsFlyer" package.json package-lock.json app.json
```

期望结果：

- `package.json` / `package-lock.json` 没有 SDK 依赖
- `app.json` 没有 AppsFlyer plugin

如果首版分支不保留未引用的 AppsFlyer 注入脚本，可以删除：

- `plugins/withAppsFlyerAndroidDeepLink.js`
- `plugins/withAppsFlyerIosDeepLink.js`

如果保留这两个文件，必须确保 `app.json` 没有引用它们；未引用的 Expo plugin 不会注入原生工程。

如果项目中存在 `ios/` 或 `android/`，再检查原生工程：

```bash
grep -ERn "AppsFlyer|react-native-appsflyer" ios android
```

期望结果：

- `ios/` / `android/` 没有 AppsFlyer 注入痕迹

构建产物审核前建议再解包检查一次，确认没有 AppsFlyer framework、class、manifest provider 或 service。
