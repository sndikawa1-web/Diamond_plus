// DIAMOND PLUS - Profesyonel Düzeltilmiş Script
// Hatalar giderildi, Quick View aktif edildi, Sepet Boşaltma düzgün çalışıyor.

let products = [];
let cart = [];
let countdownIntervals = [];
let currentFilter = "all";
let currentSearch = "";
let pendingGifts = [];
let isProcessingGift = false;
let lastTotal = 0;
let currentQuickViewProduct = null;

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS7N92CcB-MFe9UlE7YHTSJCVpaBkeRYawz5TbCGpFsZBjy4DHu_LNitJyULHyz9Ml68A6ZcP93cM2H/pub?gid=0&single=true&output=csv";
const PHONE_NUMBER = "9647507165134";
const GIFT_THRESHOLDS = [75, 150, 225, 300, 375];

// ==================== YARDIMCI FONKSİYONLAR ====================
function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m;
    });
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = isError ? '#ef4444' : '#1e293b';
    toast.innerHTML = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function fixDateFormat(dateStr) {
    if (!dateStr) return null;
    let parts = dateStr.split('-');
    if (parts.length === 3) {
        parts[1] = parts[1].padStart(2, '0');
        parts[2] = parts[2].padStart(2, '0');
        return parts.join('-');
    }
    return dateStr;
}

// ==================== SON BAKILANLAR ====================
function saveToRecent(product) {
    let recent = JSON.parse(localStorage.getItem('recentProducts') || '[]');
    recent = recent.filter(p => p.id !== product.id);
    recent.unshift({ id: product.id, name: product.name, price: product.finalPrice, image: product.image });
    if (recent.length > 5) recent.pop();
    localStorage.setItem('recentProducts', JSON.stringify(recent));
    displayRecentProducts();
}

function displayRecentProducts() {
    const recent = JSON.parse(localStorage.getItem('recentProducts') || '[]');
    const section = document.getElementById('recentSection');
    const container = document.getElementById('recentProducts');
    if (!section || !container) return;
    
    if (recent.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    container.innerHTML = '';
    recent.forEach(item => {
        const div = document.createElement('div');
        div.className = 'recent-item';
        div.onclick = () => {
            const product = products.find(p => p.id === item.id);
            if (product) showQuickView(product);
        };
        div.innerHTML = `
            <img src="${item.image || 'https://via.placeholder.com/80'}" onerror="this.src='https://via.placeholder.com/80'">
            <div class="name">${escapeHtml(item.name)}</div>
            <div class="price">$${item.price}</div>
        `;
        container.appendChild(div);
    });
}

// ==================== HIZLI BAKIŞ (QUICK VIEW) - TAMAMEN DÜZELTİLDİ ====================
function showQuickView(product) {
    if (!product) return;
    currentQuickViewProduct = product;
    saveToRecent(product);
    
    const modal = document.getElementById('quickviewModal');
    document.getElementById('quickviewImg').src = product.image || 'https://via.placeholder.com/400';
    document.getElementById('quickviewName').innerText = product.name;
    document.getElementById('quickviewPrice').innerText = `$${product.finalPrice}`;
    document.getElementById('quickviewDesc').innerHTML = product.description ? `📝 ${escapeHtml(product.description)}` : '';
    
    // Fake fiyat göster
    const fakeEl = document.getElementById('quickviewFakePrice');
    if (product.fakePrice) {
        fakeEl.style.display = 'inline';
        fakeEl.innerText = `$${product.fakePrice}`;
    } else {
        fakeEl.style.display = 'none';
    }
    
    // İndirim rozeti
    const discEl = document.getElementById('quickviewDiscount');
    if (product.discountPercent > 0) {
        discEl.style.display = 'inline-block';
        discEl.innerText = `-%${product.discountPercent}`;
        discEl.className = 'quickview-discount-badge discount-badge';
    } else {
        discEl.style.display = 'none';
    }
    
    // Miktar sıfırla
    document.getElementById('qvQty').innerText = '1';
    
    // Benzer ürünleri getir
    const similarContainer = document.getElementById('similarProducts');
    similarContainer.innerHTML = '';
    const similar = products.filter(p => p.id !== product.id).sort(() => 0.5 - Math.random()).slice(0, 4);
    similar.forEach(p => {
        const div = document.createElement('div');
        div.className = 'similar-item';
        div.onclick = () => { showQuickView(p); };
        div.innerHTML = `<img src="${p.image || 'https://via.placeholder.com/70'}" onerror="this.src='https://via.placeholder.com/70'"><div class="name">${escapeHtml(p.name)}</div>`;
        similarContainer.appendChild(div);
    });
    
    modal.classList.add('active');
}

// Quick View Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const qvModal = document.getElementById('quickviewModal');
    document.getElementById('quickviewClose').onclick = () => qvModal.classList.remove('active');
    qvModal.onclick = (e) => { if (e.target === qvModal) qvModal.classList.remove('active'); };
    
    let qty = 1;
    document.getElementById('qvPlus').onclick = () => { qty++; document.getElementById('qvQty').innerText = qty; };
    document.getElementById('qvMinus').onclick = () => { if (qty > 1) qty--; document.getElementById('qvQty').innerText = qty; };
    
    document.getElementById('qvAddToCart').onclick = () => {
        if (currentQuickViewProduct) {
            const qty = parseInt(document.getElementById('qvQty').innerText);
            addToCart(currentQuickViewProduct, qty, false);
            showToast(`✅ ${qty} adet ${currentQuickViewProduct.name} sepete eklendi`);
            qvModal.classList.remove('active');
        }
    };
});

