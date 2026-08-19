import { STRINGS, readLang, writeLang } from "./i18n.js";

const CART_KEY = "khur-cart-v1";

const state = {
  store: null,
  catalog: null,
  cart: loadCart(),
  route: parseRoute(),
  menuOpen: false,
  filter: "all",
  query: "",
  formError: "",
  sending: false,
  lastOrder: null,
  lang: readLang(),
};

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

function t(key, vars = {}) {
  let text = STRINGS[state.lang]?.[key] || STRINGS.mn[key] || key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, value ?? "");
  });
  return text;
}

function loc(obj, key) {
  if (!obj) return "";
  if (state.lang === "en") {
    const en = obj[`${key}En`];
    if (Array.isArray(en) && en.length) return en;
    if (typeof en === "string" && en.trim()) return en;
  }
  return obj[key] ?? "";
}

function setLang(lang) {
  state.lang = lang === "en" ? "en" : "mn";
  writeLang(state.lang);
  document.documentElement.lang = state.lang;
  document.title = t("title");
  render();
}

function parseRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "product" && parts[1]) return { name: "product", id: parts[1] };
  if (parts[0] === "catalog") return { name: "catalog" };
  if (parts[0] === "cart") return { name: "cart" };
  if (parts[0] === "checkout") return { name: "checkout" };
  if (parts[0] === "order" && parts[1]) return { name: "order", id: parts[1] };
  if (parts[0] === "about") return { name: "about" };
  return { name: "home" };
}

function money(n) {
  const locale = state.lang === "en" ? "en-US" : "mn-MN";
  return `₮ ${Number(n).toLocaleString(locale)}`;
}

function visibleProducts() {
  return (state.catalog?.products || []).filter((p) => p.published !== false);
}

function productById(id) {
  return visibleProducts().find((p) => p.id === id);
}

function cartItems() {
  return state.cart.map((id) => productById(id)).filter(Boolean);
}

function cartTotal() {
  return cartItems().reduce((sum, p) => sum + p.price, 0);
}

function addToCart(id) {
  if (!state.cart.includes(id) && productById(id)) {
    state.cart.push(id);
    saveCart();
    render();
  }
}

function removeFromCart(id) {
  state.cart = state.cart.filter((x) => x !== id);
  saveCart();
  render();
}

function coverStyle(product) {
  const c = product.accent || "#b44a2a";
  return `background:
    linear-gradient(160deg, ${c} 0%, #1c1915 78%),
    repeating-linear-gradient(135deg, transparent 0 10px, rgba(255,255,255,.05) 10px 11px);`;
}

function catLabel(id, fallback) {
  return t(id) !== id ? t(id) : fallback || id;
}

function layout(inner) {
  const { store } = state;
  const count = state.cart.length;
  const route = state.route.name;
  return `
    <header class="site-header">
      <div class="wrap header-row">
        <a class="brand" href="#/">
          <span class="mark">${escapeHtml(store.mark || store.name.slice(0, 1))}</span>
          <span>
            <span class="brand-name">${escapeHtml(store.name)}</span>
            <span class="brand-sub">${escapeHtml(loc(store, "tagline"))}</span>
          </span>
        </a>
        <div class="header-actions">
          <button class="menu-btn" type="button" data-action="menu">${state.menuOpen ? t("close") : t("menu")}</button>
          <nav class="nav ${state.menuOpen ? "open" : ""}">
            <a href="#/" class="${route === "home" ? "active" : ""}">${t("home")}</a>
            <a href="#/catalog" class="${route === "catalog" ? "active" : ""}">${t("shop")}</a>
            <a href="#/about" class="${route === "about" ? "active" : ""}">${t("about")}</a>
          </nav>
          <div class="lang-switch" role="group" aria-label="Language">
            <button type="button" data-lang="mn" class="${state.lang === "mn" ? "on" : ""}">MN</button>
            <button type="button" data-lang="en" class="${state.lang === "en" ? "on" : ""}">EN</button>
          </div>
          <a class="cart-link" href="#/cart">${t("cart")} ${count ? `<span class="cart-count">${count}</span>` : ""}</a>
        </div>
      </div>
    </header>
    <main id="main">${inner}</main>
    <footer class="site-footer">
      <div class="wrap footer-row">
        <div>${escapeHtml(store.name)} · ${escapeHtml(loc(store, "city"))}</div>
        <div>${escapeHtml(store.email)}</div>
      </div>
      <div class="wrap" style="margin-top:10px">${escapeHtml(loc(store, "notice"))}</div>
    </footer>
  `;
}

