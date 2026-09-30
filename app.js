const search = document.querySelector("#book-search");
const bookList = document.querySelector("#book-list");
const shelfView = document.querySelector("#shelf-view");
const readerView = document.querySelector("#reader-view");
const readerTitle = document.querySelector("#reading-book-title");
const chapterList = document.querySelector("#chapter-list");
const chapterTitle = document.querySelector("#chapter-title");
const chapterContent = document.querySelector("#chapter-content");
const readerPosition = document.querySelector("#reader-position");
let books = [];
let chapters = [];
let activeIndex = 0;
let activeBook = null;

async function loadBooks() {
  const response = await fetch("book-index.json");
  if (!response.ok) throw new Error("无法读取书目数据");
  const data = await response.json();
  books = data.books || [];
  renderBooks(books);
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
    button.textContent = book.chapterCount ? "开始阅读" : "正文整理中";
    button.disabled = !book.chapterCount;
    if (book.chapterCount) button.addEventListener("click", () => openBook(book));
    footer.append(button);
    card.append(category, title, author, footer);
    bookList.append(card);
  }
}

async function openBook(book) {
  const response = await fetch(`books/${encodeURIComponent(book.id)}/chapters.json`);
  if (!response.ok) return;
  const data = await response.json();
  activeBook = book;
  chapters = data.chapters || [];
  activeIndex = 0;
  shelfView.hidden = true;
  readerView.hidden = false;
  document.querySelector("#shelf-tools").hidden = true;
  readerTitle.textContent = `${book.title} · ${book.author}`;
  renderChapterList();
  showChapter(0);
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

function showChapter(index) {
  if (!chapters[index]) return;
  activeIndex = index;
  const chapter = chapters[index];
  chapterTitle.textContent = chapter.title;
  chapterContent.replaceChildren();
  for (const paragraph of chapter.paragraphs || []) {
    const p = document.createElement("p");
    p.textContent = paragraph;
    chapterContent.append(p);
  }
  const links = chapterList.querySelectorAll(".chapter-link");
  links.forEach((link, i) => link.setAttribute("aria-current", i === index ? "page" : "false"));
  readerPosition.textContent = `${index + 1} / ${chapters.length}`;
  document.querySelector("#previous-chapter").disabled = index === 0;
  document.querySelector("#next-chapter").disabled = index === chapters.length - 1;
  chapterContent.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

search.addEventListener("input", () => {
  const query = search.value.trim().toLocaleLowerCase();
  renderBooks(books.filter(book => `${book.title} ${book.author} ${book.category}`.toLocaleLowerCase().includes(query)));
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