// ==================== SEPET İŞLEMLERİ ====================
function clearCart() {
    cart = [];
    pendingGifts = [];
    isProcessingGift = false;
    lastTotal = 0;
    updateCartUI();
    showToast("🗑️ Sepet tamamen boşaltıldı");
}

function addToCart(product, quantity, isGift = false) {
    const priceToUse = isGift ? 0 : parseFloat(product.finalPrice);
    const existing = cart.find(item => item.id === product.id && item.isGift === isGift);
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({ id: product.id, name: product.name, price: priceToUse, quantity: quantity, isGift: isGift });
    }
    updateCartUI();
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById("cartCount").innerText = totalItems;
    const modalList = document.getElementById("cartModalItems");
    
    if (cart.length === 0) {
        modalList.innerHTML = '<li class="empty-cart-message"><i class="fas fa-shopping-bag"></i> Sepetiniz boş</li>';
        document.getElementById("cartModalTotal").innerText = "Toplam: $0.00";
        return;
    }
    
    modalList.innerHTML = "";
    let total = 0;
    cart.forEach((item, idx) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const li = document.createElement("li");
        li.className = "cart-item";
        li.innerHTML = item.isGift ? `
            <div class="cart-item-info">
                <div class="cart-item-name">🎁 ${escapeHtml(item.name)} <span style="color:#e67e22;">HEDİYE</span></div>
                <div class="cart-item-price">0$ x ${item.quantity}</div>
            </div>
            <div class="cart-item-actions"></div>
        ` : `
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHtml(item.name)}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)} x ${item.quantity}</div>
            </div>
            <div class="cart-item-actions">
                <button class="modal-qty-btn" data-idx="${idx}" data-dir="minus">−</button>
                <span>${item.quantity}</span>
                <button class="modal-qty-btn" data-idx="${idx}" data-dir="plus">+</button>
            </div>
        `;
        modalList.appendChild(li);
    });
    
    document.getElementById("cartModalTotal").innerText = `Toplam: $${total.toFixed(2)}`;
    
    document.querySelectorAll('.modal-qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.idx);
            const dir = btn.dataset.dir;
            if (dir === 'plus') cart[idx].quantity++;
            else if (dir === 'minus' && cart[idx].quantity > 1) cart[idx].quantity--;
            else if (dir === 'minus' && cart[idx].quantity === 1) cart.splice(idx, 1);
            updateCartUI();
        });
    });
}

