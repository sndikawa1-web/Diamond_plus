let products = [];
let cart = [];
let countdownIntervals = [];
let currentFilter = "all";
let currentSearch = "";
let pendingGifts = [];
let isProcessingGift = false;
let lastTotal = 0;

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS7N92CcB-MFe9UlE7YHTSJCVpaBkeRYawz5TbCGpFsZBjy4DHu_LNitJyULHyz9Ml68A6ZcP93cM2H/pub?gid=0&single=true&output=csv";
const PHONE_NUMBER = "9647507165134";

const GIFT_THRESHOLDS = [75, 150, 225, 300, 375];

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

function calculateCountdown(endDateRaw) {
    if (!endDateRaw) return null;
    let fixedDate = fixDateFormat(endDateRaw);
    const endDate = new Date(fixedDate + 'T23:59:59');
    const now = new Date();
    const diff = endDate - now;
    
    if (diff <= 0) return "İndirim bitti";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (86400000)) / (3600000));
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (days > 0) return `${days} gün ${hours} saat`;
    if (hours > 0) return `${hours} saat ${minutes} dk`;
    if (minutes > 0) return `${minutes} dk ${seconds} sn`;
    return `${seconds} saniye`;
}

function startCountdown(productId, endDate, elementId) {
    if (countdownIntervals[productId]) clearInterval(countdownIntervals[productId]);
    
    const updateTimer = () => {
        const timerElement = document.getElementById(elementId);
        if (timerElement) {
            const remaining = calculateCountdown(endDate);
            if (remaining) {
                timerElement.innerHTML = `⏰ ${remaining}`;
                if (remaining === "İndirim bitti") {
                    clearInterval(countdownIntervals[productId]);
                    loadProducts();
                }
            }
        }
    };
    
    updateTimer();
    countdownIntervals[productId] = setInterval(updateTimer, 1000);
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = isError ? '#e74c3c' : '#25D366';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function updateAddButtonText(idx, quantity, price) {
    const addButton = document.querySelector(`.add-to-cart[data-idx="${idx}"]`);
    if (addButton) {
        if (quantity > 0) {
            const total = (quantity * price).toFixed(2);
            addButton.innerHTML = `🛒 Sepete Ekle (${quantity} adet - $${total})`;
        } else {
            addButton.innerHTML = `🛒 Sepete Ekle ($${price})`;
        }
    }
}

function getRandomGift() {
    const availableProducts = products.filter(p => p.price >= 2 && p.price <= 5);
    if (availableProducts.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * availableProducts.length);
    return availableProducts[randomIndex];
}

function getGiftCount(total) {
    let count = 0;
    for (let threshold of GIFT_THRESHOLDS) {
        if (total >= threshold) {
            count++;
        }
    }
    return count;
}

function showSingleGiftPopup(gift, index, total) {
    const modal = document.getElementById('giftModal');
    const body = document.getElementById('giftModalBody');
    
    if (!modal || !body) return;
    
    body.innerHTML = `
        <h2>🎉 TEBRİKLER! 🎉</h2>
        <img src="${gift.image || 'https://via.placeholder.com/150'}" style="width:150px; height:150px; object-fit:cover; border-radius:20px; margin:15px auto; border:3px solid white;" onerror="this.src='https://via.placeholder.com/150'">
        <p><strong>${escapeHtml(gift.name)}</strong> hediyesini kazandın!</p>
        <div class="gift-price">🎁 0$ (ÜCRETSİZ)</div>
        <p style="margin-top:15px; font-size:14px;">${index}/${total} Hediye sepete eklendi! 🛒</p>
    `;
    
    modal.classList.add('active');
}

function processNextGift() {
    if (pendingGifts.length === 0) {
        isProcessingGift = false;
        return;
    }
    
    isProcessingGift = true;
    const giftData = pendingGifts.shift();
    
    cart.push({
        id: giftData.gift.id,
        name: giftData.gift.name,
        price: 0,
        quantity: 1,
        isGift: true
    });
    
    showSingleGiftPopup(giftData.gift, giftData.index, giftData.total);
    updateCartUI();
}

function checkAndAddGifts() {
    const total = cart.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
    }, 0);
    
    if (total === lastTotal) return;
    lastTotal = total;
    
    const expectedGiftCount = getGiftCount(total);
    const currentGiftCount = cart.filter(item => item.isGift).length;
    
    if (expectedGiftCount > 0 && currentGiftCount !== expectedGiftCount) {
        cart = cart.filter(item => !item.isGift);
        
        const newGifts = [];
        for (let i = 0; i < expectedGiftCount; i++) {
            const newGift = getRandomGift();
            if (newGift) newGifts.push(newGift);
        }
        
        if (newGifts.length > 0) {
            pendingGifts = newGifts.map((gift, idx) => ({
                gift: gift,
                index: idx + 1,
                total: newGifts.length
            }));
            
            if (!isProcessingGift && pendingGifts.length > 0) {
                processNextGift();
            }
        }
        
        updateCartUI();
    }
}

