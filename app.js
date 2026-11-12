const search = document.querySelector("#book-search");
const bookList = document.querySelector("#book-list");
const categoryFilters = document.querySelector("#category-filters");
const shelfView = document.querySelector("#shelf-view");
const readerView = document.querySelector("#reader-view");
const readerHeader = document.querySelector(".reader-header");
const readingPage = document.querySelector(".reading-page");
const fontSettings = document.querySelector("#font-settings");
const contentsPanel = document.querySelector("#contents-panel");
const contentsBackdrop = document.querySelector("#contents-backdrop");
const readerTitle = document.querySelector("#reading-book-title");
const chapterList = document.querySelector("#chapter-list");
const readerLayout = document.querySelector("#reader-layout");
const contentsToggle = document.querySelector("#toggle-contents");
const desktopReader = window.matchMedia("(min-width: 721px)");
const chapterTitle = document.querySelector("#chapter-title");
const chapterContent = document.querySelector("#chapter-content");
const annotationNotice = document.querySelector("#annotation-notice");
const readerPosition = document.querySelector("#reader-position");
const readingFontKey = "sheke-reading-font:v1";
const readingSizeKey = "sheke-reading-size:v1";
const readingSizeInput = document.querySelector("#reading-size");
const readingSizeValue = document.querySelector("#reading-size-value");
const resetReadingSize = document.querySelector("#reset-reading-size");
let hasCustomReadingSize = false;
let books = [];
let chapters = [];
let activeIndex = 0;
let activeBook = null;
let activeBookTrigger = null;
let activeCategory = "";
let chapterRequestId = 0;
let hideControlsTimer = 0;
let readingPointer = null;
let contentsReadingScrollTop = 0;

function applyReadingFont(font, persist = false) {
  const selected = ["hanyi", "fangsong"].includes(font) ? font : "";
  if (selected) document.documentElement.dataset.readingFont = selected;
  else delete document.documentElement.dataset.readingFont;
  document.querySelectorAll("button[data-reading-font]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.readingFont === selected));
  });
  if (persist) {
    try {
      if (selected) localStorage.setItem(readingFontKey, selected);
      else localStorage.removeItem(readingFontKey);
    } catch { /* The current choice still applies for this visit. */ }
  }
}

try {
  applyReadingFont(localStorage.getItem(readingFontKey));
} catch {
  applyReadingFont("");
}

function updateReadingSizeDisplay(size) {
  const rounded = Math.round(Number.parseFloat(size) * 10) / 10;
  if (!Number.isFinite(rounded)) return;
  readingSizeInput.value = String(rounded);
  readingSizeValue.value = `${rounded.toFixed(1)} px`;
  readingSizeValue.textContent = `${rounded.toFixed(1)} px`;
}

function applyReadingSize(size, persist = false) {
  const parsed = size === null ? null : Number.parseFloat(size);
  const valid = Number.isFinite(parsed) && parsed >= 14 && parsed <= 30;
  hasCustomReadingSize = valid;

  if (valid) {
    const value = `${parsed}px`;
    document.documentElement.style.setProperty("--chapter-font-size", value);
    updateReadingSizeDisplay(parsed);
    if (persist) {
      try { localStorage.setItem(readingSizeKey, String(parsed)); } catch { /* The current choice still applies for this visit. */ }
    }
    return;
  }

  document.documentElement.style.removeProperty("--chapter-font-size");
  if (persist) {
    try { localStorage.removeItem(readingSizeKey); } catch { /* The default still applies for this visit. */ }
  }
  updateReadingSizeDisplay(getComputedStyle(chapterContent).fontSize);
}

try {
  const savedSize = localStorage.getItem(readingSizeKey);
  if (savedSize !== null && Number.isFinite(Number(savedSize)) && Number(savedSize) >= 14 && Number(savedSize) <= 30) {
    applyReadingSize(savedSize);
  } else {
    if (savedSize !== null) localStorage.removeItem(readingSizeKey);
    applyReadingSize(null);
  }
} catch {
  applyReadingSize(null);
}

