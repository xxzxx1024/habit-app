# 微习惯 / Tiny Habits

面向 iPhone 的习惯积分奖励应用，使用 **Expo SDK 57.0.30、React Native 0.86.3、React 19.2.3、TypeScript**。提供中文、英语、日语、韩语界面。代码包含五个页面、独立积分规则模块、本地持久化、CSV、通知和原生 iCloud Documents 模块。

## 快速启动

需要 Node.js 22.13+（当前云环境验证使用 24.19.0）和 npm。

```bash
cd /workspace/habit-app
npm ci
npm start
```

网页调试：`npm run web`。Expo Go 可以测试基础界面、本地数据和积分逻辑；**iCloud 必须使用自己的 iOS 开发构建**。通知权限和系统投递也必须在 iPhone 上验收。应用不会向开发者服务器发送习惯内容。

当前云沙箱无法写默认用户目录时，可用：

```bash
npm ci --cache /tmp/habit-npm-cache
EXPO_NO_TELEMETRY=1 npx expo start --offline --port 8081
```

`--offline` 使用已安装 SDK 的信息，不需要连接 Expo 的版本检查服务；本机开发网络正常时可省略。云容器不会替代 Xcode 或 iPhone。

## 页面与功能

- **今日**：本地日期、总积分、当日已获积分/上限、连续打卡、完成率、今日计划、完整/半完成打卡、打卡后点习惯填写日志、豁免卡。
- **习惯**：增删改、正负向分类、单次积分、每日次数、每天/指定星期/间隔 N 天、半完成、时分提醒。删除模板保留历史名称和流水。
- **奖励**：增删改奖励、余额校验、确认兑换、兑换历史。
- **统计**：今天的打卡与日记、7/30 天净变动柱图、连续记录、完成率、按类型/名称/日期查询流水、豁免日志。
- **设置**：语言、每日上限、积分下限、周一清零、iCloud 开关/手动同步/冲突选择、CSV、重置。

初始数据为空，应用不会塞入虚假的个人打卡记录。先在习惯页新增模板，再到今日页打卡。

## 规则与边界

### 积分

内部以**半积分为一个整数单位**：`10 units = 5 points`，避免小数累计误差。习惯单次积分为 1–10000 的正整数，因此半完成可以精确到 0.5 分。奖励价格、上限和下限支持 0.5 分步长；价格上限 1000000 分。

- 好习惯只在手动打卡时加分，未打卡没有变化。
- 坏习惯只在手动标记发生时扣分，未标记不扣分。坏习惯的半完成也按 50% 扣分。
- 每日好习惯**累计获分**默认最多 30 分。最后一次只加剩余额度；到顶后仍可打卡和写日志，流水记 0。坏习惯扣分、兑换奖励都不会恢复今日获分额度。
- 总余额默认最低 -10 分；坏习惯扣分到下限即停止。如果将下限调高至当前余额之上，不凭空补分，后续坏习惯暂记 0，直到余额恢复到新下限以上。
- 半完成消耗一次每日次数；不会将半完成原地升级为完整完成。每天允许 1–100 次。日志不会再次消耗次数或积分。
- 奖励只在余额足够时兑换；积分、兑换历史、流水在同一个本地文档中原子保存。界面防止重复提交，状态层串行处理所有写入。
- 公式为：历史余额 + 当日获分 − 当日扣分 − 兑换消耗；周清零通过独立调整流水体现。每条流水都保存变动后的余额。
- 积分默认永久累计。开启周清零后，本地周一之后首次打开/操作时重置一次；无需应用在后台常驻。零余额重置也留审计流水。切换规则不追溯改写历史。

### 日期、循环、完成率

按设备本地自然日计算，星期一开始一周，时区改变后按当前设备时区处理。日期加减使用本地中午，日间距使用 UTC 日历差，避免夏令时一天不是 24 小时的问题。

间隔计划以创建时的日期为锚点；编辑间隔天数保留原锚点。指定星期至少选择一天。

