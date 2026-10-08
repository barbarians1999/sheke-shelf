const search = document.querySelector("#book-search");
const bookList = document.querySelector("#book-list");
const categoryFilters = document.querySelector("#category-filters");
const shelfView = document.querySelector("#shelf-view");
const readerView = document.querySelector("#reader-view");
const readerTitle = document.querySelector("#reading-book-title");
const chapterList = document.querySelector("#chapter-list");
const readerLayout = document.querySelector("#reader-layout");
const contentsToggle = document.querySelector("#toggle-contents");
const desktopReader = window.matchMedia("(min-width: 721px)");
const chapterTitle = document.querySelector("#chapter-title");
const chapterContent = document.querySelector("#chapter-content");
const readerPosition = document.querySelector("#reader-position");
const readingFontKey = "sheke-reading-font:v1";
let books = [];
let chapters = [];
let activeIndex = 0;
let activeBook = null;
let activeCategory = "";
let chapterRequestId = 0;

function applyReadingFont(font, persist = false) {
  const selected = ["hanyi", "fangsong"].includes(font) ? font : "";
  if (selected) document.documentElement.dataset.readingFont = selected;
  else delete document.documentElement.dataset.readingFont;
  document.querySelectorAll("[data-reading-font]").forEach(button => {
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

function renderBooks(items) {
  bookList.replaceChildren();
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
    button.addEventListener("click", () => openBook(book));
    footer.append(button);
    card.append(category, title, author, footer);
    bookList.append(card);
  }
}

async function openBook(book) {
  const chapterSource = book.chapterManifest || `books/${encodeURIComponent(book.id)}/chapters.json`;
  const response = await fetch(chapterSource, { cache: "no-store" });
  if (!response.ok) return;
  const data = await response.json();
  activeBook = book;
  chapters = data.chapters || [];
  activeIndex = 0;
  setContentsCollapsed(false);
  shelfView.hidden = true;
  readerView.hidden = false;
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
    button.addEventListener("click", () => showChapter(index));
    chapterList.append(button);
  });
}

function setContentsCollapsed(collapsed) {
  const shouldCollapse = collapsed && desktopReader.matches;
  readerLayout.classList.toggle("is-contents-collapsed", shouldCollapse);
  chapterList.hidden = shouldCollapse;
  contentsToggle.setAttribute("aria-expanded", String(!shouldCollapse));
  contentsToggle.textContent = shouldCollapse ? "展开目录" : "收起目录";
}