function filterProducts() {
    let filtered = [...products];
    if (currentFilter === "discount") {
        filtered = filtered.filter(p => p.discountPercent > 0);
    }
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
        const productPrice = parseFloat(p.finalPrice);
        
        const card = document.createElement("div");
        card.className = "product-card";
        card.setAttribute("data-product-id", p.id);
        card.innerHTML = `
            <img class="product-img" src="${p.image || 'https://via.placeholder.com/200?text=Resim+Yok'}" 
                 onerror="this.src='https://via.placeholder.com/200?text=Resim+Yok'">
            <div class="product-info">
                <div class="product-name">${escapeHtml(p.name)}</div>
                ${p.description ? `<div class="product-description">📝 ${escapeHtml(p.description)}</div>` : ''}
                <div class="price-container">
                    <span class="current-price">$${p.finalPrice}</span>
                    ${p.fakePrice ? `<span class="fake-price">$${p.fakePrice}</span>` : ''}
                    ${hasDiscount ? `<span class="discount-badge">-%${p.discountPercent}</span>` : ''}
                </div>
                ${hasDiscount && p.discountEnd ? `<div class="countdown-timer" id="${timerId}">⏰ hesaplanıyor...</div>` : ''}
                <div class="quantity-control">
                    <button class="qty-btn qty-minus" data-idx="${originalIdx}">−</button>
                    <span class="qty-value" id="qty-${originalIdx}">0</span>
                    <button class="qty-btn qty-plus" data-idx="${originalIdx}">+</button>
                </div>
                <button class="add-to-cart" data-idx="${originalIdx}">🛒 Sepete Ekle ($${productPrice})</button>
            </div>
        `;
        container.appendChild(card);
        
        if (hasDiscount && p.discountEnd) {
            startCountdown(p.id, p.discountEnd, timerId);
        }
    });
    
    attachProductEvents();
}

function attachProductEvents() {
    document.querySelectorAll('.qty-plus').forEach(btn => {
        btn.removeEventListener('click', handlePlusClick);
        btn.addEventListener('click', handlePlusClick);
    });
    
    document.querySelectorAll('.qty-minus').forEach(btn => {
        btn.removeEventListener('click', handleMinusClick);
        btn.addEventListener('click', handleMinusClick);
    });
    
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.removeEventListener('click', handleAddToCart);
        btn.addEventListener('click', handleAddToCart);
    });
}

function handlePlusClick(e) {
    e.stopPropagation();
    const idx = parseInt(e.target.dataset.idx);
    const qtySpan = document.getElementById(`qty-${idx}`);
    let currentQty = parseInt(qtySpan.innerText);
    currentQty++;
    qtySpan.innerText = currentQty;
    const productPrice = parseFloat(products[idx].finalPrice);
    updateAddButtonText(idx, currentQty, productPrice);
}

function handleMinusClick(e) {
    e.stopPropagation();
    const idx = parseInt(e.target.dataset.idx);
    const qtySpan = document.getElementById(`qty-${idx}`);
    let currentQty = parseInt(qtySpan.innerText);
    if (currentQty > 0) {
        currentQty--;
        qtySpan.innerText = currentQty;
        const productPrice = parseFloat(products[idx].finalPrice);
        updateAddButtonText(idx, currentQty, productPrice);
    }
}

function handleAddToCart(e) {
    e.stopPropagation();
    const idx = parseInt(e.target.dataset.idx);
    const qtySpan = document.getElementById(`qty-${idx}`);
    let quantity = parseInt(qtySpan.innerText);
    if (quantity > 0) {
        addToCart(products[idx], quantity, false);
        showToast(`✅ ${quantity} adet ${products[idx].name} sepete eklendi`);
        qtySpan.innerText = 0;
        const productPrice = parseFloat(products[idx].finalPrice);
        updateAddButtonText(idx, 0, productPrice);
    } else {
        showToast("⚠️ Lütfen önce miktar seçin", true);
    }
}

async function loadProducts() {
    const container = document.getElementById("productsContainer");
    container.innerHTML = '<div class="loading">📦 Ürünler yükleniyor...</div>';
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const text = await response.text();
        const rows = text.split("\n");
        if (rows.length < 2) throw new Error("Veri yok");
        
        const headers = rows[0].toLowerCase().split(",");
        console.log("Sütun başlıkları:", headers);
        
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
                const id = cols[idIdx];
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
        
        console.log("Toplam ürün:", products.length);
        console.log("İndirimli ürün sayısı:", products.filter(p => p.discountPercent > 0).length);
        
        if (products.length === 0) {
            container.innerHTML = '<div class="empty-products">⚠️ Ürün bulunamadı.<br>Google Sheets kontrol edin.</div>';
        } else {
            displayRecentProducts();
            filterProducts();
        }
    } catch(e) {
        console.error("Hata:", e);
        container.innerHTML = '<div class="empty-products">❌ Ürünler yüklenemedi.<br>Sayfayı yenileyin.<br>Hata: ' + e.message + '</div>';
    }
}