async function loadBooks() {
  const response = await fetch("book-index.json?v=20261002", { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取书目数据");
  const data = await response.json();
  books = (data.books || []).filter(book => Number(book.chapterCount) > 0);
  renderCategoryFilters();
  renderBooks(books);
}

function renderCategoryFilters() {
  const categories = [...new Set(books.map(book => book.category).filter(Boolean))];
  const options = ["", ...categories];
  categoryFilters.replaceChildren();
  for (const category of options) {
    const button = document.createElement("button");
    button.className = "category-filter";
    if (category === activeCategory) button.classList.add("is-active");
    button.type = "button";
    button.textContent = category || "全部";
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => {
      activeCategory = category;
      renderCategoryFilters();
      filterBooks();
    });
    categoryFilters.append(button);
  }
}

function filterBooks() {
  const query = search.value.trim().toLocaleLowerCase();
  renderBooks(books.filter(book => {
    const matchesCategory = !activeCategory || book.category === activeCategory;
    const matchesQuery = `${book.title} ${book.author} ${book.category}`.toLocaleLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  }));
}

const bookCoverArtwork = {
  "guns-germs-and-steel": 0,
  "western-philosophy-history-upper": 1,
  "western-philosophy-history-lower": 2,
  "luxun-complete-works": 3,
  "chinese-ancient-history-vol1": 4,
  "chinese-ancient-history-vol2": 5,
  "chinese-ancient-history-vol3": 6,
  "bai-shouyi-history-lectures": 7,
  "short-world-history-ancient": 8,
  "short-world-history-modern-period": 9,
  "short-world-history-modern": 10,
  "gorky-autobiography-trilogy": 11,
  "chinese-working-women-pan-yi": 12,
  "factory-boy-ding-yan": 13,
  "reactionary-saint-confucius": 14,
  "life-of-klim-samgin": 15,
  "mother-gorky": 15,
};

function createBookCover(book) {
  const cover = document.createElement("div");
  const tile = bookCoverArtwork[book.id] ?? 0;
  cover.className = "book-cover";
  cover.style.setProperty("--cover-x", `${(tile % 4) * 100 / 3}%`);
  cover.style.setProperty("--cover-y", `${Math.floor(tile / 4) * 100 / 3}%`);
  cover.setAttribute("aria-hidden", "true");
  const title = document.createElement("span");
  title.className = "cover-title";
  title.textContent = book.title.replace(/[：:].*$/, "").replace("，1975", "").replace("套装（十一册）", "");
  const art = document.createElement("span");
  art.className = "cover-art";
  cover.append(title, art);
  return cover;
}

function renderBooks(items) {
  bookList.replaceChildren();
  document.querySelector("#shelf-count").textContent = `${items.length} 本`;
  document.querySelector("#empty-state").hidden = items.length !== 0;
  for (const book of items) {
    const card = document.createElement("article");
    card.className = "book-card";
    const category = document.createElement("p");
    category.className = "book-category";
    category.textContent = book.category;
    const title = document.createElement("h2");
    title.textContent = book.title;
    const author = document.createElement("p");
    author.className = "book-author";
    author.textContent = book.author;
    const footer = document.createElement("div");
    footer.className = "book-footer";
    const state = document.createElement("span");
    state.className = "book-state";
    state.textContent = book.stateLabel;
    footer.append(state);
    const button = document.createElement("button");
    button.className = "read-button";
    button.type = "button";
    button.textContent = "开始阅读";
    button.addEventListener("click", () => openBook(book, button));
    footer.append(button);
    card.append(createBookCover(book), category, title, author, footer);
    bookList.append(card);
  }
}

async function openBook(book, trigger) {
  const chapterSource = book.chapterManifest || `books/${encodeURIComponent(book.id)}/chapters.json`;
  const response = await fetch(chapterSource, { cache: "no-store" });
  if (!response.ok) return;
  const data = await response.json();
  activeBook = book;
  activeBookTrigger = trigger;
  chapters = data.chapters || [];
  activeIndex = 0;
  shelfView.hidden = true;
  readerView.hidden = false;
  document.body.classList.add("reading-active");
  setContentsCollapsed(!desktopReader.matches);
  setReaderControlsVisible(false);
  document.querySelector("#shelf-tools").hidden = true;
  readerTitle.textContent = `${book.title} · ${book.author}`;
  renderChapterList();
  await showChapter(0);
  location.hash = book.id;
}

function renderChapterList() {
  chapterList.replaceChildren();
  chapters.forEach((chapter, index) => {
    const button = document.createElement("button");
    button.className = "chapter-link";
    button.type = "button";
    button.textContent = chapter.title;
    button.addEventListener("click", () => {
      if (!desktopReader.matches) {
        setContentsCollapsed(true);
        setReaderControlsVisible(false);
      }
      showChapter(index);
    });
    chapterList.append(button);
  });
}

function setContentsCollapsed(collapsed) {
  const wasOpen = document.body.classList.contains("reader-contents-open");
  const shouldCollapse = Boolean(collapsed);
  const drawerOpen = !desktopReader.matches && !shouldCollapse && !readerView.hidden;
  if (drawerOpen && !wasOpen) contentsReadingScrollTop = window.scrollY;
  readerLayout.classList.toggle("is-contents-collapsed", shouldCollapse);
  chapterList.hidden = shouldCollapse;
  contentsPanel.inert = shouldCollapse;
  contentsPanel.setAttribute("aria-hidden", String(shouldCollapse));
  contentsToggle.setAttribute("aria-expanded", String(!shouldCollapse));
  contentsToggle.textContent = desktopReader.matches ? (shouldCollapse ? "展开目录" : "收起目录") : "目录";
  contentsBackdrop.hidden = !drawerOpen;
  readingPage.inert = drawerOpen;
  document.body.classList.toggle("reader-contents-open", drawerOpen);
  syncReaderSurface();
  if (drawerOpen) {
    setReaderControlsVisible(false);
    const active = chapterList.querySelector('[aria-current="page"]');
    (active || document.querySelector("#close-contents")).focus({ preventScroll: true });
    if (active) {
      const rect = active.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2), behavior: "instant" });
    }
  } else if (wasOpen) {
    window.scrollTo({ top: contentsReadingScrollTop, behavior: "instant" });
  }
}