function viewHome() {
  const featured = visibleProducts().filter((p) => p.featured);
  const hours = loc(state.store, "fulfillmentHours");
  return `
    <div class="wrap">
      <section class="hero">
        <div>
          <p class="kicker">${escapeHtml(loc(state.store, "kicker"))}</p>
          <h1>${escapeHtml(loc(state.store, "headline") || state.store.name)}</h1>
          <p class="lede">${escapeHtml(loc(state.store, "description"))}</p>
          <div class="hero-actions">
            <a class="btn" href="#/catalog">${t("shopCta")}</a>
            <a class="btn ghost" href="#/about">${t("howCta")}</a>
          </div>
        </div>
        <aside class="hero-aside">
          <p><strong>1.</strong> ${t("step1")}</p>
          <p><strong>2.</strong> ${t("step2")}</p>
          <p><strong>3.</strong> ${t("step3", { hours })}</p>
          ${loc(state.store, "heroAside") ? `<p>${escapeHtml(loc(state.store, "heroAside"))}</p>` : ""}
        </aside>
      </section>
      <section class="section">
        <div class="section-head">
          <div>
            <h2>${t("featured")}</h2>
            <p class="hint">${escapeHtml(loc(state.store, "featuredHint"))}</p>
          </div>
          <a href="#/catalog">${t("seeAll")}</a>
        </div>
        <div class="grid">${featured.map(productCard).join("")}</div>
      </section>
      ${audienceSection()}
    </div>
  `;
}

function audienceSection() {
  const items = (state.store.audience || []).filter((item) => loc(item, "title") || loc(item, "text"));
  if (!items.length) return "";
  return `
      <section class="section">
        <h2>${escapeHtml(loc(state.store, "audienceTitle") || t("forWhom"))}</h2>
        <div class="audience" style="margin-top:16px">
          ${items.map((item) => `<div class="who"><b>${escapeHtml(loc(item, "title"))}</b><p>${escapeHtml(loc(item, "text"))}</p></div>`).join("")}
        </div>
      </section>
  `;
}

function productCard(p) {
  const label = catLabel(p.category, loc(p, "categoryLabel") || p.categoryLabel);
  return `
    <a class="card product" href="#/product/${p.id}">
      <div class="cover" style="${coverStyle(p)}">
        <div class="cover-inner">
          <span class="cover-sku">${escapeHtml(p.sku)}</span>
          <span>${escapeHtml(label)}</span>
        </div>
      </div>
      <div class="product-body">
        <div class="meta">
          <span class="pill">${escapeHtml(label)}</span>
          ${p.sample ? `<span class="pill sample">${t("sample")}</span>` : ""}
        </div>
        <h3>${escapeHtml(loc(p, "title"))}</h3>
        <p class="excerpt">${escapeHtml(loc(p, "excerpt"))}</p>
        <div class="price-row">
          <span class="price">${money(p.price)}</span>
          <span class="muted">${escapeHtml((p.formats || []).join(" · "))}</span>
        </div>
      </div>
    </a>
  `;
}

function filteredProducts() {
  const q = state.query.trim().toLowerCase();
  return visibleProducts().filter((p) => {
    const catOk = state.filter === "all" || p.category === state.filter;
    const text = `${loc(p, "title")} ${loc(p, "excerpt")} ${catLabel(p.category, p.categoryLabel)}`.toLowerCase();
    return catOk && (!q || text.includes(q));
  });
}

function catalogGridHtml(items) {
  if (!items.length) return `<div class="empty">${t("none")}</div>`;
  return `<div class="grid" style="margin-top:18px">${items.map(productCard).join("")}</div>`;
}

