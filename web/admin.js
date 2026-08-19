const TOKEN_KEY = "datanova-admin-token";

const CATEGORIES = [
  { id: "briefing", label: "Тойм" },
  { id: "report", label: "Тайлан" },
  { id: "dataset", label: "Өгөгдөл" },
  { id: "guide", label: "Заавар" },
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
    throw new Error("auth");
  }
  if (!res.ok) throw new Error(body.error || "fail");
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
      <label>Нэр<input name="title" required value="${escapeAttr(p.title || "")}"></label>
      <label>Дэд гарчиг<input name="subtitle" value="${escapeAttr(p.subtitle || "")}"></label>
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
      <label>Товч<input name="excerpt" value="${escapeAttr(p.excerpt || "")}"></label>
      <label>Тайлбар<textarea name="description" rows="4">${escapeHtml(p.description || "")}</textarea></label>
      <label>Багтана (мөр бүр нэг)<textarea name="includes" rows="4">${escapeHtml(lines(p.includes))}</textarea></label>
      <label>Багтахгүй<textarea name="notIncludes" rows="3">${escapeHtml(lines(p.notIncludes))}</textarea></label>
      <label>Хэнд<textarea name="audience" rows="2">${escapeHtml(lines(p.audience))}</textarea></label>
      <label>Агуулга<textarea name="toc" rows="3">${escapeHtml(lines(p.toc))}</textarea></label>
      <label>Урьдчилсан уншлага<textarea name="preview" rows="3">${escapeHtml(lines(p.preview))}</textarea></label>
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
    <form id="store-form" class="buy-box" method="post" action="#">
      <h2>Дэлгүүрийн мэдээлэл</h2>
      <label>Нэр<input name="name" required value="${escapeAttr(s.name || "")}"></label>
      <label>Уриа (логоны доор)<input name="tagline" value="${escapeAttr(s.tagline || "")}"></label>
      <h2>Нүүр хуудасны үг</h2>
      <label>Дээд жижиг үг<input name="kicker" value="${escapeAttr(s.kicker || "")}"></label>
      <label>Том гарчиг<input name="headline" value="${escapeAttr(s.headline || "")}"></label>
      <label>Том тайлбар<textarea name="description" rows="3">${escapeHtml(s.description || "")}</textarea></label>
      <label>Баруун талын нэмэлт үг<textarea name="heroAside" rows="2">${escapeHtml(s.heroAside || "")}</textarea></label>
      <label>Онцлох хэсгийн тайлбар<input name="featuredHint" value="${escapeAttr(s.featuredHint || "")}"></label>
      <label>Доод мэдэгдэл<textarea name="notice" rows="2">${escapeHtml(s.notice || "")}</textarea></label>
      <label>Имэйл<input name="email" type="email" value="${escapeAttr(s.email || "")}"></label>
      <label>Утас<input name="phone" value="${escapeAttr(s.phone || "")}"></label>
      <label>Хот<input name="city" value="${escapeAttr(s.city || "")}"></label>
      <label>Хүргэлтийн хугацаа<input name="fulfillmentHours" value="${escapeAttr(s.fulfillmentHours || "")}"></label>
      <h2>Банк</h2>
      <label>Банкны нэр<input name="bankName" value="${escapeAttr(b.bankName || "")}"></label>
      <label>Данс<input name="account" value="${escapeAttr(b.account || "")}"></label>
      <label>Хүлээн авагч<input name="accountName" value="${escapeAttr(b.accountName || "")}"></label>
      <label>Тэмдэглэл<textarea name="note" rows="3">${escapeHtml(b.note || "")}</textarea></label>
      <button class="btn" type="submit">Хадгалах</button>
    </form>
    <form id="password-form" class="buy-box" style="margin-top:16px" method="post" action="#">
      <h2>Нууц үг солих</h2>
      <label>Шинэ нууц үг<input name="password" type="password" minlength="6" required></label>
      <button class="btn ghost" type="submit">Солих</button>
    </form>
  `;
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
}

async function saveProductForm(form) {
  const data = new FormData(form);
  try {
    await api("/api/admin/products", {
      method: "PUT",
      body: JSON.stringify({
        id: data.get("id"),
        title: data.get("title"),
        subtitle: data.get("subtitle"),
        category: data.get("category"),
        price: data.get("price"),
        pages: data.get("pages"),
        formats: data.get("formats"),
        excerpt: data.get("excerpt"),
        description: data.get("description"),
        includes: data.get("includes"),
        notIncludes: data.get("notIncludes"),
        audience: data.get("audience"),
        toc: data.get("toc"),
        preview: data.get("preview"),
        featured: data.get("featured") === "on",
        published: data.get("published") === "on",
      }),
    });
    state.editing = null;
    state.notice = "Тайлан хадгалагдлаа. Дэлгүүр хуудсыг шинэчилбэл харагдана.";
    state.error = "";
    await loadAll();
  } catch {
    state.error = "Тайлан хадгалагдангүй.";
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
    const data = new FormData(event.target);
    try {
      const saved = await api("/api/admin/store", {
        method: "PUT",
        body: JSON.stringify({
          name: data.get("name"),
          tagline: data.get("tagline"),
          kicker: data.get("kicker"),
          headline: data.get("headline"),
          description: data.get("description"),
          heroAside: data.get("heroAside"),
          featuredHint: data.get("featuredHint"),
          notice: data.get("notice"),
          email: data.get("email"),
          phone: data.get("phone"),
          city: data.get("city"),
          fulfillmentHours: data.get("fulfillmentHours"),
          bank: {
            bankName: data.get("bankName"),
            account: data.get("account"),
            accountName: data.get("accountName"),
            note: data.get("note"),
          },
        }),
      });
      state.store = saved.store;
      state.notice = "Дэлгүүрийн мэдээлэл хадгалагдлаа.";
      state.error = "";
    } catch {
      state.error = "Хадгалж чадсангүй.";
    }
    render();
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
    state.editing = { published: true, featured: false, formats: ["PDF"], category: "report" };
    render();
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
    state.editing = state.products.find((p) => p.id === edit.getAttribute("data-edit")) || null;
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
