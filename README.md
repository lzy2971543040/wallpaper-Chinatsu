# 千夏 · 妄想天使 — 壁纸画廊

《绝区零》（Zenless Zone Zero）2.6「旧梦的安可曲」角色 **千夏** 的粉丝向壁纸站。
纯静态站点，双击 `index.html` 即可在浏览器打开，不需要起任何服务。

## 功能

- **瀑布流画廊**：6 / 5 / 4 / 3 / 2 列自适应，卡片按原图比例排布，滚动分页加载
- **标签筛选**：全部 / 官方美术 / 横屏壁纸 / 手机竖屏 / 方形构图 / 4K 超清（可多选，取交集）
- **搜索**：按编号、分辨率、标签过滤
- **灯箱**：点击任意图片放大查看原图，`←` `→` 切换、`Esc` 关闭、一键下载原图
- **随机 / 打乱**：Hero 区「随便来一张」随机开灯箱，工具栏 `⤨` 打乱当前顺序
- 深色主题 + 千夏配色（薄荷绿 / 樱花粉）

## 目录结构

```
index.html                页面骨架
assets/css/style.css      样式
assets/js/app.js          筛选、瀑布流布局、灯箱逻辑
data/gallery.js           图片数据（window.GALLERY，由脚本生成）
assets/full/              画廊原图（WebP，长边 ≤2560）
assets/thumbs/            WebP 缩略图（瀑布流使用，760px）
assets/official/          官方美术溯源清单（manifest.json）
tools/                    采集、筛选、构建脚本（见下）
```

> 站点上线体积约 36 MB（缩略图 14 MB + 原图 WebP 22 MB）。

## 数据与构建

图片数据由脚本生成，不要手改 `data/gallery.js`。完整流程：

```bash
# 1) 从百度图片采集原图（无头 Edge + CDP，需要本机 Edge）
node tools/download_v2b.mjs        # 结果写入 assets/incoming/

# 2) 生成缩略图、标签并重建 data/gallery.js
python tools/build_gallery.py

# 3) 把原图统一压成 WebP（长边 ≤2560）并改写 data/gallery.js
python tools/slim.py

# 4) 清理已不在画廊里的孤儿缩略图
python tools/prune.py
```

`build_gallery.py` 会：

- 按 MD5 去重、跳过短边 < 1000px 的图
- 为每张图生成 760px WebP 缩略图到 `assets/thumbs/`
- 按宽高比自动打标签：`official` / `ultra`（长边 ≥ 2560）/ `landscape` / `portrait` / `square`
- 官方图按序号重命名为 `official-01.png` … 并保留中文标题

`tools/prep.py`、`tools/sheet*.py` 用来生成联系图（contact sheet）做人工筛选，`tools/curate*.py` 是筛选记录，可按需修改。

## 来源与版权

- 官方美术来自 [biligame 千夏角色页](https://wiki.biligame.com/zzz/千夏) 的原图（`/thumb/{path}/{N}px-` 去掉后即为原图）
- 其余壁纸来自公开图片搜索（B 站、微博、知乎等图床），已按分辨率和内容人工筛选，剔除了游戏截图、实拍与周边商品图
- 图片版权归 miHoYo / HoYoverse 及原画师所有，本站仅作粉丝向浏览与收藏，不作商业用途

## 已知限制

- 官方页面的 `data-objurl` 采集依赖百度图片结果页结构，站点改版后脚本会失效
- 抖音、淘宝、zcool 等站点有防盗链，直接下载返回 403，已在采集阶段跳过
- 缩略图约 14 MB，原图 WebP 约 22 MB，首次打开画廊按需懒加载