function syncReaderSurface() {
  const mobileReading = !desktopReader.matches && !readerView.hidden;
  document.documentElement.classList.toggle("mobile-reading-active", mobileReading);
  const color = getComputedStyle(document.documentElement).getPropertyValue(mobileReading ? "--reader" : "--ground").trim();
  document.querySelector('meta[name="theme-color"]').setAttribute("content", color);
}

function setReaderControlsVisible(visible, autoHide = false) {
  window.clearTimeout(hideControlsTimer);
  readerView.classList.toggle("controls-visible", visible);
  readerHeader.inert = !desktopReader.matches && !visible;
  readerHeader.setAttribute("aria-hidden", String(!desktopReader.matches && !visible));
  if (!visible) fontSettings.open = false;
  if (visible && autoHide && !desktopReader.matches) {
    hideControlsTimer = window.setTimeout(() => {
      if (!document.body.classList.contains("reader-contents-open") && !fontSettings.open && !readerHeader.querySelector(":focus-visible")) {
        setReaderControlsVisible(false);
      }
    }, 5000);
  }
}

async function showChapter(index) {
  if (!chapters[index]) return;
  const requestId = ++chapterRequestId;
  const bookId = activeBook?.id;
  annotationNotice.hidden = !bookAnnotationSources[bookId];
  annotationNotice.textContent = "本书注释含机器识别内容，尚未全部逐字复核；面板标明核对状态。对应不明的注释不显示。";
  activeIndex = index;
  const chapter = chapters[index];
  chapterTitle.textContent = chapter.title;
  chapterContent.replaceChildren();
  const links = chapterList.querySelectorAll(".chapter-link");
  links.forEach((link, i) => link.setAttribute("aria-current", i === index ? "page" : "false"));
  document.querySelector("#previous-chapter").disabled = index === 0;
  document.querySelector("#next-chapter").disabled = index === chapters.length - 1;

  let content = chapter;
  try {
    if (chapter.file) {
      readerPosition.textContent = `${index + 1} / ${chapters.length} · 正在加载`;
      const response = await fetch(chapter.file, { cache: "no-store" });
      if (!response.ok) throw new Error("无法读取章节正文");
      content = await response.json();
    }
  } catch {
    if (requestId !== chapterRequestId) return;
    const message = document.createElement("p");
    message.textContent = "这一节暂时无法加载，请稍后重试。";
    chapterContent.replaceChildren(message);
    readerPosition.textContent = `${index + 1} / ${chapters.length} · 加载失败`;
    return;
  }

  if (requestId !== chapterRequestId) return;
  chapterTitle.textContent = content.title || chapter.title;
  const sourceParagraphs = content.paragraphs || [];
  for (const paragraph of sourceParagraphs) chapterContent.append(renderParagraph(paragraph));
  readerPosition.textContent = `${index + 1} / ${chapters.length}`;
  chapterContent.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
  // Show the full chapter immediately; optional notes must not delay reading.
  loadBookAnnotations(bookId).then(annotationData => {
    if (requestId !== chapterRequestId || activeBook?.id !== bookId || readerView.hidden) return;
    if (!annotationData && bookAnnotationSources[bookId]) annotationNotice.textContent = "注释暂时无法加载，正文仍可正常阅读。重新进入本书可重试；注释中的机器识别内容尚未全部复核。";
    const annotations = prepareChapterAnnotations(bookId, index, content.title || chapter.title, sourceParagraphs, annotationData);
    for (const [paragraphIndex, annotation] of annotations) {
      chapterContent.children[paragraphIndex]?.replaceWith(renderParagraph(sourceParagraphs[paragraphIndex], annotation));
    }
  });
}

