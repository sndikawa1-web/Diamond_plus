// ============================================
// DIAMOND PLUS - PREMIUM JAVASCRIPT
// Profesyonel E-Ticaret Fonksiyonları
// HEDİYE SİSTEMİ TAMAMEN DÜZELTİLDİ
// ============================================

'use strict';

// Global Variables
let products = [];
let cart = [];
let currentFilter = "all";
let currentSearch = "";
let currentQuickViewProduct = null;
let isLoading = false;
let lastGiftTotal = 0;
let giftGiven = false;

// Configuration
const CONFIG = {
    CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS7N92CcB-MFe9UlE7YHTSJCVpaBkeRYawz5TbCGpFsZBjy4DHu_LNitJyULHyz9Ml68A6ZcP93cM2H/pub?gid=0&single=true&output=csv",
    PHONE_NUMBER: "9647507165134",
    GIFT_THRESHOLDS: [75, 150, 225, 300, 375],
    RECENT_LIMIT: 5
};

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatPrice(price) {
    return parseFloat(price).toFixed(2);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast-premium ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// ==================== PRODUCT LOADING ====================
async function loadProducts() {
    if (isLoading) return;
    isLoading = true;
    
    const container = document.getElementById('productsContainer');
    container.innerHTML = `
        <div class="loading-shimmer">
            <div class="shimmer-card"></div>
            <div class="shimmer-card"></div>
            <div class="shimmer-card"></div>
            <div class="shimmer-card"></div>
        </div>
    `;
    
    try {
        const response = await fetch(CONFIG.CSV_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const text = await response.text();
        const rows = text.split("\n").filter(row => row.trim());
        if (rows.length < 2) throw new Error("No data found");
        
        const headers = rows[0].toLowerCase().split(",").map(h => h.trim());
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
            const cols = parseCSVRow(rows[i]);
            if (cols.length < 3) continue;
            
            const id = cols[idIdx] || `prod-${i}`;
            const name = cols[nameIdx];
            let price = parseFloat(cols[priceIdx]?.replace(/[^0-9.-]/g, ''));
            const image = cols[imgIdx] || 'https://via.placeholder.com/400?text=No+Image';
            const discount = discIdx !== -1 && cols[discIdx] ? parseFloat(cols[discIdx]) : 0;
            const discountEnd = discEndIdx !== -1 ? cols[discEndIdx] : null;
            const description = descIdx !== -1 ? cols[descIdx] : '';
            const fakePrice = fakePriceIdx !== -1 && cols[fakePriceIdx] ? parseFloat(cols[fakePriceIdx]) : null;
            
            if (!name || isNaN(price)) continue;
            
            const isDiscountValid = checkDiscountValidity(discount, discountEnd);
            const finalPrice = isDiscountValid ? price * (1 - discount / 100) : price;
            
            products.push({
                id, name, price,
                finalPrice: formatPrice(finalPrice),
                discountPercent: isDiscountValid ? discount : 0,
                discountEnd: isDiscountValid ? discountEnd : null,
                image, description,
                fakePrice: fakePrice ? formatPrice(fakePrice) : null,
                rating: (4 + Math.random()).toFixed(1),
                reviewCount: Math.floor(Math.random() * 500) + 50
            });
        }
        
        console.log(`✅ ${products.length} products loaded`);
        updateProductCount();
        filterProducts();
        displayRecentProducts();
        
    } catch (error) {
        console.error('❌ Load error:', error);
        container.innerHTML = `
            <div class="empty-products-premium">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Yüklenemedi</h3>
                <p>Lütfen internet bağlantınızı kontrol edin</p>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

function parseCSVRow(row) {
    const cols = [];
    let current = '';
    let inQuote = false;
    
    for (let char of row) {
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            cols.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    cols.push(current.trim());
    
    return cols.map(c => c.replace(/^"|"$/g, '').trim());
}

function checkDiscountValidity(discount, endDate) {
    if (!discount || discount <= 0) return false;
    if (!endDate) return true;
    
    try {
        const end = new Date(endDate + 'T23:59:59');
        const now = new Date();
        return end >= now;
    } catch {
        return true;
    }
}

function updateProductCount() {
    const countEl = document.getElementById('productCount');
    if (countEl) {
        countEl.textContent = `${products.length} ürün`;
    }
}

// ==================== FILTERING ====================
function filterProducts() {
    let filtered = [...products];
    
    if (currentFilter === 'discount') {
        filtered = filtered.filter(p => p.discountPercent > 0);
    } else if (currentFilter === 'new') {
        filtered = filtered.slice(-10);
    } else if (currentFilter === 'premium') {
        filtered = filtered.filter(p => parseFloat(p.finalPrice) > 50);
    }
    
    if (currentSearch.trim()) {
        const searchLower = currentSearch.toLowerCase();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchLower) ||
            (p.description && p.description.toLowerCase().includes(searchLower))
        );
    }
    
    renderProducts(filtered);
}

function renderProducts(productsToRender) {
    const container = document.getElementById('productsContainer');
    
    if (!productsToRender.length) {
        container.innerHTML = `
            <div class="empty-products-premium">
                <i class="fas fa-search"></i>
                <h3>Ürün Bulunamadı</h3>
                <p>Farklı bir arama deneyin</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    productsToRender.forEach(product => {
        const hasDiscount = product.discountPercent > 0;
        
        html += `
            <div class="product-card-premium" onclick="showQuickView('${product.id}')">
                ${hasDiscount ? `
                    <div class="product-badge">
                        <span class="discount-tag">-${product.discountPercent}%</span>
                    </div>
                ` : ''}
                <div class="product-image-wrapper">
                    <img src="${product.image}" alt="${escapeHtml(product.name)}" 
                         onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
                    <div class="quick-view-overlay">
                        <i class="fas fa-eye"></i>
                    </div>
                </div>
                <div class="product-details">
                    <h3 class="product-title">${escapeHtml(product.name)}</h3>
                    <div class="product-pricing">
                        <span class="current-price-premium">$${product.finalPrice}</span>
                        ${product.fakePrice ? `<span class="old-price-premium">$${product.fakePrice}</span>` : ''}
                    </div>
                    <div class="product-footer">
                        <div class="product-rating">
                            <i class="fas fa-star"></i>
                            <span>${product.rating}</span>
                            <span>(${product.reviewCount})</span>
                        </div>
                        <div class="add-cart-icon" onclick="event.stopPropagation(); quickAddToCart('${product.id}')">
                            <i class="fas fa-plus"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ==================== QUICK VIEW ====================
function showQuickView(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    currentQuickViewProduct = product;
    saveToRecent(product);
    
    const modal = document.getElementById('quickviewModal');
    document.getElementById('quickviewImg').src = product.image;
    document.getElementById('quickviewName').textContent = product.name;
    document.getElementById('quickviewPrice').textContent = `$${product.finalPrice}`;
    document.getElementById('quickviewDesc').textContent = product.description || 'Premium kalite ürün.';
    
    const fakePriceEl = document.getElementById('quickviewFakePrice');
    if (product.fakePrice) {
        fakePriceEl.textContent = `$${product.fakePrice}`;
        fakePriceEl.style.display = 'inline';
    } else {
        fakePriceEl.style.display = 'none';
    }
    
    const discountBadge = document.getElementById('quickviewDiscountBadge');
    if (product.discountPercent > 0) {
        discountBadge.textContent = `-${product.discountPercent}%`;
        discountBadge.style.display = 'flex';
    } else {
        discountBadge.style.display = 'none';
    }
    
    document.getElementById('qvQty').textContent = '1';
    
    renderSimilarProducts(product);
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function renderSimilarProducts(currentProduct) {
    const container = document.getElementById('similarProducts');
    const similar = products
        .filter(p => p.id !== currentProduct.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 4);
    
    container.innerHTML = similar.map(p => `
        <div class="similar-item-premium" onclick="showQuickView('${p.id}')">
            <img src="${p.image}" alt="${escapeHtml(p.name)}" 
                 onerror="this.src='https://via.placeholder.com/100'">
            <div class="name">${escapeHtml(p.name).substring(0, 20)}</div>
            <div class="price">$${p.finalPrice}</div>
        </div>
    `).join('');
}

function quickAddToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        addToCart(product, 1);
        showToast(`✅ ${product.name} sepete eklendi`);
    }
}

// ==================== CART FUNCTIONS ====================
function addToCart(product, quantity = 1) {
    const existing = cart.find(item => item.id === product.id && !item.isGift);
    
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.finalPrice),
            image: product.image,
            quantity: quantity,
            isGift: false
        });
    }
    
    updateCartUI();
    checkAndAddGift();
}

function removeFromCart(index) {
    if (cart[index].isGift) {
        giftGiven = false;
        lastGiftTotal = 0;
    }
    cart.splice(index, 1);
    updateCartUI();
    checkAndAddGift();
}

function updateCartQuantity(index, delta) {
    const newQty = cart[index].quantity + delta;
    if (newQty > 0) {
        cart[index].quantity = newQty;
    } else {
        if (cart[index].isGift) {
            giftGiven = false;
            lastGiftTotal = 0;
        }
        cart.splice(index, 1);
    }
    updateCartUI();
    checkAndAddGift();
}

function clearCart() {
    if (cart.length === 0) {
        showToast('Sepet zaten boş', 'error');
        return;
    }
    
    cart = [];
    giftGiven = false;
    lastGiftTotal = 0;
    updateCartUI();
    showToast('🗑️ Sepet temizlendi');
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
    }, 0);
    
    document.getElementById('cartCount').textContent = totalItems;
    document.getElementById('cartItemCount').textContent = `${totalItems} ürün`;
    document.getElementById('cartModalTotal').textContent = `$${subtotal.toFixed(2)}`;
    
    renderCartItems();
}

function renderCartItems() {
    const container = document.getElementById('cartModalItems');
    
    if (cart.length === 0) {
        container.innerHTML = `
            <li class="empty-cart-state">
                <div class="empty-cart-icon">
                    <i class="fas fa-shopping-bag"></i>
                </div>
                <h4>Sepetiniz Boş</h4>
                <p>Ürün eklemek için alışverişe başlayın</p>
            </li>
        `;
        return;
    }
    
    container.innerHTML = cart.map((item, index) => `
        <li class="cart-item-premium">
            <img src="${item.image || 'https://via.placeholder.com/60'}" 
                 alt="${escapeHtml(item.name)}" class="cart-item-image"
                 onerror="this.src='https://via.placeholder.com/60'">
            <div class="cart-item-details">
                <div class="cart-item-name">
                    ${item.isGift ? '🎁 ' : ''}${escapeHtml(item.name)}
                    ${item.isGift ? '<span style="color: var(--primary); margin-left: 8px;">HEDİYE</span>' : ''}
                </div>
                <div class="cart-item-meta">
                    <span class="cart-item-price">
                        ${item.isGift ? 'ÜCRETSİZ' : `$${(item.price * item.quantity).toFixed(2)}`}
                    </span>
                    ${!item.isGift ? `
                        <div class="cart-item-quantity">
                            <button class="qty-btn-small" onclick="updateCartQuantity(${index}, -1)">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn-small" onclick="updateCartQuantity(${index}, 1)">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    ` : `
                        <div class="cart-item-quantity">
                            <span style="margin-right: 20px;">x${item.quantity}</span>
                        </div>
                    `}
                </div>
            </div>
        </li>
    `).join('');
}

function sendOrder() {
    if (cart.length === 0) {
        showToast('Sepetiniz boş!', 'error');
        return;
    }
    
    let message = '💎 *DIAMOND PLUS SİPARİŞİ* 💎\n\n';
    let total = 0;
    
    cart.forEach(item => {
        if (!item.isGift) {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            message += `🛍️ ${item.name}\n`;
            message += `   ${item.quantity} adet x $${item.price} = $${itemTotal.toFixed(2)}\n\n`;
        } else {
            message += `🎁 HEDİYE: ${item.name} x ${item.quantity}\n\n`;
        }
    });
    
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `📦 *TOPLAM: $${total.toFixed(2)}*`;
    
    const whatsappUrl = `https://wa.me/${CONFIG.PHONE_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// ==================== GIFT SYSTEM - TAMAMEN DÜZELTİLDİ ====================
function getGiftCount(total) {
    let count = 0;
    for (let threshold of CONFIG.GIFT_THRESHOLDS) {
        if (total >= threshold) count++;
    }
    return count;
}

function getRandomGift() {
    const availableProducts = products.filter(p => {
        const price = parseFloat(p.finalPrice);
        return price >= 2 && price <= 5;
    });
    
    if (availableProducts.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * availableProducts.length);
    return availableProducts[randomIndex];
}

function checkAndAddGift() {
    // Sadece hediye olmayan ürünlerin toplamını hesapla
    const total = cart.reduce((sum, item) => {
        if (item.isGift) return sum;
        return sum + (item.price * item.quantity);
    }, 0);
    
    // Toplam değişmediyse kontrol etme
    if (total === lastGiftTotal && giftGiven) return;
    
    const expectedGiftCount = getGiftCount(total);
    const currentGiftCount = cart.filter(item => item.isGift).length;
    
    console.log(`🎁 Hediye Kontrolü: Toplam=$${total}, Beklenen=${expectedGiftCount}, Mevcut=${currentGiftCount}`);
    
    // Eğer hediye hakkı varsa ve henüz verilmemişse
    if (expectedGiftCount > 0 && currentGiftCount < expectedGiftCount) {
        // Önce eski hediyeleri temizle
        cart = cart.filter(item => !item.isGift);
        
        // Yeni hediyeleri ekle
        for (let i = 0; i < expectedGiftCount; i++) {
            const gift = getRandomGift();
            if (gift) {
                cart.push({
                    id: gift.id + '-gift-' + i,
                    name: gift.name,
                    price: parseFloat(gift.finalPrice),
                    image: gift.image,
                    quantity: 1,
                    isGift: true
                });
                
                // Hediye popup'ını göster
                showGiftModal(gift, i + 1, expectedGiftCount);
            }
        }
        
        giftGiven = true;
        lastGiftTotal = total;
        updateCartUI();
    } 
    // Eğer toplam düştüyse ve hediye hakkı azaldıysa
    else if (expectedGiftCount < currentGiftCount) {
        cart = cart.filter(item => !item.isGift);
        
        if (expectedGiftCount > 0) {
            for (let i = 0; i < expectedGiftCount; i++) {
                const gift = getRandomGift();
                if (gift) {
                    cart.push({
                        id: gift.id + '-gift-' + i,
                        name: gift.name,
                        price: parseFloat(gift.finalPrice),
                        image: gift.image,
                        quantity: 1,
                        isGift: true
                    });
                }
            }
        }
        
        giftGiven = expectedGiftCount > 0;
        lastGiftTotal = total;
        updateCartUI();
    }
}

function showGiftModal(gift, index, total) {
    const modal = document.getElementById('giftModal');
    const body = document.getElementById('giftModalBody');
    
    body.innerHTML = `
        <h2>🎉 TEBRİKLER!</h2>
        <img src="${gift.image}" alt="${escapeHtml(gift.name)}" 
             onerror="this.src='https://via.placeholder.com/160'">
        <p><strong>${escapeHtml(gift.name)}</strong> hediyesini kazandınız!</p>
        <p style="font-size: 14px; opacity: 0.9;">${index}/${total} Hediye</p>
        <div class="gift-price-premium">🎁 ÜCRETSİZ</div>
        <p style="margin-top: 20px; font-size: 14px; opacity: 0.8;">
            Hediye sepetinize eklendi!
        </p>
    `;
    
    modal.classList.add('active');
    
    setTimeout(() => {
        modal.classList.remove('active');
    }, 4000);
}

// ==================== RECENT PRODUCTS ====================
function saveToRecent(product) {
    let recent = JSON.parse(localStorage.getItem('diamond_recent') || '[]');
    recent = recent.filter(p => p.id !== product.id);
    recent.unshift({
        id: product.id,
        name: product.name,
        price: product.finalPrice,
        image: product.image
    });
    
    if (recent.length > CONFIG.RECENT_LIMIT) {
        recent.pop();
    }
    
    localStorage.setItem('diamond_recent', JSON.stringify(recent));
}

function displayRecentProducts() {
    const recent = JSON.parse(localStorage.getItem('diamond_recent') || '[]');
    const section = document.getElementById('recentSection');
    const container = document.getElementById('recentProducts');
    
    if (!section || !container) return;
    
    if (recent.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    container.innerHTML = recent.map(item => `
        <div class="recent-item-premium" onclick="showQuickView('${item.id}')">
            <img src="${item.image || 'https://via.placeholder.com/120'}" 
                 alt="${escapeHtml(item.name)}"
                 onerror="this.src='https://via.placeholder.com/120'">
            <div class="name">${escapeHtml(item.name)}</div>
            <div class="price">$${item.price}</div>
        </div>
    `).join('');
}

function clearRecent() {
    localStorage.removeItem('diamond_recent');
    document.getElementById('recentSection').style.display = 'none';
    showToast('🗑️ Geçmiş temizlendi');
}

// ==================== EVENT LISTENERS ====================
function initializeEventListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        filterProducts();
    });
    
    // Filter Chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            filterProducts();
        });
    });
    
    // Flash Sale Banner
    document.getElementById('discountBanner')?.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        const discountChip = document.querySelector('.chip[data-filter="discount"]');
        if (discountChip) {
            discountChip.classList.add('active');
            currentFilter = 'discount';
            filterProducts();
        }
        showToast('🔥 İndirimli ürünler listeleniyor!');
    });
    
    // Cart Modal
    const cartModal = document.getElementById('cartModal');
    const cartFloat = document.getElementById('cartFloat');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    cartFloat?.addEventListener('click', () => {
        updateCartUI();
        cartModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    closeModalBtn?.addEventListener('click', closeCartModal);
    cartModal?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeCartModal();
        }
    });
    
    // Clear Cart
    document.getElementById('clearCartBtn')?.addEventListener('click', () => {
        if (cart.length > 0 && confirm('Sepeti boşaltmak istediğinize emin misiniz?')) {
            clearCart();
        }
    });
    
    // WhatsApp Order
    document.getElementById('whatsappOrderBtn')?.addEventListener('click', sendOrder);
    
    // Quick View Modal
    const qvModal = document.getElementById('quickviewModal');
    document.getElementById('quickviewClose')?.addEventListener('click', closeQuickView);
    qvModal?.addEventListener('click', (e) => {
        if (e.target.classList.contains('quickview-backdrop')) {
            closeQuickView();
        }
    });
    
    // Quick View Quantity
    let qvQty = 1;
    document.getElementById('qvPlus')?.addEventListener('click', () => {
        qvQty++;
        document.getElementById('qvQty').textContent = qvQty;
    });
    
    document.getElementById('qvMinus')?.addEventListener('click', () => {
        if (qvQty > 1) qvQty--;
        document.getElementById('qvQty').textContent = qvQty;
    });
    
    // Quick View Add to Cart
    document.getElementById('qvAddToCart')?.addEventListener('click', () => {
        if (currentQuickViewProduct) {
            const qty = parseInt(document.getElementById('qvQty').textContent);
            addToCart(currentQuickViewProduct, qty);
            showToast(`✅ ${qty} adet ${currentQuickViewProduct.name} sepete eklendi`);
            closeQuickView();
        }
    });
    
    // Gift Modal
    const giftModal = document.getElementById('giftModal');
    document.getElementById('giftModalClose')?.addEventListener('click', () => {
        giftModal.classList.remove('active');
    });
    giftModal?.addEventListener('click', (e) => {
        if (e.target.classList.contains('gift-backdrop')) {
            giftModal.classList.remove('active');
        }
    });
    
    // Clear Recent
    document.getElementById('clearRecentBtn')?.addEventListener('click', clearRecent);
}

function closeCartModal() {
    document.getElementById('cartModal').classList.remove('active');
    document.body.style.overflow = '';
}

function closeQuickView() {
    document.getElementById('quickviewModal').classList.remove('active');
    document.body.style.overflow = '';
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('💎 Diamond Plus - Premium E-Ticaret');
    console.log('🚀 Sistem başlatılıyor...');
    
    setTimeout(() => {
        document.querySelector('.page-loader')?.classList.add('hidden');
    }, 1500);
    
    initializeEventListeners();
    loadProducts();
    displayRecentProducts();
});

// Make functions globally available
window.showQuickView = showQuickView;
window.updateCartQuantity = updateCartQuantity;
window.quickAddToCart = quickAddToCart;
