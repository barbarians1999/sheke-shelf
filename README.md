# 社科书架

## 网站

[社科书架 GitHub Pages](https://barbarians1999.github.io/sheke-shelf/)

## 友情链接

[左人书架 GitHub Pages](https://barbarians1999.github.io/zuoren-shelf/)

## 西方哲学史注释

上下册注释分别保存在对应书目目录的`annotations.json`中，原始`chapters.json`保持不变。数据来自用户授权的扫描/OCR整理包：上册777组、1125个入口，下册765组、975个入口；52组不能确认对应关系的注释未导入网页。

1542组中，304组标为扫描核对，784组仅作字形预测但未逐字复核，454组为未经复核OCR。这些状态沿用导入包，未在云端重新核对原扫描页。注释面板始终显示状态和原扫描PDF页码；预测及OCR注释可查看原始识别文本。原PDF不包含在本仓库中。

每个入口核对书目、章节标题、完整段落、UTF-16位置、原标号及前后文，并有独立ID。存在重复、重叠、位置或文字冲突时拒绝该段落的关联。注号仅凭编号相同不会互相配对。97处扫描核对记录涉及网页缺号或错号，已有文字仍原样保留；缺号位置仅补充阅读入口，面板说明差异。注释异步加载，失败或迟到不会阻塞正文或覆盖新章节。

`scripts/build_philosophy_annotations.py`可从原整理包重新生成网站数据，校验导入文件及正文SHA-256、所有锚点、唯一ID和重叠情况。用法：`python scripts/build_philosophy_annotations.py /本地路径/western-philosophy-annotations-upper.json`（下册同理）。程序只输出可定位注释，歧义记录只保留数量；注释文字使用纯文本渲染。