const bookAnnotationSources = {
  "western-philosophy-history-upper": "books/western-philosophy-history-upper/annotations.json",
  "western-philosophy-history-lower": "books/western-philosophy-history-lower/annotations.json"
};
const annotationCache = new Map();
const annotationStatusLabels = {
  scan_verified: "扫描核对",
  predicted_orthography_only: "机器识别 · 仅字形预测（未逐字复核）",
  raw_ocr_unreviewed: "机器识别 · 未经复核"
};

async function loadBookAnnotations(bookId) {
  const source = bookAnnotationSources[bookId];
  if (!source) return null;
  if (!annotationCache.has(bookId)) {
    annotationCache.set(bookId, fetch(source, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("无法读取注释数据");
      return response.json();
    }));
  }
  try {
    return await annotationCache.get(bookId);
  } catch {
    // A failed annotation request must leave the complete original text readable.
    annotationCache.delete(bookId);
    return null;
  }
}

function prepareChapterAnnotations(bookId, chapterIndex, chapterTitle, paragraphs, data) {
  const references = new Map();
  if (data?.version !== 2 || data.bookId !== bookId || data.source?.anchorOffsets !== "utf16" || !data.notes || typeof data.notes !== "object") return references;
  const chapter = data.chapters?.[chapterIndex];
  if (chapter?.title !== chapterTitle || !Array.isArray(chapter.paragraphs)) return references;
  const identifiers = new Map(), indices = new Map();
  for (const record of chapter.paragraphs) {
    for (const id of [record?.id, ...(Array.isArray(record?.references) ? record.references.map(ref => ref?.id) : [])]) identifiers.set(id, (identifiers.get(id) || 0) + 1);
    indices.set(record?.index, (indices.get(record?.index) || 0) + 1);
  }
  const safeId = id => typeof id === "string" && /^[a-z][a-z0-9-]*$/u.test(id) && identifiers.get(id) === 1;
  for (const record of chapter.paragraphs) {
    if (!record || !safeId(record.id) || !Number.isInteger(record.index) || record.index < 0 || indices.get(record.index) !== 1) continue;
    const paragraph = paragraphs[record.index];
    if (typeof paragraph !== "string" || paragraph !== record.expectedText || !Array.isArray(record.references) || !record.references.length) continue;
    const bound = [], positions = new Set(); let cursor = 0;
    for (const ref of record.references) {
      const note = ref && Object.hasOwn(data.notes, ref.noteId) ? data.notes[ref.noteId] : null;
      if (!ref || !safeId(ref.id) || !note || !Object.hasOwn(annotationStatusLabels, note.textStatus) || typeof note.text !== "string" || !note.text.trim()) break;
      if (!Number.isInteger(ref.start) || !Number.isInteger(ref.end) || ref.start < cursor || ref.end < ref.start || ref.end > paragraph.length) break;
      if (typeof ref.expectedText !== "string" || paragraph.slice(ref.start, ref.end) !== ref.expectedText || !/^[①-⑳*]$/u.test(ref.marker)) break;
      if (typeof ref.prefix !== "string" || typeof ref.suffix !== "string" || !(ref.prefix || ref.suffix)) break;
      if (!paragraph.slice(0, ref.start).endsWith(ref.prefix) || !paragraph.slice(ref.end).startsWith(ref.suffix)) break;
      const position = `${ref.start}:${ref.end}`;
      if (positions.has(position)) break;
      positions.add(position);
      bound.push({ ...ref, note }); cursor = ref.end;
    }
    // Reject the complete paragraph on conflict; repeated printed numbering
    // alone never establishes a relationship with an annotation.
    if (bound.length === record.references.length) references.set(record.index, { paragraphId: record.id, notes: bound });
  }
  return references;
}