async function showChapter(index) {
  if (!chapters[index]) return;
  const requestId = ++chapterRequestId;
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
  for (const paragraph of content.paragraphs || []) chapterContent.append(renderParagraph(paragraph));
  readerPosition.textContent = `${index + 1} / ${chapters.length}`;
  chapterContent.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const circledNotePattern = /[\u2460-\u2473]/gu;
const circledNotes = Array.from("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳");

function extractBettelheimNotes(paragraph) {
  const occurrences = [...paragraph.matchAll(circledNotePattern)];
  if (!occurrences.length) return null;

  for (const candidate of occurrences) {
    if (candidate.index < paragraph.length * 0.55) continue;
    if (!paragraph.slice(0, candidate.index).includes(candidate[0])) continue;
    if (!/^\s/u.test(paragraph.slice(candidate.index + candidate[0].length))) continue;

    const tail = paragraph.slice(candidate.index);
    const noteMarkers = [...tail.matchAll(circledNotePattern)];
    const order = noteMarkers.map(marker => circledNotes.indexOf(marker[0]));
    if (order.some((value, index) => value < 0 || (index > 0 && value <= order[index - 1]))) continue;
    if (noteMarkers.some(marker => !paragraph.slice(0, candidate.index).includes(marker[0]))) continue;

    const annotations = noteMarkers.map((marker, index) => ({
      marker: marker[0],
      text: tail.slice(marker.index + marker[0].length, noteMarkers[index + 1]?.index ?? tail.length).trim()
    }));
    if (annotations.some(note => !note.text)) continue;
    return { body: paragraph.slice(0, candidate.index).trimEnd(), annotations };
  }
  return null;
}

function parseStandaloneNote(paragraph) {
  const match = paragraph.match(/^\s*(\[\s*\d{1,3}\s*\]|［\s*\d{1,3}\s*］|（\s*\d{1,3}\s*）|\(\s*\d{1,3}\s*\))\s*([\s\S]*)$/u);
  if (!match || !/(?:译者注|编者注|原注|注释|编者按)/u.test(match[2])) return null;
  return { marker: match[1].replace(/\s/g, ""), text: match[2].trim() };
}

function createAnnotationDetails(marker, text, inline = false) {
  const details = document.createElement("details");
  details.className = inline ? "inline-annotation" : "standalone-annotation";
  const summary = document.createElement("summary");
  summary.textContent = inline ? marker : `注释 ${marker}`;
  summary.setAttribute("aria-label", `展开注释 ${marker}`);
  const box = document.createElement("span");
  box.className = "annotation-box";
  const label = document.createElement("strong");
  label.className = "annotation-label";
  label.textContent = `注释 ${marker}`;
  const content = document.createElement("span");
  content.textContent = text;
  box.append(label, content);
  details.append(summary, box);
  details.addEventListener("toggle", () => {
    if (!details.open || !inline) return;
    const rect = details.getBoundingClientRect();
    details.classList.toggle("opens-left", rect.left > window.innerWidth * 0.58);
  });
  return details;
}

function appendParagraphWithAnnotations(paragraph, body, annotations) {
  const notes = new Map(annotations.map(note => [note.marker, note.text]));
  let cursor = 0;
  for (const match of body.matchAll(circledNotePattern)) {
    const note = notes.get(match[0]);
    if (!note) continue;
    paragraph.append(document.createTextNode(body.slice(cursor, match.index)));
    paragraph.append(createAnnotationDetails(match[0], note, true));
    cursor = match.index + match[0].length;
  }
  paragraph.append(document.createTextNode(body.slice(cursor)));
}

const inlineEditorialNotePattern = /[（(]([^（）()]{1,300}?(?:注[：:]|(?:译者|编者|原)注)[^（）()]{0,260}?)[）)]/gu;

function appendInlineEditorialNotes(paragraph, text) {
  let cursor = 0;
  let found = false;
  for (const match of text.matchAll(inlineEditorialNotePattern)) {
    found = true;
    paragraph.append(document.createTextNode(text.slice(cursor, match.index)));
    const label = match[1].match(/(?:译者注|编者注|原注|注[：:])/u)?.[0] || "注";
    paragraph.append(createAnnotationDetails(label.replace(/[：:]/u, ""), match[1].trim(), true));
    cursor = match.index + match[0].length;
  }
  if (!found) {
    paragraph.textContent = text;
    return;
  }
  paragraph.append(document.createTextNode(text.slice(cursor)));
}

function renderParagraph(value) {
  const paragraph = document.createElement("p");
  const text = typeof value === "string" ? value : String(value?.text || "");
  const standaloneNote = parseStandaloneNote(text);
  if (standaloneNote) return createAnnotationDetails(standaloneNote.marker, standaloneNote.text);

  const annotations = activeBook?.id === "bettelheim-industrial-organization"
    ? extractBettelheimNotes(text)
    : null;
  if (annotations) appendParagraphWithAnnotations(paragraph, annotations.body, annotations.annotations);
  else appendInlineEditorialNotes(paragraph, text);
  return paragraph;
}

search.addEventListener("input", () => {
  filterBooks();
});

contentsToggle.addEventListener("click", () => {
  setContentsCollapsed(contentsToggle.getAttribute("aria-expanded") === "true");
});

document.querySelectorAll("[data-reading-font]").forEach(button => {
  button.addEventListener("click", () => applyReadingFont(button.dataset.readingFont, true));
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const openAnnotation = chapterContent.querySelector(".inline-annotation[open]");
  if (!openAnnotation) return;
  openAnnotation.open = false;
  openAnnotation.querySelector("summary")?.focus({ preventScroll: true });
  event.preventDefault();
});

desktopReader.addEventListener("change", event => {
  if (!event.matches) setContentsCollapsed(false);
});

document.querySelector("#back-button").addEventListener("click", () => {
  readerView.hidden = true;
  shelfView.hidden = false;
  document.querySelector("#shelf-tools").hidden = false;
  history.replaceState(null, "", location.pathname);
  search.focus();
});
document.querySelector("#previous-chapter").addEventListener("click", () => showChapter(activeIndex - 1));
document.querySelector("#next-chapter").addEventListener("click", () => showChapter(activeIndex + 1));

loadBooks().catch(() => {
  document.querySelector("#empty-state").hidden = false;
});