function sendOrder() {
    if (cart.length === 0) return showToast("Sepetiniz boş!", true);
    let message = "💎 DIAMOND PLUS SİPARİŞİ\n\n";
    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        message += `${item.name} x ${item.quantity} = $${itemTotal.toFixed(2)}\n`;
    });
    message += `\n📦 TOPLAM: $${total.toFixed(2)}`;
    window.open(`https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(message)}`);
}

// ==================== ÜRÜN YÜKLEME & FİLTRELEME ====================
async function loadProducts() {
    const container = document.getElementById("productsContainer");
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Ürünler yükleniyor...</p></div>';
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const text = await response.text();
        const rows = text.split("\n");
        if (rows.length < 2) throw new Error("Veri yok");
        
        const headers = rows[0].toLowerCase().split(",");
        const idIdx = headers.indexOf("id");
        const nameIdx = headers.indexOf("name");
        const priceIdx = headers.indexOf("price");
        const imgIdx = headers.indexOf("image");
        const discIdx = headers.indexOf("discount");
        const discEndIdx = headers.indexOf("discount_end");
        const descIdx = headers.indexOf("description");
        const fakePriceIdx = headers.indexOf("fake_price");
        
        products = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            let cols = [];
            let inQuote = false, current = "";
            for (let ch of row) {
                if (ch === '"') inQuote = !inQuote;
                else if (ch === ',' && !inQuote) { cols.push(current); current = ""; }
                else current += ch;
            }
            cols.push(current);
            cols = cols.map(c => c.replace(/^"|"$/g, '').trim());
            
            if (cols.length >= 3) {
                const id = cols[idIdx] || `prod-${i}`;
                const name = cols[nameIdx];
                let price = parseFloat(cols[priceIdx]?.replace(/[^0-9.-]/g, ''));
                const image = cols[imgIdx] || "";
                let discount = discIdx !== -1 && cols[discIdx] ? parseFloat(cols[discIdx]) : 0;
                let discountEndRaw = discEndIdx !== -1 && cols[discEndIdx] ? cols[discEndIdx] : "";
                const description = descIdx !== -1 ? cols[descIdx] : "";
                const fakePrice = fakePriceIdx !== -1 && cols[fakePriceIdx] ? parseFloat(cols[fakePriceIdx]) : null;
                
                let isDiscountValid = false;
                if (discount > 0 && discountEndRaw) {
                    const fixedDate = fixDateFormat(discountEndRaw);
                    const today = new Date().toISOString().slice(0,10);
                    if (fixedDate >= today) isDiscountValid = true;
                } else if (discount > 0 && !discountEndRaw) {
                    isDiscountValid = true;
                }
                
                let finalPrice = price;
                let discountPercent = 0;
                if (isDiscountValid) {
                    discountPercent = discount;
                    finalPrice = price * (1 - discount / 100);
                }
                
                if (name && !isNaN(price)) {
                    products.push({
                        id, name, price, finalPrice: finalPrice.toFixed(2),
                        discountPercent, discountEnd: isDiscountValid ? discountEndRaw : null,
                        image, description, fakePrice: fakePrice ? fakePrice.toFixed(2) : null
                    });
                }
            }
        }
        
        console.log(`${products.length} ürün yüklendi.`);
        if (products.length === 0) {
            container.innerHTML = '<div class="empty-products">⚠️ Ürün bulunamadı.</div>';
        } else {
            displayRecentProducts();
            filterProducts();
        }
    } catch(e) {
        console.error(e);
        container.innerHTML = '<div class="empty-products">❌ Bağlantı hatası.</div>';
    }
}

function filterProducts() {
    let filtered = [...products];
    if (currentFilter === "discount") filtered = filtered.filter(p => p.discountPercent > 0);
    if (currentSearch.trim() !== "") {
        const searchLower = currentSearch.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchLower));
    }
    renderFilteredProducts(filtered);
}