function parseStandaloneNote(paragraph) {
  const match = paragraph.match(/^\s*(\[\s*\d{1,3}\s*\]|［\s*\d{1,3}\s*］|（\s*\d{1,3}\s*）|\(\s*\d{1,3}\s*\))\s*([\s\S]*)$/u);
  if (!match || !/(?:译者注|编者注|原注|注释|编者按)/u.test(match[2])) return null;
  return { marker: match[1].replace(/\s/g, ""), text: match[2].trim() };
}

function createAnnotationDetails(marker, text, inline = false, id = "", metadata = null) {
  const details = document.createElement("details");
  details.className = inline ? "inline-annotation" : "standalone-annotation";
  const summary = document.createElement("summary");
  summary.textContent = inline ? (metadata ? metadata.sourceText || marker : marker) : `注释 ${marker}`;
  const quality = metadata ? `，${annotationStatusLabels[metadata.textStatus]}` : "";
  summary.setAttribute("aria-label", `展开注释 ${marker}${quality}`);
  summary.setAttribute("aria-expanded", "false");
  const box = document.createElement("div");
  box.className = "annotation-box";
  if (id) {
    details.id = id;
    details.dataset.annotationId = id;
    summary.id = `${id}-reference`;
    summary.setAttribute("aria-controls", `${id}-popover`);
    box.id = `${id}-popover`;
  }
  const label = document.createElement("strong");
  label.className = "annotation-label";
  label.textContent = `注释 ${marker}`;
  const content = document.createElement("span");
  content.className = "annotation-text";
  content.textContent = text;
  box.append(label);
  if (metadata) {
    details.dataset.noteId = metadata.noteId;
    details.dataset.textStatus = metadata.textStatus;
    details.dataset.sourceText = metadata.sourceText;
    const status = document.createElement("span");
    status.className = "annotation-status";
    status.textContent = `${annotationStatusLabels[metadata.textStatus]} · 原扫描第 ${metadata.sourcePdfPage} 页`;
    box.append(status);
    if (metadata.sourceText !== marker) {
      const context = document.createElement("p"); context.className = "annotation-anchor-status";
      context.textContent = metadata.sourceText ? `网页原标号“${metadata.sourceText}”与扫描标号“${marker}”不同，此处保留网页原文。` : "网页此处缺少注号，按扫描核对记录补充注释入口。";
      box.append(context);
    }
  }
  box.append(content);
  if (metadata?.rawText) {
    const raw = document.createElement("details"), heading = document.createElement("summary"), copy = document.createElement("pre");
    raw.className = "annotation-raw"; heading.textContent = "查看原始 OCR"; copy.textContent = metadata.rawText;
    raw.append(heading, copy); box.append(raw);
    raw.addEventListener("toggle", () => { if (details.open) positionInlineAnnotation(details); });
  }
  if (inline) {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "annotation-close";
    close.textContent = "收起注释";
    close.setAttribute("aria-label", `关闭注释 ${marker}`);
    close.addEventListener("click", () => {
      details.open = false;
      summary.focus({ preventScroll: true });
    });
    box.append(close);
  }
  details.append(summary, box);
  details.addEventListener("toggle", () => {
    summary.setAttribute("aria-expanded", String(details.open));
    summary.setAttribute("aria-label", `${details.open ? "收起" : "展开"}注释 ${marker}${quality}`);
    if (!details.open || !inline) return;
    chapterContent.querySelectorAll(".inline-annotation[open]").forEach(other => {
      if (other !== details) other.open = false;
    });
    positionInlineAnnotation(details);
  });
  return details;
}