完成率为**当前计划内好习惯**的完成份额/目标次数；半完成为 0.5，最多 100%。坏习惯发生不增加完成率。连续打卡是连续有任一好习惯记录的自然日（半完成也算）；今天未打卡时从昨天向前数。修改或删除模板会影响当前计划完成率，但不删除历史明细。

### 豁免卡

每周自动获得一张，仅该周有效，不累计。卡片可用性由周标识和使用日志计算，应用关闭也不会漏发。

**使用后生效**：使用当日的后续好习惯和坏习惯都记 0 分，仍保留打卡；使用前已经产生的流水保持原样，不回滚兑换。使用不可撤销，有时间与周标识日志。此语义同时在界面说明和测试中固定。

### 重置

删除当前打卡、积分、兑换历史、豁免记录，余额归零；保留习惯模板、奖励模板和设置。若同步开启，重置作为新的数据版本上传。历史 iCloud 版本文件为冲突恢复保留，**这不是云端文件的安全擦除功能**。

## iPhone 与 iCloud 配置

原生实现位于 `modules/habit-cloud/ios/HabitCloudModule.swift`，由 Expo 本地模块自动链接。它使用 **iCloud Documents**，不需要 CloudKit API Key，也不需要将 Apple 凭据放入源码。

1. 使用拥有 iCloud 能力的 Apple Developer 团队。在 Apple Developer 中注册自己的 App ID，例如 `com.yourcompany.tinyhabits`；默认的 `com.example.tinyhabits` 仅用于源码示例，不能作为你的正式签名身份。
2. 创建并关联容器 `iCloud.com.yourcompany.tinyhabits`，启用 iCloud Documents。`app.config.ts` 会根据 `HABIT_BUNDLE_ID` 生成容器和 entitlements；App ID、容器、签名团队必须一致。
3. 在 macOS 安装 Xcode、CocoaPods，连接已登录 Apple ID 且开启 iCloud Drive 的 iPhone。

```bash
export HABIT_BUNDLE_ID=com.yourcompany.tinyhabits
npm ci
npx expo prebuild --platform ios
# 如需手动签名，在 Xcode 打开 ios/*.xcworkspace，选择团队并检查 iCloud 能力。
npm run ios -- --device
```

也可在自己的开发机器使用 EAS（需要用户自己的 Expo/Apple 账户）：

```bash
npx eas-cli login
npx eas-cli init
HABIT_BUNDLE_ID=com.yourcompany.tinyhabits npx eas-cli build --platform ios --profile development
```

在 EAS 项目构建环境也配置相同的 `HABIT_BUNDLE_ID`；后续构建必须保持 bundle/container 一致。EAS 生成的 `projectId` 属于你自己的项目。仓库已经包含 `expo-dev-client` 与 `eas.json`，但未替用户创建项目、申请签名或上传商店。

### 同步协议

- 本地写入成功后才更新 UI；iCloud 异常不会回滚本地保存。
- 自动同步默认关闭，可在设置开启。开启后，启动/返回前台和修改数据后约 1.2 秒同步；同时提供手动按钮。不承诺关闭应用后的后台实时同步。
- 每个云版本是不可变 JSON 文件，包含完整文档和父版本 ID，存于容器 `Documents/Snapshots`。多设备离线写入产生分支，避免静默覆盖。
- 同步发现多个头版本，或本地和云端都相对基线改变时，暂停并要求选择。选择本机/云端会创建引用全部已见分支的新版本；云端按钮展示的是**最新云版本**的时间和余额。其它历史版本保留。
- 第一次连接已有云数据而本机也是独立文档时，会要求明确选择，不猜测用户需要保留哪一份。
- 原生层使用 `NSFileCoordinator`；未下载的占位文件先请求下载并返回可重试状态，不把它视为“空云端”。iCloud 自身是最终一致，晚到分支会在后续同步提示冲突。
- 读取本地和云端均进行结构及流水余额校验。损坏或未知版本不会自动覆盖为空数据库。
- 当前为完整快照方案：长期大量记录将增加 iCloud 占用，未实现版本压缩、后台同步或 Apple ID 切换时自动迁移。请在同一用户自己的 Apple ID 下使用；如更换账户，先关闭同步并导出备份，再明确选择数据版本。