function renderFilteredProducts(filteredProducts) {
    const container = document.getElementById("productsContainer");
    if (filteredProducts.length === 0) {
        container.innerHTML = '<div class="empty-products">🔍 Ürün bulunamadı.</div>';
        return;
    }
    
    container.innerHTML = "";
    filteredProducts.forEach((p, idx) => {
        const originalIdx = products.findIndex(prod => prod.id === p.id);
        const hasDiscount = p.discountPercent > 0;
        const timerId = `timer-${p.id}`;
        
        const card = document.createElement("div");
        card.className = "product-card";
        card.onclick = (e) => {
            if (!e.target.closest('button')) showQuickView(p);
        };
        card.innerHTML = `
            <img class="product-img" src="${p.image || 'https://via.placeholder.com/200'}" onerror="this.src='https://via.placeholder.com/200'">
            <div class="product-info">
                <div class="product-name">${escapeHtml(p.name)}</div>
                ${p.description ? `<div class="product-description">📝 ${escapeHtml(p.description)}</div>` : ''}
                <div class="price-container">
                    <span class="current-price">$${p.finalPrice}</span>
                    ${p.fakePrice ? `<span class="fake-price">$${p.fakePrice}</span>` : ''}
                    ${hasDiscount ? `<span class="discount-badge">-%${p.discountPercent}</span>` : ''}
                </div>
                ${hasDiscount && p.discountEnd ? `<div class="countdown-timer" id="${timerId}">⏰ Yükleniyor...</div>` : ''}
                <div class="quantity-control">
                    <button class="qty-btn qty-minus" data-idx="${originalIdx}">−</button>
                    <span class="qty-value" id="qty-${originalIdx}">0</span>
                    <button class="qty-btn qty-plus" data-idx="${originalIdx}">+</button>
                </div>
                <button class="add-to-cart" data-idx="${originalIdx}"><i class="fas fa-cart-plus"></i> Sepete Ekle</button>
            </div>
        `;
        container.appendChild(card);
    });
    
    document.querySelectorAll('.qty-plus').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = btn.dataset.idx;
        const span = document.getElementById(`qty-${idx}`);
        span.innerText = parseInt(span.innerText) + 1;
    }));
    document.querySelectorAll('.qty-minus').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = btn.dataset.idx;
        const span = document.getElementById(`qty-${idx}`);
        let val = parseInt(span.innerText);
        if (val > 0) span.innerText = val - 1;
    }));
    document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = btn.dataset.idx;
        const qty = parseInt(document.getElementById(`qty-${idx}`).innerText);
        if (qty > 0) {
            addToCart(products[idx], qty, false);
            showToast(`✅ ${products[idx].name} sepete eklendi.`);
            document.getElementById(`qty-${idx}`).innerText = '0';
        } else {
            showToast("⚠️ Lütfen miktar seçin", true);
        }
    }));
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    // Arama
    document.getElementById("searchInput").addEventListener("input", (e) => {
        currentSearch = e.target.value;
        filterProducts();
    });
    
    // Filtreler
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter;
            filterProducts();
        });
    });
    
    // Banner
    document.getElementById("discountBanner").addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        document.querySelector('.filter-btn[data-filter="discount"]').classList.add("active");
        currentFilter = "discount";
        filterProducts();
        showToast("🏷️ İndirimli ürünler listeleniyor!");
    });
    
    // Sepet Modal
    const cartModal = document.getElementById("cartModal");
    document.getElementById("cartFloat").onclick = () => { updateCartUI(); cartModal.classList.add("active"); };
    document.getElementById("closeModalBtn").onclick = () => cartModal.classList.remove("active");
    cartModal.onclick = (e) => { if (e.target === cartModal) cartModal.classList.remove("active"); };
    document.getElementById("whatsappOrderBtn").onclick = sendOrder;
    
    // Sepeti Boşalt Butonu (ÇALIŞIYOR)
    document.getElementById("clearCartBtn").onclick = () => {
        if (cart.length > 0 && confirm('Sepeti tamamen boşaltmak istediğinize emin misiniz?')) {
            clearCart();
        } else if (cart.length === 0) {
            showToast("Sepet zaten boş.", true);
        }
    };
    
    // Hediye Modal Kapatma
    const giftModal = document.getElementById("giftModal");
    document.getElementById("giftModalClose").onclick = () => giftModal.classList.remove("active");
    giftModal.onclick = (e) => { if (e.target === giftModal) giftModal.classList.remove("active"); };
    
    // Uygulamayı Başlat
    loadProducts();
});