function positionInlineAnnotation(details) {
  const rect = details.getBoundingClientRect();
  const box = details.querySelector(".annotation-box");
  if (!box) return;
  const size = box.getBoundingClientRect();
  const edge = 12;
  const gap = 8;
  // On mobile, initial popup overflow can temporarily enlarge innerWidth.
  // Use the layout viewport so clamping cannot accept that overflow as space.
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const left = Math.max(edge, Math.min(rect.left, viewportWidth - size.width - edge));
  let top = rect.bottom + gap;
  if (top + size.height > viewportHeight - edge) top = rect.top - size.height - gap;
  top = Math.max(edge, Math.min(top, viewportHeight - size.height - edge));
  details.style.setProperty("--annotation-left", `${left}px`);
  details.style.setProperty("--annotation-top", `${top}px`);
}

window.addEventListener("resize", () => {
  const openAnnotation = chapterContent.querySelector(".inline-annotation[open]");
  if (openAnnotation) positionInlineAnnotation(openAnnotation);
});
window.addEventListener("scroll", () => {
  const openAnnotation = chapterContent.querySelector(".inline-annotation[open]");
  if (openAnnotation) positionInlineAnnotation(openAnnotation);
}, { passive: true });

function appendParagraphWithAnnotations(paragraph, body, annotations) {
  let cursor = 0;
  for (const note of annotations) {
    appendInlineEditorialNotes(paragraph, body.slice(cursor, note.start));
    paragraph.append(createAnnotationDetails(note.marker, note.note.text, true, note.id, { ...note.note, noteId: note.noteId, sourceText: note.expectedText }));
    cursor = note.end;
  }
  appendInlineEditorialNotes(paragraph, body.slice(cursor));
}

const inlineEditorialNotePattern = /[（(]([^（）()]{1,300}?(?:注[：:]|(?:译者|编者|原)注)[^（）()]{0,260}?)[）)]/gu;

function appendInlineEditorialNotes(paragraph, text) {
  let cursor = 0;
  for (const match of text.matchAll(inlineEditorialNotePattern)) {
    paragraph.append(document.createTextNode(text.slice(cursor, match.index)));
    const label = match[1].match(/(?:译者注|编者注|原注|注[：:])/u)?.[0] || "注";
    const details = createAnnotationDetails(label.replace(/[：:]/u, ""), match[1].trim(), true);
    details.dataset.sourceText = match[0];
    paragraph.append(details);
    cursor = match.index + match[0].length;
  }
  paragraph.append(document.createTextNode(text.slice(cursor)));
}

function renderParagraph(value, chapterAnnotations = null) {
  let paragraph = document.createElement(chapterAnnotations?.notes.length ? "div" : "p");
  const text = typeof value === "string" ? value : String(value?.text || "");
  const standaloneNote = parseStandaloneNote(text);
  if (standaloneNote) {
    const details = createAnnotationDetails(standaloneNote.marker, standaloneNote.text);
    details.dataset.sourceText = text;
    return details;
  }

  if (chapterAnnotations?.notes.length) {
    paragraph.id = chapterAnnotations.paragraphId;
    paragraph.className = "reading-paragraph";
    paragraph.setAttribute("role", "paragraph");
    appendParagraphWithAnnotations(paragraph, text, chapterAnnotations.notes);
  } else appendInlineEditorialNotes(paragraph, text);
  if (paragraph.tagName === "P" && paragraph.querySelector(".inline-annotation")) {
    const container = document.createElement("div"); container.className = "reading-paragraph"; container.setAttribute("role", "paragraph");
    container.append(...paragraph.childNodes); paragraph = container;
  }
  return paragraph;
}

search.addEventListener("input", () => {
  filterBooks();
});

contentsToggle.addEventListener("click", () => {
  setContentsCollapsed(contentsToggle.getAttribute("aria-expanded") === "true");
  if (!desktopReader.matches && !document.body.classList.contains("reader-contents-open")) setReaderControlsVisible(true, true);
});

function closeContentsDrawer() {
  setContentsCollapsed(true);
  setReaderControlsVisible(true, true);
  contentsToggle.focus({ preventScroll: true });
}
document.querySelector("#close-contents").addEventListener("click", closeContentsDrawer);
contentsBackdrop.addEventListener("click", closeContentsDrawer);

