const TOKEN_KEY = "datanova-admin-token";
const BACKUP_KEY = "datanova-admin-backup";

const CATEGORIES = [
  { id: "briefing", label: "Тойм" },
  { id: "report", label: "Тайлан" },
  { id: "dataset", label: "Өгөгдөл" },
  { id: "guide", label: "Заавар" },
  { id: "pptx", label: "PPT загвар" },
];

const STATUS_LABEL = {
  awaiting_payment: "Төлбөр хүлээгдэж байна",
  paid: "Төлсөн",
  sent: "Файл илгээсэн",
  cancelled: "Цуцалсан",
};

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || "",
  tab: "orders",
  orders: [],
  products: [],
  store: null,
  editing: null,
  error: "",
  notice: "",
  loginError: "",
  audience: [],
};

function money(n) {
  return `₮ ${Number(n).toLocaleString("mn-MN")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function lines(list) {
  return (list || []).join("\n");
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers["X-Admin-Token"] = state.token;
  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    state.token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    state.loginError = "Нэвтрэлт дууссан. Дахин нэвтэрнэ үү.";
    throw new Error("auth");
  }
  if (!res.ok) throw new Error(body.error || `http_${res.status}`);
  return body;
}

function render() {
  const root = document.getElementById("admin");
  if (!state.token) {
    root.innerHTML = `
      <main class="wrap admin-login">
        <p class="kicker">Удирдлага</p>
        <h1>DataNova</h1>
        <p class="lede">Энд <strong>ADMIN_PASSWORD</strong> гэж бичихгүй. Render дээрх тэр нэрийн <strong>утгыг</strong> хуулна.</p>
        <form id="login-form" class="buy-box" method="post" action="#">
          <label>Нууц үг<input name="password" type="password" required autocomplete="current-password" spellcheck="false"></label>
          <p class="form-error">${escapeHtml(state.loginError)}</p>
          <button class="btn wide" type="button" data-action="login">Нэвтрэх</button>
        </form>
        <p class="muted" style="margin-top:16px">Render → datanova → Environment → ADMIN_PASSWORD → Value-г бүтнээр хуул. Эсвэл тэр утгыг өөрийн энгийн нууц үгээр соль.</p>
        <p class="muted" style="margin-top:16px"><a href="/">Дэлгүүр рүү</a></p>
      </main>
    `;
    return;
  }

  root.innerHTML = `
    <header class="site-header">
      <div class="wrap header-row">
        <a class="brand" href="/admin">
          <span class="mark">D</span>
          <span>
            <span class="brand-name">DataNova</span>
            <span class="brand-sub">Удирдлага</span>
          </span>
        </a>
        <div class="header-actions">
          <a href="/">Дэлгүүр</a>
          <button class="btn ghost" type="button" data-action="logout">Гарах</button>
        </div>
      </div>
    </header>
    <main class="wrap admin-main">
      <nav class="chips admin-tabs">
        <button class="chip ${state.tab === "orders" ? "on" : ""}" data-tab="orders">Захиалга</button>
        <button class="chip ${state.tab === "products" ? "on" : ""}" data-tab="products">Тайлан, судалгаа</button>
        <button class="chip ${state.tab === "store" ? "on" : ""}" data-tab="store">Дэлгүүр, данс</button>
      </nav>
      ${state.notice ? `<p class="admin-notice">${escapeHtml(state.notice)}</p>` : ""}
      ${state.error ? `<p class="form-error">${escapeHtml(state.error)}</p>` : ""}
      ${state.tab === "orders" ? viewOrders() : ""}
      ${state.tab === "products" ? viewProducts() : ""}
      ${state.tab === "store" ? viewStore() : ""}
    </main>
  `;
}

function viewOrders() {
  if (!state.orders.length) {
    return `<div class="empty"><h2>Захиалга алга</h2><p class="muted">Хүн захиалахад энд гарна.</p></div>`;
  }
  return state.orders.map((order) => `
    <article class="order-card admin-order">
      <div class="admin-order-head">
        <div>
          <strong>${escapeHtml(order.id)}</strong>
          <div class="muted">${escapeHtml((order.createdAt || "").slice(0, 16).replace("T", " "))} · ${money(order.total)}</div>
        </div>
        <span class="pill">${escapeHtml(STATUS_LABEL[order.status] || order.status)}</span>
      </div>
      <p>
        ${escapeHtml(order.buyer?.name || "")} ·
        <a href="mailto:${escapeAttr(order.buyer?.email || "")}">${escapeHtml(order.buyer?.email || "")}</a> ·
        ${escapeHtml(order.buyer?.phone || "")}
        ${order.buyer?.org ? ` · ${escapeHtml(order.buyer.org)}` : ""}
      </p>
      <ul class="list">${(order.items || []).map((item) => `<li>${escapeHtml(item.title)} — ${money(item.price)}</li>`).join("")}</ul>
      ${order.note ? `<p class="muted">Тэмдэглэл: ${escapeHtml(order.note)}</p>` : ""}
      <div class="admin-actions">
        <button type="button" data-status="${escapeAttr(order.id)}:paid">Төлсөн</button>
        <button type="button" data-status="${escapeAttr(order.id)}:sent">Илгээсэн</button>
        <button type="button" data-status="${escapeAttr(order.id)}:awaiting_payment">Хүлээгдэж байна</button>
        <button type="button" data-status="${escapeAttr(order.id)}:cancelled">Цуцлах</button>
      </div>
    </article>
  `).join("");
}

function viewProducts() {
  const editor = state.editing ? productForm(state.editing) : "";
  const rows = state.products.map((p) => `
    <div class="line admin-product-row">
      <div>
        <strong>${escapeHtml(p.title)}</strong>
        <div class="muted">${escapeHtml(p.sku)} · ${money(p.price)} · ${p.published === false ? "Нуусан" : "Дэлгүүрт гарсан"}</div>
      </div>
      <button class="linkish" type="button" data-edit="${escapeAttr(p.id)}">Засах</button>
      <button class="linkish" type="button" data-delete="${escapeAttr(p.id)}">Устгах</button>
    </div>
  `).join("");
  return `
    <div class="notice" style="margin:0 0 16px">
      <strong>Та өөрөө удирдана.</strong>
      Шинэ тайлан нэмэх — доорх товч. Засах эсвэл устгах — мөр бүрийн баруун талд.
      «Дэлгүүрт харагдуулах»-ыг авбал сайт дээрээс нуугдана, устгахгүй.
    </div>
    <div class="admin-toolbar">
      <button class="btn" type="button" data-action="new-product">+ Шинэ тайлан нэмэх</button>
    </div>
    ${editor || `<div class="buy-box">${rows || `<p class="muted">Тайлан алга. Дээрээс нэмнэ үү.</p>`}</div>`}
  `;
}

function productForm(p) {
  return `
    <form id="product-form" class="buy-box" style="margin-bottom:18px" method="post" action="#">
      <input type="hidden" name="id" value="${escapeAttr(p.id || "")}">
      <h2>${p.id ? "Тайлан засах" : "Шинэ тайлан"}</h2>
      <label>Нэр (MN)<input name="title" required value="${escapeAttr(p.title || "")}"></label>
      <label>Name (EN)<input name="titleEn" value="${escapeAttr(p.titleEn || "")}"></label>
      <label>Дэд гарчиг (MN)<input name="subtitle" value="${escapeAttr(p.subtitle || "")}"></label>
      <label>Subtitle (EN)<input name="subtitleEn" value="${escapeAttr(p.subtitleEn || "")}"></label>
      <div class="split">
        <label>Төрөл
          <select name="category">${CATEGORIES.map((c) => `<option value="${c.id}" ${p.category === c.id ? "selected" : ""}>${c.label}</option>`).join("")}</select>
        </label>
        <label>Үнэ (₮)<input name="price" type="number" min="0" required value="${escapeAttr(p.price ?? "")}"></label>
      </div>
      <div class="split">
        <label>Хуудас<input name="pages" type="number" min="0" value="${escapeAttr(p.pages ?? 0)}"></label>
        <label>Формат<input name="formats" value="${escapeAttr((p.formats || []).join(", "))}" placeholder="PDF, Excel"></label>
      </div>
      <label>Товч (MN)<input name="excerpt" value="${escapeAttr(p.excerpt || "")}"></label>
      <label>Excerpt (EN)<input name="excerptEn" value="${escapeAttr(p.excerptEn || "")}"></label>
      <label>Тайлбар (MN)<textarea name="description" rows="4">${escapeHtml(p.description || "")}</textarea></label>
      <label>Description (EN)<textarea name="descriptionEn" rows="4">${escapeHtml(p.descriptionEn || "")}</textarea></label>
      <label>Багтана (MN)<textarea name="includes" rows="4">${escapeHtml(lines(p.includes))}</textarea></label>
      <label>Included (EN)<textarea name="includesEn" rows="4">${escapeHtml(lines(p.includesEn))}</textarea></label>
      <label>Багтахгүй (MN)<textarea name="notIncludes" rows="3">${escapeHtml(lines(p.notIncludes))}</textarea></label>
      <label>Not included (EN)<textarea name="notIncludesEn" rows="3">${escapeHtml(lines(p.notIncludesEn))}</textarea></label>
      <label>Хэнд (MN)<textarea name="audience" rows="2">${escapeHtml(lines(p.audience))}</textarea></label>
      <label>Audience (EN)<textarea name="audienceEn" rows="2">${escapeHtml(lines(p.audienceEn))}</textarea></label>
      <label>Агуулга (MN)<textarea name="toc" rows="3">${escapeHtml(lines(p.toc))}</textarea></label>
      <label>Contents (EN)<textarea name="tocEn" rows="3">${escapeHtml(lines(p.tocEn))}</textarea></label>
      <label>Урьдчилсан уншлага (MN)<textarea name="preview" rows="3">${escapeHtml(lines(p.preview))}</textarea></label>
      <label>Preview (EN)<textarea name="previewEn" rows="3">${escapeHtml(lines(p.previewEn))}</textarea></label>
      <h3>Жишээ зураг (2–3)</h3>
      <p class="muted">Худалдан авагч юу авч байгаагаа харна. Файл хуулах эсвэл зургийн холбоос тавина.</p>
      <div class="img-slots">
        ${[0, 1, 2].map((index) => {
          const src = (p.images || [])[index];
          return `
            <div class="img-slot">
              ${src
                ? `<img src="${escapeAttr(src)}" alt=""><button type="button" class="linkish" data-img-remove="${index}">Хасах</button>`
                : `<span class="muted">${index + 1}-р зураг</span>`}
            </div>`;
        }).join("")}
      </div>
      <div class="split">
        <label>Файл хуулах<input id="img-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
        <label>Эсвэл холбоос<input id="img-url" type="url" placeholder="https://..."></label>
      </div>
      <button class="btn ghost" type="button" data-action="add-img-url">Холбоос нэмэх</button>
      <label class="check"><input type="checkbox" name="featured" ${p.featured ? "checked" : ""}><span>Нүүр хуудсанд онцлох</span></label>
      <label class="check"><input type="checkbox" name="published" ${p.published !== false ? "checked" : ""}><span>Дэлгүүрт харагдуулах</span></label>
      <div class="admin-actions">
        <button class="btn" type="button" data-action="save-product">Хадгалах</button>
        <button class="btn ghost" type="button" data-action="cancel-edit">Болих</button>
      </div>
    </form>
  `;
}

function viewStore() {
  const s = state.store || {};
  const b = s.bank || {};
  return `
    <form id="store-form" class="buy-box" method="post" action="#" novalidate>
      <div class="admin-savebar">
        <span>Нүүрний үг, «Хэнд зориулсан бэ» — энд дарж хадгална</span>
        <button class="btn" type="button" data-action="save-store">Хадгалах</button>
      </div>
      <label>Нэр<input name="name" required value="${escapeAttr(s.name || "")}"></label>
      <label>Уриа MN<input name="tagline" value="${escapeAttr(s.tagline || "")}"></label>
      <label>Tagline EN<input name="taglineEn" value="${escapeAttr(s.taglineEn || "")}"></label>
      <h2>Нүүр хуудасны үг · MN / EN</h2>
      <label>Дээд жижиг үг MN<input name="kicker" value="${escapeAttr(s.kicker || "")}"></label>
      <label>Kicker EN<input name="kickerEn" value="${escapeAttr(s.kickerEn || "")}"></label>
      <label>Том гарчиг MN<input name="headline" value="${escapeAttr(s.headline || "")}"></label>
      <label>Headline EN<input name="headlineEn" value="${escapeAttr(s.headlineEn || "")}"></label>
      <label>Том тайлбар MN<textarea name="description" rows="3">${escapeHtml(s.description || "")}</textarea></label>
      <label>Description EN<textarea name="descriptionEn" rows="3">${escapeHtml(s.descriptionEn || "")}</textarea></label>
      <label>Баруун талын нэмэлт үг MN<textarea name="heroAside" rows="2">${escapeHtml(s.heroAside || "")}</textarea></label>
      <label>Aside EN<textarea name="heroAsideEn" rows="2">${escapeHtml(s.heroAsideEn || "")}</textarea></label>
      <label>Онцлох тайлбар MN<input name="featuredHint" value="${escapeAttr(s.featuredHint || "")}"></label>
      <label>Featured hint EN<input name="featuredHintEn" value="${escapeAttr(s.featuredHintEn || "")}"></label>
      <label>PPT хэсгийн гарчиг MN<input name="pptTitle" value="${escapeAttr(s.pptTitle || "PPT загвар")}"></label>
      <label>PPT section title EN<input name="pptTitleEn" value="${escapeAttr(s.pptTitleEn || "")}"></label>
      <label>PPT хэсгийн тайлбар MN<textarea name="pptHint" rows="2">${escapeHtml(s.pptHint || "")}</textarea></label>
      <label>PPT section hint EN<textarea name="pptHintEn" rows="2">${escapeHtml(s.pptHintEn || "")}</textarea></label>
      <label>Доод мэдэгдэл MN<textarea name="notice" rows="2">${escapeHtml(s.notice || "")}</textarea></label>
      <label>Footer notice EN<textarea name="noticeEn" rows="2">${escapeHtml(s.noticeEn || "")}</textarea></label>
      <h2>Хэнд зориулсан бэ</h2>
      <p class="muted">Нүүрэн дээрх хайрцагнууд. Монгол болон англи үгийг хамт бичнэ.</p>
      <label>Хэсгийн гарчиг MN<input name="audienceTitle" value="${escapeAttr(s.audienceTitle || "Хэнд зориулсан бэ")}"></label>
      <label>Section title EN<input name="audienceTitleEn" value="${escapeAttr(s.audienceTitleEn || "")}"></label>
      ${(state.audience || []).map((item, index) => `
        <div class="aud-row aud-row-en">
          <label>Нэр MN<input name="aud-title-${index}" value="${escapeAttr(item.title || "")}" placeholder="Жишээ: Багш"></label>
          <label>Name EN<input name="aud-titleEn-${index}" value="${escapeAttr(item.titleEn || "")}" placeholder="e.g. Teachers"></label>
          <label>Тайлбар MN<input name="aud-text-${index}" value="${escapeAttr(item.text || "")}"></label>
          <label>Text EN<input name="aud-textEn-${index}" value="${escapeAttr(item.textEn || "")}"></label>
          <button class="linkish" type="button" data-aud-remove="${index}">Хасах</button>
        </div>
      `).join("")}
      <button class="btn ghost" type="button" data-action="aud-add">+ Хэн нэг нэмэх</button>
      <div class="admin-actions" style="margin:16px 0 28px">
        <button class="btn" type="button" data-action="save-store">Хадгалах</button>
      </div>
      <h2>Дэлгүүрийн мэдээлэл</h2>
      <label>Имэйл<input name="email" value="${escapeAttr(s.email || "")}"></label>
      <label>Утас<input name="phone" value="${escapeAttr(s.phone || "")}"></label>
      <label>Хот MN<input name="city" value="${escapeAttr(s.city || "")}"></label>
      <label>City EN<input name="cityEn" value="${escapeAttr(s.cityEn || "")}"></label>
      <label>Хүргэлтийн хугацаа MN<input name="fulfillmentHours" value="${escapeAttr(s.fulfillmentHours || "")}"></label>
      <label>Delivery time EN<input name="fulfillmentHoursEn" value="${escapeAttr(s.fulfillmentHoursEn || "")}"></label>
      <h2>Банк</h2>
      <label>Банкны нэр MN<input name="bankName" value="${escapeAttr(b.bankName || "")}"></label>
      <label>Bank name EN<input name="bankNameEn" value="${escapeAttr(b.bankNameEn || "")}"></label>
      <label>Данс<input name="account" value="${escapeAttr(b.account || "")}"></label>
      <label>Хүлээн авагч<input name="accountName" value="${escapeAttr(b.accountName || "")}"></label>
      <label>Тэмдэглэл MN<textarea name="note" rows="3">${escapeHtml(b.note || "")}</textarea></label>
      <label>Note EN<textarea name="noteEn" rows="3">${escapeHtml(b.noteEn || "")}</textarea></label>
      <button class="btn" type="button" data-action="save-store">Хадгалах</button>
    </form>
    <form id="password-form" class="buy-box" style="margin-top:16px" method="post" action="#">
      <h2>Нууц үг солих</h2>
      <label>Шинэ нууц үг<input name="password" type="password" minlength="6" required></label>
      <button class="btn ghost" type="submit">Солих</button>
    </form>
  `;
}

function writeBackup() {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({
      at: Date.now(),
      store: state.store,
      products: state.products,
    }));
  } catch {
    /* ignore */
  }
}

function readBackup() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_KEY) || "null");
  } catch {
    return null;
  }
}

async function restoreBackupToServer() {
  const backup = readBackup();
  if (!backup?.store) return false;
  await api("/api/admin/store", {
    method: "PUT",
    body: JSON.stringify(backup.store),
  });
  if (Array.isArray(backup.products) && backup.products.length) {
    await api("/api/admin/catalog", {
      method: "PUT",
      body: JSON.stringify({ products: backup.products }),
    });
  }
  return true;
}

async function loadAll() {
  const [orders, products, store] = await Promise.all([
    api("/api/admin/orders"),
    api("/api/admin/products"),
    api("/api/admin/store"),
  ]);
  state.orders = orders.orders || [];
  state.products = products.products || [];
  state.store = store.store;
  state.audience = [...(store.store?.audience || [])];
}

function readAudienceFromForm() {
  const form = document.getElementById("store-form");
  if (!form) return state.audience || [];
  const items = [];
  for (let index = 0; index < 12; index += 1) {
    const title = form.elements[`aud-title-${index}`];
    const text = form.elements[`aud-text-${index}`];
    if (!title) break;
    const titleEn = form.elements[`aud-titleEn-${index}`];
    const textEn = form.elements[`aud-textEn-${index}`];
    items.push({
      title: title.value,
      text: text ? text.value : "",
      titleEn: titleEn ? titleEn.value : "",
      textEn: textEn ? textEn.value : "",
    });
  }
  return items;
}

function saveErrorMessage(err) {
  const code = String(err?.message || err || "");
  if (code === "auth" || code === "password") return "Нэвтрэлт дууссан. Дахин нэвтэрнэ үү.";
  if (code === "email") return "Имэйл хаяг буруу байна.";
  if (code === "name") return "Нэрээ бичнэ үү.";
  if (code === "title") return "Тайлангийн нэрийг бичнэ үү.";
  if (code === "price") return "Үнээ зөв бичнэ үү.";
  if (code === "write_failed") return "Файл хадгалахад алдаа гарлаа.";
  if (code === "too_big") return "Зураг хэт том байна. 1.5MB-аас бага байх ёстой.";
  if (code === "type") return "Зөвхөн зураг (JPG, PNG, WEBP) оруулна.";
  return "Хадгалж чадсангүй. Дахин оролдоно уу.";
}

function mergeProductDraft() {
  const form = document.getElementById("product-form");
  if (!form) return;
  if (!state.editing) state.editing = { images: [] };
  const data = new FormData(form);
  ["title", "titleEn", "subtitle", "subtitleEn", "category", "excerpt", "excerptEn", "description", "descriptionEn", "includes", "includesEn", "notIncludes", "notIncludesEn", "audience", "audienceEn", "toc", "tocEn", "preview", "previewEn", "formats"].forEach((key) => {
    if (data.has(key)) state.editing[key] = data.get(key);
  });
  state.editing.price = data.get("price");
  state.editing.pages = data.get("pages");
  state.editing.featured = data.get("featured") === "on";
  state.editing.published = data.get("published") === "on";
  state.editing.images = state.editing.images || [];
}

async function uploadProductImage(file) {
  if (!file) return;
  if ((state.editing?.images || []).length >= 3) {
    state.error = "3-аас илүү зураг нэмэхгүй.";
    render();
    return;
  }
  mergeProductDraft();
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  try {
    const saved = await api("/api/admin/upload", {
      method: "POST",
      body: JSON.stringify({ data }),
    });
    state.editing.images = [...(state.editing.images || []), saved.url].slice(0, 3);
    state.error = "";
    state.notice = "Зураг нэмэгдлээ. Доор Хадгалах дарж баталгаажуулна.";
  } catch (err) {
    state.error = saveErrorMessage(err);
  }
  render();
}

async function saveStoreForm(form) {
  const data = new FormData(form);
  try {
    const saved = await api("/api/admin/store", {
      method: "PUT",
      body: JSON.stringify({
        name: data.get("name"),
        tagline: data.get("tagline"),
        taglineEn: data.get("taglineEn"),
        kicker: data.get("kicker"),
        kickerEn: data.get("kickerEn"),
        headline: data.get("headline"),
        headlineEn: data.get("headlineEn"),
        description: data.get("description"),
        descriptionEn: data.get("descriptionEn"),
        heroAside: data.get("heroAside"),
        heroAsideEn: data.get("heroAsideEn"),
        featuredHint: data.get("featuredHint"),
        featuredHintEn: data.get("featuredHintEn"),
        pptTitle: data.get("pptTitle"),
        pptTitleEn: data.get("pptTitleEn"),
        pptHint: data.get("pptHint"),
        pptHintEn: data.get("pptHintEn"),
        notice: data.get("notice"),
        noticeEn: data.get("noticeEn"),
        audienceTitle: data.get("audienceTitle"),
        audienceTitleEn: data.get("audienceTitleEn"),
        audience: readAudienceFromForm(),
        email: data.get("email"),
        phone: data.get("phone"),
        city: data.get("city"),
        cityEn: data.get("cityEn"),
        fulfillmentHours: data.get("fulfillmentHours"),
        fulfillmentHoursEn: data.get("fulfillmentHoursEn"),
        bank: {
          bankName: data.get("bankName"),
          bankNameEn: data.get("bankNameEn"),
          account: data.get("account"),
          accountName: data.get("accountName"),
          note: data.get("note"),
          noteEn: data.get("noteEn"),
        },
      }),
    });
    state.store = saved.store;
    state.audience = [...(saved.store.audience || [])];
    state.notice = "Хадгаллаа. Дэлгүүр хуудсыг шинэчилбэл харагдана.";
    state.error = "";
    writeBackup();
  } catch (err) {
    state.error = saveErrorMessage(err);
  }
  render();
}

async function saveProductForm(form) {
  const data = new FormData(form);
  try {
    await api("/api/admin/products", {
      method: "PUT",
      body: JSON.stringify({
        id: data.get("id"),
        title: data.get("title"),
        titleEn: data.get("titleEn"),
        subtitle: data.get("subtitle"),
        subtitleEn: data.get("subtitleEn"),
        category: data.get("category"),
        price: data.get("price"),
        pages: data.get("pages"),
        formats: data.get("formats"),
        excerpt: data.get("excerpt"),
        excerptEn: data.get("excerptEn"),
        description: data.get("description"),
        descriptionEn: data.get("descriptionEn"),
        includes: data.get("includes"),
        includesEn: data.get("includesEn"),
        notIncludes: data.get("notIncludes"),
        notIncludesEn: data.get("notIncludesEn"),
        audience: data.get("audience"),
        audienceEn: data.get("audienceEn"),
        toc: data.get("toc"),
        tocEn: data.get("tocEn"),
        preview: data.get("preview"),
        previewEn: data.get("previewEn"),
        images: state.editing?.images || [],
        featured: data.get("featured") === "on",
        published: data.get("published") === "on",
      }),
    });
    state.editing = null;
    state.notice = "Тайлан хадгалагдлаа. Дэлгүүр хуудсыг шинэчилбэл харагдана.";
    state.error = "";
    await loadAll();
    writeBackup();
  } catch (err) {
    state.error = saveErrorMessage(err);
  }
  render();
}

async function login(password) {
  const body = await api("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  state.token = body.token;
  sessionStorage.setItem(TOKEN_KEY, body.token);
  try {
    await restoreBackupToServer();
  } catch {
    /* first login or empty backup */
  }
  await loadAll();
}

document.addEventListener("submit", async (event) => {
  if (!["login-form", "store-form", "product-form", "password-form"].includes(event.target.id)) return;
  event.preventDefault();
  if (event.target.id === "login-form") {
    state.loginError = "";
    try {
      await login(new FormData(event.target).get("password"));
    } catch {
      state.loginError = "Нууц үг буруу.";
    }
    render();
    return;
  }
  if (event.target.id === "store-form") {
    event.preventDefault();
    await saveStoreForm(event.target);
    return;
  }
  if (event.target.id === "product-form") {
    await saveProductForm(event.target);
    return;
  }
  if (event.target.id === "password-form") {
    event.preventDefault();
    try {
      await api("/api/admin/password", {
        method: "PUT",
        body: JSON.stringify({ password: new FormData(event.target).get("password") }),
      });
      state.token = "";
      sessionStorage.removeItem(TOKEN_KEY);
      state.loginError = "Нууц үг солигдлоо. Дахин нэвтэрнэ үү.";
    } catch {
      state.error = "Нууц үг 6-с дээш тэмдэгттэй байх ёстой.";
    }
    render();
  }
});

document.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    state.tab = tab.getAttribute("data-tab");
    state.notice = "";
    state.error = "";
    if (state.tab === "store") {
      state.audience = [...(state.store?.audience || [])];
    }
    render();
    return;
  }
  if (event.target.closest("[data-action=aud-add]")) {
    state.audience = readAudienceFromForm();
    if (state.audience.length < 12) state.audience.push({ title: "", text: "", titleEn: "", textEn: "" });
    render();
    return;
  }
  const audRemove = event.target.closest("[data-aud-remove]");
  if (audRemove) {
    state.audience = readAudienceFromForm();
    state.audience.splice(Number(audRemove.getAttribute("data-aud-remove")), 1);
    render();
    return;
  }
  if (event.target.closest("[data-action=login]")) {
    const form = document.getElementById("login-form");
    if (!form) return;
    state.loginError = "";
    try {
      await login(new FormData(form).get("password"));
    } catch {
      state.loginError = "Нууц үг таарахгүй байна. ADMIN_PASSWORD гэж бичихгүй, Render дээрх Value-г хуулна уу.";
    }
    render();
    return;
  }
  if (event.target.closest("[data-action=logout]")) {
    state.token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    render();
    return;
  }
  if (event.target.closest("[data-action=new-product]")) {
    state.editing = { published: true, featured: false, formats: ["PDF"], category: "report", images: [] };
    render();
    return;
  }
  if (event.target.closest("[data-action=add-img-url]")) {
    const input = document.getElementById("img-url");
    const url = (input?.value || "").trim();
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/uploads/")) {
      state.error = "Зургийн холбоос https://-ээр эхлэх ёстой.";
      render();
      return;
    }
    mergeProductDraft();
    if ((state.editing.images || []).length >= 3) {
      state.error = "3-аас илүү зураг нэмэхгүй.";
      render();
      return;
    }
    state.editing.images = [...(state.editing.images || []), url].slice(0, 3);
    if (input) input.value = "";
    state.error = "";
    render();
    return;
  }
  const imgRemove = event.target.closest("[data-img-remove]");
  if (imgRemove) {
    mergeProductDraft();
    const index = Number(imgRemove.getAttribute("data-img-remove"));
    state.editing.images = (state.editing.images || []).filter((_, i) => i !== index);
    render();
    return;
  }
  if (event.target.closest("[data-action=save-store]")) {
    const form = document.getElementById("store-form");
    if (form) await saveStoreForm(form);
    return;
  }
  if (event.target.closest("[data-action=save-product]")) {
    const form = document.getElementById("product-form");
    if (form) await saveProductForm(form);
    return;
  }
  if (event.target.closest("[data-action=cancel-edit]")) {
    state.editing = null;
    render();
    return;
  }
  const edit = event.target.closest("[data-edit]");
  if (edit) {
    const found = state.products.find((p) => p.id === edit.getAttribute("data-edit"));
    state.editing = found ? { ...found, images: [...(found.images || [])] } : null;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const remove = event.target.closest("[data-delete]");
  if (remove) {
    if (!window.confirm("Энэ тайланг дэлгүүрээс бүр мөсөн устгах уу?")) return;
    try {
      await api(`/api/admin/products/${encodeURIComponent(remove.getAttribute("data-delete"))}`, { method: "DELETE" });
      if (state.editing?.id === remove.getAttribute("data-delete")) state.editing = null;
      state.notice = "Устгалаа.";
      await loadAll();
    } catch {
      state.error = "Устгаж чадсангүй.";
    }
    render();
    return;
  }
  const statusBtn = event.target.closest("[data-status]");
  if (statusBtn) {
    const [id, status] = statusBtn.getAttribute("data-status").split(":");
    try {
      await api(`/api/admin/orders/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
      await loadAll();
      state.notice = "Захиалгын төлөв шинэчлэгдлээ.";
    } catch {
      state.error = "Төлөв солигдсонгүй.";
    }
    render();
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.id !== "img-file") return;
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (file) await uploadProductImage(file);
});

async function boot() {
  if (state.token) {
    try {
      await loadAll();
    } catch {
      state.token = "";
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }
  render();
}

boot();