function refreshCatalogGrid() {
  const grid = document.getElementById("catalog-grid");
  if (grid) grid.innerHTML = catalogGridHtml(filteredProducts());
}

function viewCatalog() {
  const items = filteredProducts();
  const chips = (state.catalog.categories || []).map((c) => `
    <button class="chip ${state.filter === c.id ? "on" : ""}" type="button" data-filter="${c.id}">${escapeHtml(loc(c, "label") || catLabel(c.id))}</button>
  `).join("");
  return `
    <div class="wrap">
      <p class="kicker">${t("catalogKicker")}</p>
      <h1>${t("catalogTitle")}</h1>
      <div class="toolbar">
        <input class="search" id="search" type="search" placeholder="${escapeAttr(t("searchPh"))}" value="${escapeAttr(state.query)}">
      </div>
      <div class="chips">${chips}</div>
      <div id="catalog-grid">${catalogGridHtml(items)}</div>
    </div>
  `;
}

function viewProduct(id) {
  const p = productById(id);
  if (!p) return `<div class="wrap empty">${t("missing")} <a href="#/catalog">${t("shop")}</a></div>`;
  const inCart = state.cart.includes(p.id);
  const label = catLabel(p.category, loc(p, "categoryLabel") || p.categoryLabel);
  const includes = loc(p, "includes") || [];
  const excludes = loc(p, "notIncludes") || [];
  const preview = loc(p, "preview") || [];
  const toc = loc(p, "toc") || [];
  const audience = loc(p, "audience") || [];
  const hours = loc(state.store, "fulfillmentHours");
  return `
    <div class="wrap detail">
      <div>
        <div class="detail-cover" style="${coverStyle(p)}">
          <div class="cover-inner">
            <span class="cover-sku">${escapeHtml(p.sku)} · ${escapeHtml(p.updated)}</span>
            <div>
              <div>${escapeHtml(label)}</div>
              <strong style="font-family:var(--serif);font-size:28px">${escapeHtml(loc(p, "subtitle"))}</strong>
            </div>
          </div>
        </div>
        <div class="preview-box" style="margin-top:14px">
          <h2>${t("what")}</h2>
          <p>${escapeHtml(loc(p, "description"))}</p>
          <div class="split" style="margin-top:18px">
            <div>
              <h3>${t("includes")}</h3>
              <ul class="list">${includes.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
            </div>
            <div>
              <h3>${t("excludes")}</h3>
              <ul class="list">${excludes.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
            </div>
          </div>
        </div>
        <div class="preview-box" style="margin-top:14px">
          <h2>${t("preview")}</h2>
          ${preview.map((x) => `<p>${escapeHtml(x)}</p>`).join("")}
          <h3>${t("toc")}</h3>
          <ul class="list">${toc.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
        </div>
      </div>
      <aside class="buy-box">
        <div class="meta">
          <span class="pill">${escapeHtml(label)}</span>
          ${p.sample ? `<span class="pill sample">${t("sampleProduct")}</span>` : ""}
        </div>
        <h1>${escapeHtml(loc(p, "title"))}</h1>
        <p class="muted">${escapeHtml(loc(p, "excerpt"))}</p>
        <div class="price-row">
          <span class="price">${money(p.price)}</span>
          <span class="muted">${p.pages ? `${p.pages} ${t("pages")} · ` : ""}${escapeHtml((p.formats || []).join(", "))}</span>
        </div>
        <p class="muted">${t("forWhom")}: ${escapeHtml(audience.join(", "))}</p>
        ${inCart
          ? `<a class="btn wide" href="#/checkout">${t("inCart")}</a>`
          : `<button class="btn wide" data-add="${p.id}">${t("addCart")}</button>`}
        <p class="muted" style="margin-top:12px">${t("afterPay", { hours })}</p>
      </aside>
    </div>
  `;
}

