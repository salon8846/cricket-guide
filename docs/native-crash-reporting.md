# Native Crash Reporting

本项目的异常上报仍使用自建 API：`/system/clientError`。

## 当前实现

- JS / React / Promise / Bootstrap 异常由 `src/services/logging/clientErrors/` 记录到 `app-logs/client-errors/`。
- Android 原生崩溃由 ACRA 采集，Expo config plugin 会注入 ACRA 初始化和本地 `ReportSender`，写入：

```text
app-logs/native-crashes/pending.jsonl
```

- iOS 原生崩溃由 KSCrash 采集，Expo config plugin 会生成 `AppNativeCrashReports` 原生模块。App 下次启动时，JS 会先调用原生模块把 KSCrash outstanding reports 导出到同一个 `native-crashes/pending.jsonl`。
- 原生导出完成后，JS 会读取 `client-errors` 和 `native-crashes` 两类 pending report，合并后提交 `/system/clientError`。
- 上报成功后清理 JS pending 和 native pending。
- Debug `Logs -> Errors` 会把 native pending 合并展示，`Pending Uploads` 也包含 native pending 数量。

## Android

`plugins/withNativeCrashReports.js` 会在 prebuild 后向 Android 工程添加：

- Gradle 依赖：`ch.acra:acra-core:5.13.1`
- `MainApplication.attachBaseContext()` 中的 `ACRA.init(...)`
- 自定义 `ReportSender`，把 ACRA report 转成 JSONL 本地队列
- `AppNativeCrashReports` React Native module，用于 Debug Tools 触发 Android native crash 测试
- `alsoReportToAndroidFramework = true`，保留 Android 系统崩溃链路，避免影响 Google Play Android Vitals

Android report 会转换成统一字段：

```json
{
  "platform": "android",
  "source": "android_acra",
  "errorName": "...",
  "message": "...",
  "stack": "...",
  "thread": "..."
}
```

ACRA 采集字段只保留崩溃分析需要的版本、设备、线程、栈、logcat、内存和显示信息；不采集 SharedPreferences、Settings、用户 IP 等更容易包含业务或用户数据的字段。完整 ACRA report 会作为 `raw` 放入本地文件，JS 上报前仍会走统一大小限制和敏感字段裁剪。

## iOS

`plugins/withNativeCrashReports.js` 会添加 CocoaPods 依赖：

```ruby
pod 'KSCrash', '~> 2.5'
```

并在 `AppDelegate.swift` 安装 KSCrash：

```swift
let config = KSCrashConfiguration()
config.monitors = [.machException, .signal]
try? KSCrash.shared.install(with: config)
```

同时生成 `AppNativeCrashReports.m` 并加入 Xcode Sources。该模块提供：

- `flushPendingNativeCrashReports()`：读取 KSCrash report store，把 outstanding reports 转成统一 schema，写入 `app-logs/native-crashes/pending.jsonl`，成功后由 KSCrash 按 `OnSuccess` 策略清理原始 report。
- `triggerNativeCrash()`：Debug Tools 的 Native Crash 测试入口，会调用 `abort()` 触发 fatal signal 并终止 App。

当前版本不手写 iOS signal/Mach handler，也不在 crash handler 中做 IO；所有文件写入发生在下次启动的正常运行阶段。

## 边界

- Expo Go 不能验证 native crash 注入；需要 dev client 或 release 包。
- Debug Tools `Crash Tests -> Native Crash` 只能在包含 config plugin 生成原生代码的 dev client / release 包中运行。
- Android ACRA 覆盖 Java/Kotlin 未捕获异常和 Android runtime 层崩溃信息；如果后续引入大量 C/C++/NDK 代码，需要再评估 Breakpad/Crashpad 这类 minidump 方案。
- iOS KSCrash 当前开启 Mach exception / fatal signal 采集；如果后续需要 Objective-C / C++ exception、OOM、主线程死锁等更广覆盖，需要单独评估 monitors 和隐私声明。
