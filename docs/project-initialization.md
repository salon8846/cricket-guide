# 新项目初始化清单

`baseApp` 自带可运行示例。创建业务项目后，先完成示例清理，再开始业务开发，避免示例路由、文案和资源与业务内容混用。

## 应用身份与构建配置

在 `app.json` 中修改当前应用的 `expo.name`、`expo.slug`、`expo.version`、`expo.scheme`、iOS `bundleIdentifier` 和 Android `package`。

将 iOS `associatedDomains` 和 Android `intentFilters` 中的 `example.onelink.me` 替换为当前应用的实际域名；不使用 Universal Links 或 OneLink 时删除对应配置。

为当前应用创建并填写独立的 `extra.eas.projectId`。修改 `package.json` 的项目名称，应用展示版本在 `app.json` 中维护。

## 应用资源与启动页

替换 `icon.png`、`splash-icon.png`、Android adaptive icon 和 `favicon.png` 的图像资源。

业务图片、音频、SVG 和语言资源归档到当前业务目录。

## 项目运行配置

按 `config.private.example.js` 的公开结构修改 API 域名。

如果当前应用使用 AppsFlyer，需配置当前应用的 AppsFlyer 记录和 OneLink；如果不使用，按 [首版审核移除 AppsFlyer SDK 清单](./first-review-sdk-removal.md) 移除依赖、插件和 OneLink 配置。

## 应用定制配置

`src/constants/appCustomization.js` 是下游项目的集中定制点。需要随下游应用变化的配置在这里调整；基础服务和页面只消费这些配置，不为单个项目重写内部逻辑。

### 入口页面

基础框架在 `src/constants/appCustomization.js` 中将 `DEFAULT_ENTRY_ROUTE` 配置为 `/example`，对应页面是：

```text
src/app/example/index.jsx
```

业务项目应当：

1. 删除 `src/app/example/`。
2. 新增自己的 `src/app/(main)/` 业务路由目录和入口页面。
3. 修改 `src/constants/appCustomization.js` 的 `DEFAULT_ENTRY_ROUTE`，例如改为 `/home`。

基础框架不包含 `(main)/`，该目录及其 layout 由下游项目按业务导航结构创建和维护。根布局 `src/app/_layout.jsx` 只显式注册 `index` 与 `webview`；业务路由由 Expo Router 自动发现，呈现参数在业务 layout 或页面中导出 `options`，不要改共享根布局。

### 启动页配色

按项目启动页设计修改 `BOOTSTRAP_APPEARANCE.indicatorColor`、`BOOTSTRAP_APPEARANCE.backgroundColor` 和 `BOOTSTRAP_APPEARANCE.statusBarStyle`。

### 可选 AB Test 示例模块

如果项目不使用 AB Test 示例模块，删除：

```text
src/app/dexa/
```

`HAS_AB_TEST_MODULE` 在 `src/constants/appCustomization.js` 中默认配置为 `false`。需要该模块的项目才将它显式开启。

下游接入真实 AB 业务时，不要继续使用 `dexa` 示例名。将路由目录、组件、资源、store 和 `AB_TEST_ENTRY_ROUTE` 重命名为当前业务标识后再开启模块。

## 语言文件

语言资源按归属拆分：

```text
src/locales/system-language.json   # 基础框架系统文案
src/locales/business-language.json # 当前项目业务文案
src/locales/example-language.json  # 基础示例文案
```

业务项目保留 `system-language.json`，将业务页面文案写入 `business-language.json`。创建业务项目时删除 `example-language.json`，同时移除 `src/constants/language.js` 对它的导入。

## 示例接口

`src/services/api/example.js` 仅用于演示接口文件组织方式。业务项目不使用时应删除该文件，并在 `src/services/api/` 中按模块新增真实接口文件。

## 示例音频

基础示例首页使用：

```text
assets/example/sample-click.mp3
```

如果业务项目不复用该声音，应删除该文件；如果业务需要复用，应先将它移动到业务资源目录并更新业务引用，再删除示例页面。基础框架的通用音频与触觉能力分别位于 `src/services/audioPlayback.js` 和 `src/services/hapticFeedback.js`，不依赖这个示例音频文件。

## 示例页面依赖

`expo-linear-gradient` 只由基础示例页面使用。业务项目删除示例页面后，如果自己的页面也不使用渐变，应同时运行：

```bash
npm uninstall expo-linear-gradient
```

如果业务页面仍使用渐变，则保留该依赖。
