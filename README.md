<img src="docs/logo.png" width="140" alt="Koma" />

# Koma

**你的课表，理应如此。**

今天 / 周视图 / 待办 / 冲突处理 / 变更记录 / 多源导入 / AI 转换 / 课程贴纸 / 桌面小组件

<a href="https://github.com/shuakami/timetable/releases/latest/download/GagaTimetable-android.apk"><img src="docs/download-android.svg" alt="Download for Android" /></a>
<a href="https://shuakami.github.io/timetable/"><img src="docs/website.svg" alt="Website" /></a>

</div>

## 截图

### 今天 / 周视图 / 课程详情

![今天、日历面板、周视图、课程详情](docs/screenshots/group1.png)

### 下课随手记 / 拍板书 / 待办

![刚下课、拍板书、拍完、待办详情、待办](docs/screenshots/group8.png)

### 教务系统导入

![学校登录页、课表页一键导入、选学期、预览](docs/screenshots/group9.png)

教务账号卡片显示学校、学期和上次同步结果；点按卡片更新课表，左滑退出登录，开关只控制后台自动更新。教务自动更新在应用回到前台时检查，每 24 小时最多执行一次。先用该学校会话 Cookie 读取课表；会话失效时，若用户开启了“保存密码”，使用 Android Keystore 保护的本机凭据重新登录并重试一次。初次开启保存密码不会提交登录；用户可查看输入的密码，点击登录成功后才保存凭据，此后再次进入登录页可自动登录。退出登录或清除全部数据时删除会话与凭据。凭据密文不参与系统备份。

新疆理工职业大学使用正方移动端课表接口：先读取学期周次表，再逐周请求实际课表；逐周数据作为最终排课来源，按课程、教师、地点、星期和节次合并，保留每周差异。整学期结果仅作为接口对照，不用于覆盖周课表。周次请求结果在当前页面会话中缓存，切换学期或页面后重新获取；任一周读取失败不应用不完整课表。

### 导入 / AI 转换 / 待办 / 我的

![导入课表、从链接添加、让 AI 生成规则、待办、我的](docs/screenshots/group2.png)

### 空状态 / 导入失败 / 时间冲突 / 变更记录

![还没有课表、导入失败、时间冲突、留哪一门、调课变更](docs/screenshots/group4.png)

### 学期边界 / 假期 / 考试周 / 编辑 / 手动添加

![超出学期、国庆假期、考试周、编辑课程、手动添加](docs/screenshots/group5.png)

### 通知 / 锁屏 / 桌面小组件

![锁屏通知、通知设置、桌面小组件、今天没有课](docs/screenshots/group3.png)

### 搜索 / 长按菜单 / 开学日期 / 课表来源

![搜索、长按课程菜单、开学日期、课表来源](docs/screenshots/group7.png)

## 功能

**今天**

- 日期时间线从设定的开学周算第 1 周；无课日按周折叠成日期区间，跨周不合并；连续假期显示名称、日期和天数，有课或调休的日期单独呈现
- 底部日期条随时间线定位，折叠区间内仍可选择具体日期；月历面板从底部打开
- 假期卡片旁的「调休安排」及「我的 → 学期 → 调休安排」进入同一页面；补课日期是实际要上课的日子，课表日期是要补哪天的课

**课表**

- 周视图网格，正在上的课高亮，单双周、假期、考试周均有标注
- 时间重叠自动检测，支持「都保留」或「只留一门」决策，被隐藏的课可随时恢复
- 长按课程卡片可静音本节、标记已上、请假一次、查看变更记录、编辑课程或停课

**课程**

- 详情页展示下次上课时间、地点、老师、上课日、考核方式、提醒、学期进度、出勤、作业与备忘
- 编辑时可选生效范围「仅本次」或「每周」，可调整状态、时间、地点、老师、备注、颜色
- 单节 Override 与常规规则分离，每次修改留一条变更记录，支持撤销

**导入**

- 内置规则支持 JSON、Excel（xlsx）、教务系统 HTML 网格、ICS 日历、CSV
- **让 AI 转换课表**：一键复制经过设计的 Prompt，把课表文字或截图交给任意 AI，粘贴 JSON 即可导入，兼容 ```json 代码块
- 解析后进入预览，新增、变化、无法解析逐条列出，确认后完成导入；重复导入做三方合并，手动改过的字段不被覆盖
- JSON 带 `timeSlots` 时自动更新学期节次表；课程节次超出时自动补足
- **分享课表**：导出标准 .ics 走系统分享，对方在任何日历应用里都能打开；用课程表打开（微信收到的文件也行）则学期、节次表、老师、电话、颜色原样导入

**待办**

- 作业、考试、自定义待办，可挂在课程上，按今天、近期、已完成分组

**提醒与小组件**

- 课、作业、考试同步至系统日历：每门课一本日历、沿用课程颜色，作业、考试、周次各一本；上课前、截止前、考试前由系统日历提醒
- 停课、请假的那节保留在日历里（标题带「停课」「请假」，不提醒）；老师电话写在事件描述里可直接拨号
- 学期结束后课程日历自动从日历列表隐起，记录保留；在系统日历里手动改的颜色不会被同步覆回
- 4 款桌面小组件：今日、下一节、两日、本周，跟随系统深浅色

**Android**

- 日期、时间、下拉选择支持系统原生对话框
- Android 13+ 主题图标（monochrome）、自适应开屏、边到边加安全区
- 系统返回键依次关闭菜单或面板、出栈、回到「今天」、两次返回退出

## 快速开始

```bash
# Node 22
npm ci
npm run dev            # http://localhost:5173，浏览器直接调试 Web 端
```

界面通用图标使用 `~icons/mingcute/*`；空状态插画、加载动画及课程贴纸保留定制 SVG。生产界面与 `src/App.tsx` 原型逐屏核对尺寸、颜色和状态。

完整验证：

```bash
npm run check          # tsc --noEmit && vitest run && vite build
```

Android debug 包：

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64   # JDK 21
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Gradle 下载慢时在 `~/.gradle/init.gradle` 加国内镜像；见 [AGENTS.md](AGENTS.md#部署与打包)。

## 许可

GPL-3.0

学校教务索引（`src/domain/edu/schools.json`）整理自 [baoozak/timetable](https://github.com/baoozak/timetable)（MIT）。
