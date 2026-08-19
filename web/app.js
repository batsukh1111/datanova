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
  return `₮ ${Number(n).toLocaleString("mn-MN")}`;
}

function visibleProducts() {
  return (state.catalog?.products || []).filter((p) => p.published !== false);
}

function productById(id) {
  return visibleProducts().find((p) => p.id === id);
}

function cartItems() {
  return state.cart
    .map((id) => productById(id))
    .filter(Boolean);
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
            <span class="brand-sub">${escapeHtml(store.tagline)}</span>
          </span>
        </a>
        <div class="header-actions">
          <button class="menu-btn" type="button" data-action="menu">${state.menuOpen ? "Хаах" : "Цэс"}</button>
          <nav class="nav ${state.menuOpen ? "open" : ""}">
            <a href="#/" class="${route === "home" ? "active" : ""}">Нүүр</a>
            <a href="#/catalog" class="${route === "catalog" ? "active" : ""}">Дэлгүүр</a>
            <a href="#/about" class="${route === "about" ? "active" : ""}">Тухай</a>
          </nav>
          <a class="cart-link" href="#/cart">Сагс ${count ? `<span class="cart-count">${count}</span>` : ""}</a>
        </div>
      </div>
    </header>
    <main id="main">${inner}</main>
    <footer class="site-footer">
      <div class="wrap footer-row">
        <div>${escapeHtml(store.name)} · ${escapeHtml(store.city)}</div>
        <div>${escapeHtml(store.email)}</div>
      </div>
      <div class="wrap" style="margin-top:10px">${escapeHtml(store.notice)}</div>
    </footer>
  `;
}

function viewHome() {
  const featured = visibleProducts().filter((p) => p.featured);
  return `
    <div class="wrap">
      <section class="hero">
        <div>
          <p class="kicker">${escapeHtml(state.store.kicker || "Тайлан · өгөгдөл · тойм")}</p>
          <h1>${escapeHtml(state.store.headline || state.store.name)}</h1>
          <p class="lede">${escapeHtml(state.store.description)}</p>
          <div class="hero-actions">
            <a class="btn" href="#/catalog">Дэлгүүр үзэх</a>
            <a class="btn ghost" href="#/about">Хэрхэн ажилладаг вэ</a>
          </div>
        </div>
        <aside class="hero-aside">
          <p><strong>1.</strong> Тайлан эсвэл хүснэгтээ сонгоно.</p>
          <p><strong>2.</strong> Банкаар төлнө. Захиалгын дугаараа утга дээр бичнэ.</p>
          <p><strong>3.</strong> ${escapeHtml(state.store.fulfillmentHours)} имэйлээр файл ирнэ.</p>
          ${state.store.heroAside ? `<p>${escapeHtml(state.store.heroAside)}</p>` : ""}
        </aside>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <h2>Онцлох</h2>
            <p class="hint">${escapeHtml(state.store.featuredHint || "")}</p>
          </div>
          <a href="#/catalog">Бүгдийг харах</a>
        </div>
        <div class="grid">${featured.map(productCard).join("")}</div>
      </section>

      ${audienceSection()}
    </div>
  `;
}

function audienceSection() {
  const items = (state.store.audience || []).filter((item) => item.title || item.text);
  if (!items.length) return "";
  return `
      <section class="section">
        <h2>${escapeHtml(state.store.audienceTitle || "Хэнд зориулсан бэ")}</h2>
        <div class="audience" style="margin-top:16px">
          ${items.map((item) => `<div class="who"><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.text)}</p></div>`).join("")}
        </div>
      </section>
  `;
}

function productCard(p) {
  return `
    <a class="card product" href="#/product/${p.id}">
      <div class="cover" style="${coverStyle(p)}">
        <div class="cover-inner">
          <span class="cover-sku">${escapeHtml(p.sku)}</span>
          <span>${escapeHtml(p.categoryLabel)}</span>
        </div>
      </div>
      <div class="product-body">
        <div class="meta">
          <span class="pill">${escapeHtml(p.categoryLabel)}</span>
          ${p.sample ? `<span class="pill sample">Жишээ</span>` : ""}
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <p class="excerpt">${escapeHtml(p.excerpt)}</p>
        <div class="price-row">
          <span class="price">${money(p.price)}</span>
          <span class="muted">${escapeHtml(p.formats.join(" · "))}</span>
        </div>
      </div>
    </a>
  `;
}

function filteredProducts() {
  const q = state.query.trim().toLowerCase();
  return visibleProducts().filter((p) => {
    const catOk = state.filter === "all" || p.category === state.filter;
    const text = `${p.title} ${p.excerpt} ${p.categoryLabel}`.toLowerCase();
    return catOk && (!q || text.includes(q));
  });
}

function catalogGridHtml(items) {
  if (!items.length) return `<div class="empty">Тохирох бүтээгдэхүүн алга.</div>`;
  return `<div class="grid" style="margin-top:18px">${items.map(productCard).join("")}</div>`;
}

function refreshCatalogGrid() {
  const grid = document.getElementById("catalog-grid");
  if (grid) grid.innerHTML = catalogGridHtml(filteredProducts());
}

function viewCatalog() {
  const items = filteredProducts();
  const chips = state.catalog.categories.map((c) => `
    <button class="chip ${state.filter === c.id ? "on" : ""}" type="button" data-filter="${c.id}">${escapeHtml(c.label)}</button>
  `).join("");

  return `
    <div class="wrap">
      <p class="kicker">Дэлгүүр</p>
      <h1>Тайлан, өгөгдөл</h1>
      <div class="toolbar">
        <input class="search" id="search" type="search" placeholder="Хайх: инфляц, үнэ, заавар…" value="${escapeAttr(state.query)}">
      </div>
      <div class="chips">${chips}</div>
      <div id="catalog-grid">${catalogGridHtml(items)}</div>
    </div>
  `;
}

function viewProduct(id) {
  const p = productById(id);
  if (!p) return `<div class="wrap empty">Бүтээгдэхүүн олдсонгүй. <a href="#/catalog">Дэлгүүр</a></div>`;
  const inCart = state.cart.includes(p.id);
  return `
    <div class="wrap detail">
      <div>
        <div class="detail-cover" style="${coverStyle(p)}">
          <div class="cover-inner">
            <span class="cover-sku">${escapeHtml(p.sku)} · ${escapeHtml(p.updated)}</span>
            <div>
              <div>${escapeHtml(p.categoryLabel)}</div>
              <strong style="font-family:var(--serif);font-size:28px">${escapeHtml(p.subtitle)}</strong>
            </div>
          </div>
        </div>
        <div class="preview-box" style="margin-top:14px">
          <h2>Юу вэ</h2>
          <p>${escapeHtml(p.description)}</p>
          <div class="split" style="margin-top:18px">
            <div>
              <h3>Багтана</h3>
              <ul class="list">${p.includes.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
            </div>
            <div>
              <h3>Багтахгүй</h3>
              <ul class="list">${p.notIncludes.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
            </div>
          </div>
        </div>
        <div class="preview-box" style="margin-top:14px">
          <h2>Урьдчилсан уншлага</h2>
          ${p.preview.map((x) => `<p>${escapeHtml(x)}</p>`).join("")}
          <h3>Агуулга</h3>
          <ul class="list">${p.toc.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
        </div>
      </div>
      <aside class="buy-box">
        <div class="meta">
          <span class="pill">${escapeHtml(p.categoryLabel)}</span>
          ${p.sample ? `<span class="pill sample">Жишээ бүтээгдэхүүн</span>` : ""}
        </div>
        <h1>${escapeHtml(p.title)}</h1>
        <p class="muted">${escapeHtml(p.excerpt)}</p>
        <div class="price-row">
          <span class="price">${money(p.price)}</span>
          <span class="muted">${p.pages ? `${p.pages} хуудас · ` : ""}${escapeHtml(p.formats.join(", "))}</span>
        </div>
        <p class="muted">Хэнд: ${escapeHtml(p.audience.join(", "))}</p>
        ${inCart
          ? `<a class="btn wide" href="#/cart">Сагсанд байна · төлбөр рүү</a>`
          : `<button class="btn wide" data-add="${p.id}">Сагсанд хийх</button>`}
        <p class="muted" style="margin-top:12px">Төлбөр орсноос хойш ${escapeHtml(state.store.fulfillmentHours)} имэйлээр илгээнэ. Бэлэн курсийн ажил биш.</p>
      </aside>
    </div>
  `;
}

function viewCart() {
  const items = cartItems();
  if (!items.length) {
    return `<div class="wrap empty"><h1>Сагс хоосон</h1><p class="muted">Дэлгүүрээс тайлан эсвэл өгөгдөл сонгоно уу.</p><p><a class="btn" href="#/catalog">Дэлгүүр</a></p></div>`;
  }
  return `
    <div class="wrap">
      <p class="kicker">Сагс</p>
      <h1>Захиалах зүйлс</h1>
      ${items.map((p) => `
        <div class="cart-item">
          <div>
            <strong>${escapeHtml(p.title)}</strong>
            <div class="muted">${escapeHtml(p.sku)} · ${escapeHtml(p.formats.join(", "))}</div>
          </div>
          <div>${money(p.price)}</div>
          <button class="linkish" data-remove="${p.id}">Хасах</button>
        </div>
      `).join("")}
      <div class="total-row"><span>Нийт</span><strong>${money(cartTotal())}</strong></div>
      <a class="btn" href="#/checkout">Төлбөр рүү</a>
    </div>
  `;
}

function viewCheckout() {
  const items = cartItems();
  if (!items.length) {
    location.hash = "#/cart";
    return "";
  }
  const bank = state.store.bank;
  return `
    <div class="wrap detail">
      <div>
        <p class="kicker">Төлбөр</p>
        <h1>Захиалга илгээх</h1>
        <p class="lede">Эхлээд захиалгаа бүртгүүлнэ. Дараа нь доорх данс руу шилжүүлнэ. Файлыг шууд автоматаар нээхгүй — төлбөр орсон хойно имэйлээр илгээнэ.</p>
        <form id="order-form">
          <label>Нэр<input name="name" required maxlength="80" autocomplete="name"></label>
          <label>Имэйл<input name="email" type="email" required maxlength="120" autocomplete="email"></label>
          <label>Утас<input name="phone" required maxlength="20" autocomplete="tel" placeholder="99112233"></label>
          <label>Байгууллага, сургууль <span class="muted">(заавал биш)</span><input name="org" maxlength="120"></label>
          <label>Тэмдэглэл<textarea name="note" rows="3" maxlength="500" placeholder="Ямар хэрэгцээнд авч байгаа вэ"></textarea></label>
          <label class="check">
            <input name="agree" type="checkbox" required>
            <span>Энэ материалыг өөрийн унших, байгууллага дотроо ашиглах зориулалтаар авна. Курсийн ажил, бие даалт, диплом болгон хуулж өгөхгүй.</span>
          </label>
          <p class="form-error">${escapeHtml(state.formError)}</p>
          <button class="btn wide" type="submit" ${state.sending ? "disabled" : ""}>${state.sending ? "Илгээж байна…" : "Захиалга үүсгэх"}</button>
        </form>
      </div>
      <aside class="buy-box">
        <h2>Төлөх дүн</h2>
        ${items.map((p) => `<div class="line"><div>${escapeHtml(p.title)}</div><div>${money(p.price)}</div></div>`).join("")}
        <div class="total-row"><span>Нийт</span><strong>${money(cartTotal())}</strong></div>
        <div class="bank">
          ${bank.bankName ? `<div><strong>${escapeHtml(bank.bankName)}</strong></div>` : ""}
          <div>Данс: ${escapeHtml(bank.account)}</div>
          <div>Хүлээн авагч: ${escapeHtml(bank.accountName)}</div>
          <div>${escapeHtml(bank.note)}</div>
        </div>
      </aside>
    </div>
  `;
}

function viewOrder() {
  const order = state.lastOrder;
  if (!order || order.id !== state.route.id) {
    return `<div class="wrap empty"><h1>Захиалга олдсонгүй</h1><p class="muted">Энэ хуудсыг шинээр нээвэл захиалгын дэлгэр харагдахгүй. Шинэ захиалга өгнө үү.</p><a class="btn" href="#/catalog">Дэлгүүр</a></div>`;
  }
  const bank = state.store.bank;
  return `
    <div class="wrap">
      <p class="kicker">Захиалга амжилттай</p>
      <h1>${escapeHtml(order.id)}</h1>
      <div class="order-card">
        <p>Төлбөр хүлээгдэж байна. Шилжүүлгийн <strong>утга дээр энэ дугаарыг</strong> бичнэ үү.</p>
        <div class="bank">
          <div>${money(order.total)}</div>
          <div>${bank.bankName ? `${escapeHtml(bank.bankName)} · ` : ""}${escapeHtml(bank.account)}</div>
          <div>${escapeHtml(bank.accountName)}</div>
          <div>Утга: ${escapeHtml(order.id)}</div>
        </div>
        <p class="muted">Төлбөр орсон хойно ${escapeHtml(order.buyer.email)} хаяг руу файл илгээнэ. ${escapeHtml(state.store.fulfillmentHours)}.</p>
        <ul class="list">${order.items.map((i) => `<li>${escapeHtml(i.title)} — ${money(i.price)}</li>`).join("")}</ul>
      </div>
    </div>
  `;
}

function viewAbout() {
  return `
    <div class="wrap">
      <p class="kicker">Тухай</p>
      <h1>${escapeHtml(state.store.name)} юу зардаг вэ</h1>
      <p class="lede">Энд байгаа зүйлс зохиогчийн боловсруулсан тайлан, тойм, цэвэр хүснэгт. Албан ёсны статистикийн хэвлэл биш. Бэлэн курсийн ажил, бие даалт биш.</p>
      <div class="steps">
        <div class="step"><b>1. Сонгох</b><span>Юу багтах, юу багтахгүйг нь уншаад авна.</span></div>
        <div class="step"><b>2. Төлөх</b><span>Захиалгын дугаар үүсгээд банкаар шилжүүлнэ.</span></div>
        <div class="step"><b>3. Авах</b><span>Төлбөр орсон даруйд имэйлээр PDF, Excel ирнэ.</span></div>
      </div>
      <div class="faq" style="margin-top:28px">
        <h2>Асуулт</h2>
        <details open><summary>Яагаад шууд татаж авч болохгүй вэ?</summary><p>Эхний хувилбар банкны шилжүүлэг дээр сууна. Төлбөр орсон эсэхийг шалгаад файл илгээнэ. Дараа нь QPay холбож болно.</p></details>
        <details><summary>Оюутан авч болох уу?</summary><p>Тийм, гэхдээ зөвхөн заавар, загвар, өөрийн ажилдаа туслах материал. Хуулж багшид өгөх бэлэн тайлан энд байхгүй.</p></details>
        <details><summary>Өөрийн датагаа яаж нэмэх вэ?</summary><p>Удирдлагын хуудаснаас бүтээгдэхүүн, үнэ, дансаа засна.</p></details>
      </div>
      <div class="notice">${escapeHtml(state.store.notice)}</div>
    </div>
  `;
}

function render() {
  const root = document.getElementById("app");
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
        name: "Нэрээ зөв бичнэ үү.",
        email: "Имэйл буруу байна.",
        phone: "Утасны дугаар буруу байна.",
        agree: "Нөхцөлийг зөвшөөрнө үү.",
        items: "Сагс хоосон байна.",
      };
      state.formError = map[body.error] || "Захиалга илгээгдсэнгүй.";
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
    state.formError = "Сервертэй холбогдсонгүй. python server.py ажиллаж байгаа эсэхээ шалгана уу.";
    state.sending = false;
    render();
  }
}

document.addEventListener("click", (event) => {
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
  document.getElementById("app").innerHTML =
    '<p class="boot">Өгөгдөл ачаалсангүй. <code>python server.py</code> ажиллуулна уу.</p>';
});
