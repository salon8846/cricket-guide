# App Debug 配置说明

`/system/init` 的 `data.debug` 用于控制生产包里的本机调试能力。后台没开启 debug 时，不要返回 `debug` 字段；只要返回了 `debug` 字段，即使值是 `null`，App 也允许通过连续点击开启本机 debug。

后台如果是输入框编辑 JSON 字符串，建议直接按下面示例填写 `debug` 对象内容。

## 开关语义

不允许 debug：

```json
{
  "data": {
    "base": {},
    "attribution": {}
  }
}
```

允许 debug，全部使用 App 默认值：

```json
{
  "data": {
    "debug": null
  }
}
```

允许 debug，并配置点击区、WebView 调试面板：

```json
{
  "data": {
    "debug": {
      "tapArea": {
        "width": 30,
        "height": 30,
        "top": 0,
        "left": 0
      },
      "webViewDebugPanel": {
        "type": "eruda",
        "scriptUrl": ""
      }
    }
  }
}
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `debug` | `object \| null` | 无字段 | 字段存在表示后端允许本机 debug；无字段表示不允许，并清理本地 debug 状态。 |
| `debug.tapArea` | `object` | 见下方默认值 | 全局连续点击 10 次的透明区域。 |
| `debug.webViewDebugPanel` | `object` | 见下方默认值 | WebView/H5 调试面板配置。 |
| `debug.webViewDebugPanel.type` | `string` | `"eruda"` | 支持 `"eruda"`、`"vconsole"`；其他值按 `"eruda"` 处理。 |
| `debug.webViewDebugPanel.scriptUrl` | `string` | `""` | 可选外部脚本地址，生产只接受 `https`，开发模式接受 `http`/`https`；为空时使用 App 内置源码。 |

`tapArea` 默认值：

```json
{
  "width": 30,
  "height": 30,
  "top": null,
  "right": null,
  "bottom": null,
  "left": 0,
  "backgroundColor": "transparent"
}
```

`webViewDebugPanel` 默认值：

```json
{
  "type": "eruda",
  "scriptUrl": ""
}
```

## App 行为

- 后端返回 `debug` 字段后，App 全局透明点击区生效。
- 连续点击 10 次开启本机 debug，再次连续点击 10 次关闭；关闭前会二次确认。
- 开启或关闭后，App 会回到 `/` 重新执行启动链路。
- 本机 debug 开启后，App 会显示可拖动的 Debug 悬浮入口，悬浮位置会持久化，重启 App 后保持不变。
- 点击悬浮按钮只切换全局 Debug 面板显示状态，不走路由，不重载当前业务页面。
- Debug 面板常驻挂载在根布局里，内部 tabbar 当前包含 `Info` 和 `Tools`；这里不使用 Expo Router 的 `(tabs)` 或动态路由。
- `Info` 会展示 App、设备、Build / Runtime、Debug 状态、服务器 `debug` 配置和请求头；后端新增字段会自动显示在 `Server Debug Config` 区域，`token` / `password` / `secret` / `key` 等敏感字段会脱敏。
- `Tools` 提供复制脱敏 Debug 快照、重置悬浮按钮位置、重新初始化、清除本地数据、清除全部本地数据、关闭 Debug；清除本地数据会二次确认，其中 `Clear Data` 会保留 Debug 状态、`installId` 和悬浮按钮位置，`Clear All Data` 会清空全部 AsyncStorage。
- Debug 面板文案固定使用英文，不接入 App 语言包。
- 原生 API 请求会始终携带当前安装实例：

```http
X-App-Client: <installId uuid-v4>
```

本机 debug 开启后，原生 API 请求会额外增加：

```http
X-App-Debug: 1
X-App-Debug-Session: dbg_xxx
```

`X-App-Debug-Session` 表示本轮 Debug 开启周期；关闭 Debug 会清除 session，下次开启重新生成。

`X-App-Client` 使用当前 App 安装实例的 `installId`，格式为 UUID v4；`installId` 在 App 启动链路中确认，可复用于后续崩溃日志、问题排查等场景，不表示物理设备 ID。

后端验证 debug 请求时建议同时判断：

```text
现有 Verify-Time / Verify-Encrypt 有效
+ 当前 App 后台 debug 开关仍然开启
+ 请求带 X-App-Debug: 1
+ 请求带有效 X-App-Debug-Session
= 使用测试配置
```

## 后台配置示例

使用默认 eruda：

```json
{
  "tapArea": {
    "width": 30,
    "height": 30,
    "top": 0,
    "left": 0
  },
  "webViewDebugPanel": {
    "type": "eruda"
  }
}
```

使用 vConsole：

```json
{
  "webViewDebugPanel": {
    "type": "vconsole"
  }
}
```

使用外部调试面板脚本：

```json
{
  "webViewDebugPanel": {
    "type": "eruda",
    "scriptUrl": "https://example.com/eruda.min.js"
  }
}
```

## 注意事项

- `X-App-Debug` 不是安全凭证，后端仍应以后台当前 App debug 开关作为最终判断。
- 本次只处理 App 原生侧 axios 请求头，不处理 WebView 内 H5 自己发出的 `fetch` / `XMLHttpRequest`。
- 如果后台关闭 debug，应直接不返回 `debug` 字段；不要返回空对象来表示关闭。
- 生产环境只应给测试设备、测试账号或灰度条件返回 `debug` 字段；普通正式用户不应收到该字段，否则左上角默认透明点击区会占用一小块触摸区域。