## 本地通知

用户开启习惯提醒并保存时才申请权限。每天、星期、间隔计划均计算未来 28 天日期触发通知，保留最近 **60 条**，为 iOS 的 64 条限制预留空间。每次进入前台、计划修改或语言修改都会续排。多个提醒或长期不打开应用可能使后续日期没有预排通知；界面已说明该窗口。

仅管理 `owner=tiny-habits` 的通知，不取消其他模块通知。通知无需推送服务器，但投递受 iOS 用户权限、专注模式等系统设置影响。Web 不模拟系统通知。

## 数据与导出

`AsyncStorage` 中保存一个带 `schema: 1` 的完整文档。凭借串行写入和一文档提交，打卡/积分/流水不会分别保存导致余额失配。读取失败时显示保护提示，不覆盖原值。导出 UTF-8 BOM CSV，包含流水、余额、完成份额、日志、兑换和豁免记录；引号、换行和表格公式注入均做处理。iOS 使用系统分享面板，Web 下载文件。

## 目录

```text
App.tsx                          # 入口、五页导航、安全区
app.config.ts                    # Expo 57、iOS 容器与权限配置
src/domain/model.ts              # 业务类型与半积分单位约定
src/domain/engine.ts             # 不含 IO 的积分、卡片、兑换、清零规则
src/domain/time.ts               # 本地自然日、周和夏令时日历算法
src/domain/stats.ts              # 完成率、streak、净积分趋势
src/domain/csv.ts                # CSV 转义与公式注入防护
src/domain/validate.ts           # 本地/云文档的结构和账目校验
src/domain/sync.ts               # 不可变版本图与同步决策
src/services/                   # 存储、原生云适配、提醒、分享
src/state/AppProvider.tsx        # 串行持久化、生命周期、同步协调
src/i18n.ts                      # 类型检查覆盖四语言全部文案
src/screens/                    # 五个页面和表单
src/ui/                         # 复用组件、主题、异步操作保护
modules/habit-cloud/             # Swift Expo 本地模块与 podspec
tests/                          # 领域和同步协议自动化测试
```

## 验证

```bash
npm test
npm run typecheck
npm run format:check
EXPO_NO_TELEMETRY=1 npm run export:web
EXPO_NO_TELEMETRY=1 npx expo export --platform ios --output-dir dist-ios
```

当前环境已执行：37 项单元测试全部通过、TypeScript 检查、Web 包和 iOS JS/Hermes 包导出；Expo 本地模块自动发现验证包含 `HabitCloudModule`。浏览器手机尺寸验证覆盖打卡、日记、兑换、四语言、豁免、持久化、CSV、重置，无浏览器运行时错误。浏览器脚本见 `tests/browser_smoke.py`，需要 Python Playwright 与 Chromium；先导出 Web，再在另一个终端运行 `python -m http.server 8765 --bind 127.0.0.1 --directory dist`，最后运行 `python tests/browser_smoke.py`。

**未在当前 Linux 云环境执行**：Xcode/Swift iOS 编译、Apple 签名、iPhone 通知投递、两台真机的 iCloud 往返。这些结果不能由 JavaScript 导出代替。

### 真机验收清单

1. 配置签名及 iCloud 容器，验证 iOS 开发构建启动。
2. 提醒设置为下一分钟，允许通知，退到后台验收投递；修改/删除提醒后检查旧通知取消。
3. 在同一 Apple ID 的设备 A 启用同步并新增习惯，设备 B 选择云端数据，确认余额、日志、奖励一致。
4. A/B 离线分别修改，再同步，确认出现冲突，保留任一版本后两台最终一致；网络失败本地记录仍在。
5. 跨午夜、周一、改变日上限/下限后复核规则；兑换确认与积分不足行为正确。
6. CSV 用表格软件打开，检查中文/日文/韩文和换行日志；重置后习惯模板仍在。