function viewCart() {
  const items = cartItems();
  if (!items.length) {
    return `<div class="wrap empty"><h1>${t("cartEmpty")}</h1><p class="muted">${t("cartEmptyHint")}</p><p><a class="btn" href="#/catalog">${t("shop")}</a></p></div>`;
  }
  return `
    <div class="wrap">
      <p class="kicker">${t("cart")}</p>
      <h1>${t("cartTitle")}</h1>
      ${items.map((p) => `
        <div class="cart-item">
          <div>
            <strong>${escapeHtml(loc(p, "title"))}</strong>
            <div class="muted">${escapeHtml(p.sku)} · ${escapeHtml((p.formats || []).join(", "))}</div>
          </div>
          <div>${money(p.price)}</div>
          <button class="linkish" data-remove="${p.id}">${t("remove")}</button>
        </div>
      `).join("")}
      <div class="total-row"><span>${t("total")}</span><strong>${money(cartTotal())}</strong></div>
      <a class="btn" href="#/checkout">${t("toPay")}</a>
    </div>
  `;
}

function viewCheckout() {
  const items = cartItems();
  if (!items.length) {
    location.hash = "#/cart";
    return "";
  }
  const bank = state.store.bank || {};
  return `
    <div class="wrap detail">
      <div>
        <p class="kicker">${t("pay")}</p>
        <h1>${t("checkoutTitle")}</h1>
        <p class="lede">${t("checkoutLead")}</p>
        <form id="order-form">
          <label>${t("name")}<input name="name" required maxlength="80" autocomplete="name"></label>
          <label>${t("email")}<input name="email" type="email" required maxlength="120" autocomplete="email"></label>
          <label>${t("phone")}<input name="phone" required maxlength="20" autocomplete="tel" placeholder="99112233"></label>
          <label>${t("org")} <span class="muted">${t("optional")}</span><input name="org" maxlength="120"></label>
          <label>${t("note")}<textarea name="note" rows="3" maxlength="500" placeholder="${escapeAttr(t("notePh"))}"></textarea></label>
          <label class="check">
            <input name="agree" type="checkbox" required>
            <span>${t("agree")}</span>
          </label>
          <p class="form-error">${escapeHtml(state.formError)}</p>
          <button class="btn wide" type="submit" ${state.sending ? "disabled" : ""}>${state.sending ? t("sending") : t("sendOrder")}</button>
        </form>
      </div>
      <aside class="buy-box">
        <h2>${t("payAmount")}</h2>
        ${items.map((p) => `<div class="line"><div>${escapeHtml(loc(p, "title"))}</div><div>${money(p.price)}</div></div>`).join("")}
        <div class="total-row"><span>${t("total")}</span><strong>${money(cartTotal())}</strong></div>
        <div class="bank">
          ${loc(bank, "bankName") ? `<div><strong>${escapeHtml(loc(bank, "bankName"))}</strong></div>` : ""}
          <div>${t("account")}: ${escapeHtml(bank.account)}</div>
          <div>${t("receiver")}: ${escapeHtml(bank.accountName)}</div>
          <div>${escapeHtml(loc(bank, "note"))}</div>
        </div>
      </aside>
    </div>
  `;
}

function viewOrder() {
  const order = state.lastOrder;
  if (!order || order.id !== state.route.id) {
    return `<div class="wrap empty"><h1>${t("orderMissing")}</h1><p class="muted">${t("orderMissingHint")}</p><a class="btn" href="#/catalog">${t("shop")}</a></div>`;
  }
  const bank = state.store.bank || {};
  const hours = loc(state.store, "fulfillmentHours");
  return `
    <div class="wrap">
      <p class="kicker">${t("orderOk")}</p>
      <h1>${escapeHtml(order.id)}</h1>
      <div class="order-card">
        <p>${t("payWait")}</p>
        <div class="bank">
          <div>${money(order.total)}</div>
          <div>${loc(bank, "bankName") ? `${escapeHtml(loc(bank, "bankName"))} · ` : ""}${escapeHtml(bank.account)}</div>
          <div>${escapeHtml(bank.accountName)}</div>
          <div>${t("ref")}: ${escapeHtml(order.id)}</div>
        </div>
        <p class="muted">${t("fileSoon", { email: order.buyer.email, hours })}</p>
        <ul class="list">${order.items.map((i) => `<li>${escapeHtml(i.title)} — ${money(i.price)}</li>`).join("")}</ul>
      </div>
    </div>
  `;
}