function addToCart(product, quantity, isGift = false) {
    const priceToUse = isGift ? 0 : parseFloat(product.finalPrice);
    const existing = cart.find(item => item.id === product.id && item.isGift === isGift);
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: priceToUse,
            quantity: quantity,
            isGift: isGift
        });
    }
    updateCartUI();
}

// ★ SEPETİ TAMAMEN BOŞALT ★
function clearCart() {
    cart = [];
    pendingGifts = [];
    isProcessingGift = false;
    lastTotal = 0;
    giftUsed1 = false;
    giftUsed2 = false;
    updateCartUI();
    showToast("🗑️ Sepet tamamen boşaltıldı");
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById("cartCount").innerText = totalItems;
    
    const modalList = document.getElementById("cartModalItems");
    if (cart.length === 0) {
        modalList.innerHTML = '<li style="text-align:center; color:#aaa;">Sepetiniz boş</li>';
        document.getElementById("cartModalTotal").innerText = "Toplam: $0";
        return;
    }
    modalList.innerHTML = "";
    let total = 0;
    cart.forEach((item, idx) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const li = document.createElement("li");
        li.className = "cart-item";
        
        if (item.isGift) {
            li.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHtml(item.name)} <span style="color:#e67e22;">🎁 HEDİYE</span></div>
                    <div class="cart-item-price">0$ x ${item.quantity}</div>
                </div>
                <div class="cart-item-actions">
                    <span style="font-size:12px; color:#999;"></span>
                </div>
            `;
        } else {
            li.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">$${item.price} x ${item.quantity}</div>
                </div>
                <div class="cart-item-actions">
                    <button class="modal-qty-btn" data-idx="${idx}" data-dir="minus">−</button>
                    <span>${item.quantity}</span>
                    <button class="modal-qty-btn" data-idx="${idx}" data-dir="plus">+</button>
                </div>
            `;
        }
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
            checkAndAddGifts();
        });
    });
    
    checkAndAddGifts();
}

function sendOrder() {
    if (cart.length === 0) return alert("Sepetiniz boş!");
    
    let message = "💎 YENİ SİPARİŞ (Diamond Plus)\n\n";
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        message += `${item.name} x ${item.quantity} = ${itemTotal.toFixed(2)}$ 🛍️\n`;
    });
    
    message += `\n📦 Toplam fiyat = ${total.toFixed(2)}$`;
    
    window.open(`https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(message)}`);
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

document.getElementById("searchInput").addEventListener("input", (e) => {
    currentSearch = e.target.value;
    filterProducts();
});

document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        filterProducts();
    });
});

document.getElementById("discountBanner").addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    const discountBtn = document.querySelector('.filter-btn[data-filter="discount"]');
    discountBtn.classList.add("active");
    currentFilter = "discount";
    filterProducts();
    showToast("🏷️ İndirimli ürünler listeleniyor!");
});

document.getElementById("giftModalClose").addEventListener("click", () => {
    document.getElementById("giftModal").classList.remove("active");
    if (pendingGifts.length > 0 && isProcessingGift) {
        setTimeout(() => processNextGift(), 300);
    } else {
        isProcessingGift = false;
    }
});

document.getElementById("giftModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("giftModal")) {
        document.getElementById("giftModal").classList.remove("active");
        if (pendingGifts.length > 0 && isProcessingGift) {
            setTimeout(() => processNextGift(), 300);
        } else {
            isProcessingGift = false;
        }
    }
});

const modal = document.getElementById("cartModal");
document.getElementById("cartFloat").onclick = () => { updateCartUI(); modal.classList.add("active"); };
document.getElementById("closeModalBtn").onclick = () => modal.classList.remove("active");
modal.onclick = (e) => { if (e.target === modal) modal.classList.remove("active"); };
document.getElementById("whatsappOrderBtn").onclick = sendOrder;

// ★ Sepeti boşaltmak için buton eklendi (modal içinde) ★
// Modal içine bir "Sepeti Boşalt" butonu ekleyelim
const modalHeader = document.querySelector('.modal-header');
if (modalHeader && !document.getElementById('clearCartBtn')) {
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clearCartBtn';
    clearBtn.innerText = '🗑️ Boşalt';
    clearBtn.style.background = '#e74c3c';
    clearBtn.style.color = 'white';
    clearBtn.style.border = 'none';
    clearBtn.style.padding = '8px 15px';
    clearBtn.style.borderRadius = '30px';
    clearBtn.style.fontWeight = 'bold';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.marginLeft = '10px';
    clearBtn.onclick = () => {
        if (confirm('Sepeti tamamen boşaltmak istediğinize emin misiniz?')) {
            clearCart();
        }
    };
    modalHeader.appendChild(clearBtn);
}

loadProducts();