readingPage.addEventListener("pointerdown", event => {
  readingPointer = { x: event.clientX, y: event.clientY, time: Date.now() };
});
readingPage.addEventListener("pointercancel", () => { readingPointer = { cancelled: true }; });
readingPage.addEventListener("click", event => {
  const pointer = readingPointer;
  readingPointer = null;
  if (desktopReader.matches || readerView.hidden || event.target.closest("button, details, summary, a, input, select, label") || window.getSelection()?.toString()) return;
  if (pointer && (pointer.cancelled || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 12 || Date.now() - pointer.time > 600)) return;
  setReaderControlsVisible(!readerView.classList.contains("controls-visible"), true);
});

fontSettings.addEventListener("toggle", () => {
  if (!desktopReader.matches && !readerView.hidden && readerView.classList.contains("controls-visible")) {
    setReaderControlsVisible(true, !fontSettings.open);
  }
});

readerView.addEventListener("keydown", event => {
  if (desktopReader.matches || event.key !== "Tab") return;
  if (document.body.classList.contains("reader-contents-open")) {
    const buttons = [...contentsPanel.querySelectorAll("button:not([disabled])")];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && (document.activeElement === first || !contentsPanel.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !contentsPanel.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  } else if (!readerView.classList.contains("controls-visible") && !event.target.closest(".inline-annotation[open]")) {
    event.preventDefault();
    setReaderControlsVisible(true);
    document.querySelector("#back-button").focus({ preventScroll: true });
  }
});

document.querySelectorAll("button[data-reading-font]").forEach(button => {
  button.addEventListener("click", () => applyReadingFont(button.dataset.readingFont, true));
});

readingSizeInput.addEventListener("input", () => applyReadingSize(readingSizeInput.value, true));
resetReadingSize.addEventListener("click", () => applyReadingSize(null, true));

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const openAnnotation = chapterContent.querySelector(".inline-annotation[open]");
  if (openAnnotation) {
    openAnnotation.open = false;
    openAnnotation.querySelector("summary")?.focus({ preventScroll: true });
    event.preventDefault();
  } else if (!desktopReader.matches && !readerView.hidden) {
    if (document.body.classList.contains("reader-contents-open")) closeContentsDrawer();
    else if (fontSettings.open) fontSettings.open = false;
    else {
      setReaderControlsVisible(false);
      chapterContent.focus({ preventScroll: true });
    }
    event.preventDefault();
  }
});

document.addEventListener("click", event => {
  chapterContent.querySelectorAll(".inline-annotation[open]").forEach(annotation => {
    if (!annotation.contains(event.target)) annotation.open = false;
  });
});

desktopReader.addEventListener("change", () => {
  setReaderControlsVisible(false);
  setContentsCollapsed(!desktopReader.matches);
  if (!hasCustomReadingSize) updateReadingSizeDisplay(getComputedStyle(chapterContent).fontSize);
});

document.querySelector("#back-button").addEventListener("click", () => {
  readerView.hidden = true;
  document.body.classList.remove("reading-active", "reader-contents-open");
  setContentsCollapsed(true);
  setReaderControlsVisible(false);
  shelfView.hidden = false;
  document.querySelector("#shelf-tools").hidden = false;
  history.replaceState(null, "", location.pathname);
  // Return focus to a non-editable control, never summon the mobile keyboard.
  const returnTarget = activeBookTrigger?.isConnected ? activeBookTrigger : document.querySelector(".brand");
  returnTarget.focus({ preventScroll: true });
});

// Do not restore an editing session when returning through browser history.
// Explicit taps and keyboard navigation can still focus search normally.
window.addEventListener("pagehide", () => {
  if (document.activeElement === search) search.blur();
});
window.addEventListener("pageshow", event => {
  if (event.persisted && document.activeElement === search) search.blur();
});
document.querySelector("#previous-chapter").addEventListener("click", () => showChapter(activeIndex - 1));
document.querySelector("#next-chapter").addEventListener("click", () => showChapter(activeIndex + 1));

loadBooks().catch(() => {
  document.querySelector("#empty-state").hidden = false;
});