function viewAbout() {
  return `
    <div class="wrap">
      <p class="kicker">${t("aboutKicker")}</p>
      <h1>${t("aboutTitle", { name: state.store.name })}</h1>
      <p class="lede">${t("aboutLead")}</p>
      <div class="steps">
        <div class="step"><b>${t("how1t")}</b><span>${t("how1")}</span></div>
        <div class="step"><b>${t("how2t")}</b><span>${t("how2")}</span></div>
        <div class="step"><b>${t("how3t")}</b><span>${t("how3")}</span></div>
      </div>
      <div class="faq" style="margin-top:28px">
        <h2>${t("faq")}</h2>
        <details open><summary>${t("faq1q")}</summary><p>${t("faq1a")}</p></details>
        <details><summary>${t("faq2q")}</summary><p>${t("faq2a")}</p></details>
        <details><summary>${t("faq3q")}</summary><p>${t("faq3a")}</p></details>
      </div>
      <div class="notice">${escapeHtml(loc(state.store, "notice"))}</div>
    </div>
  `;
}

function render() {
  const root = document.getElementById("app");
  document.documentElement.lang = state.lang;
  document.title = t("title");
  let inner = "";
  if (state.route.name === "home") inner = viewHome();
  else if (state.route.name === "catalog") inner = viewCatalog();
  else if (state.route.name === "product") inner = viewProduct(state.route.id);
  else if (state.route.name === "cart") inner = viewCart();
  else if (state.route.name === "checkout") inner = viewCheckout();
  else if (state.route.name === "order") inner = viewOrder();
  else inner = viewAbout();
  root.innerHTML = layout(inner);
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

async function submitOrder(form) {
  state.formError = "";
  state.sending = true;
  render();
  const data = new FormData(form);
  const payload = {
    name: String(data.get("name") || ""),
    email: String(data.get("email") || ""),
    phone: String(data.get("phone") || ""),
    org: String(data.get("org") || ""),
    note: String(data.get("note") || ""),
    agree: data.get("agree") === "on",
    items: state.cart.map((id) => ({ id })),
  };
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      const map = {
        name: t("errName"),
        email: t("errEmail"),
        phone: t("errPhone"),
        agree: t("errAgree"),
        items: t("errItems"),
      };
      state.formError = map[body.error] || t("errOrder");
      state.sending = false;
      render();
      return;
    }
    state.lastOrder = body.order;
    state.cart = [];
    saveCart();
    state.sending = false;
    location.hash = `#/order/${body.order.id}`;
  } catch {
    state.formError = t("errServer");
    state.sending = false;
    render();
  }
}

document.addEventListener("click", (event) => {
  const langBtn = event.target.closest("[data-lang]");
  if (langBtn) {
    setLang(langBtn.getAttribute("data-lang"));
    return;
  }
  const menu = event.target.closest("[data-action=menu]");
  if (menu) {
    state.menuOpen = !state.menuOpen;
    render();
    return;
  }
  const add = event.target.closest("[data-add]");
  if (add) {
    addToCart(add.getAttribute("data-add"));
    return;
  }
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    removeFromCart(remove.getAttribute("data-remove"));
    return;
  }
  const chip = event.target.closest("[data-filter]");
  if (chip) {
    state.filter = chip.getAttribute("data-filter");
    render();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "search") return;
  state.query = event.target.value;
  refreshCatalogGrid();
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "order-form") {
    event.preventDefault();
    submitOrder(event.target);
  }
});

window.addEventListener("hashchange", () => {
  state.route = parseRoute();
  state.menuOpen = false;
  state.formError = "";
  window.scrollTo(0, 0);
  render();
});

async function boot() {
  const [storeRes, catalogRes] = await Promise.all([
    fetch("/data/store.json"),
    fetch("/data/products.json"),
  ]);
  state.store = await storeRes.json();
  state.catalog = await catalogRes.json();
  state.cart = state.cart.filter((id) => productById(id));
  saveCart();
  render();
}

boot().catch(() => {
  document.getElementById("app").innerHTML = `<p class="boot">${STRINGS[readLang()]?.bootFail || STRINGS.mn.bootFail}</p>`;
});
