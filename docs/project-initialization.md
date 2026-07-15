# 新项目初始化清单

`baseApp` 自带可运行示例。创建业务项目后，先完成示例清理，再开始业务开发，避免示例路由、文案和资源与业务内容混用。

## 入口页面

基础框架默认入口由 `src/constants/entryRouting.js` 指向 `/example`，对应页面是：

```text
src/app/(main)/example.jsx
```

业务项目应当：

1. 删除 `src/app/(main)/example.jsx`。
2. 新增自己的 `src/app/(main)/home.jsx` 或其他业务入口页面。
3. 只修改 `src/constants/entryRouting.js` 的 `DEFAULT_ENTRY_ROUTE`，例如改为 `/home`。

不要为了接入业务页面修改基础启动服务中的默认跳转逻辑。

基础框架不提供 `(main)/_layout.jsx`，示例页自行声明导航栏。业务项目存在多个共享 Stack、Tabs 或统一 Header 的页面时，应由业务路由新增自己的 `(main)/_layout.jsx`，不要把业务导航配置写入根布局。

## 语言文件

语言资源按归属拆分：

```text
src/locales/system-language.json   # 基础框架系统文案
src/locales/business-language.json # 当前项目业务文案
src/locales/example-language.json  # 基础示例文案
```

业务项目保留 `system-language.json`，将业务页面文案写入 `business-language.json`。如果要彻底清理示例内容，再删除 `example-language.json`，同时移除 `src/constants/language.js` 对它的导入；仅切换业务入口时不需要动语言加载逻辑。

## 可选 AB Test 示例模块

如果项目不使用 AB Test 示例模块，删除：

```text
src/app/dexa/
```

基础配置 `HAS_AB_TEST_MODULE` 默认是 `false`。需要该模块的项目才在 `src/constants/entryRouting.js` 中显式开启。

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

## 不要删除的基础能力

以下内容属于基础框架，不因删除示例页面而删除：

- `src/app/index.jsx`
- `src/app/webview.jsx`
- `src/services/bootstrap/`
- `src/services/request.js`
- `src/services/openUrlJump.js`
- `src/services/audioPlayback.js`
- `src/services/hapticFeedback.js`
- `assets/images/networkError.png`
