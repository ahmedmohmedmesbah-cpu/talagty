import { defaultAppearance, validateAppearance } from './supabase/functions/talagty-api/appearance-config.mjs';
import { effectiveHeroMode, shouldAdvanceBanner } from './storefront-banner.mjs';

const preview = new URLSearchParams(location.search).has('appearance-preview') && window.parent !== window;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const categoryLink = slug => `category1.html?category=${encodeURIComponent(slug)}`;
let settings = structuredClone(defaultAppearance), catalog = null, timer;
function contrast(hex) {
    const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#111827' : '#ffffff';
}
function target(value) {
    if (value === 'track') return 'track.html';
    if (value.startsWith('category:')) return categoryLink(value.slice(9));
    return 'index.html#categories';
}

function renderHero() {
    const hero = document.querySelector('.hero-slider, .store-hero');
    if (!hero) return;
    clearInterval(timer);
    const mode = effectiveHeroMode(settings);
    hero.className = 'store-hero';
    hero.hidden = mode === 'hidden';
    hero.dataset.mode = mode;
    hero.dataset.height = settings.hero_height;
    hero.style.setProperty('--hero-overlay', settings.hero_overlay / 100);
    hero.style.setProperty('--hero-position', settings.hero_position);
    const slides = mode === 'slider' ? settings.slides : settings.slides.slice(0, 1);
    hero.innerHTML = slides.map((slide, index) => `<article class="store-hero__slide" ${index ? 'hidden' : ''}>
        ${slide.image_url || slide.mobile_image_url ? `<picture><source media="(max-width: 600px)" srcset="${escape(slide.mobile_image_url || slide.image_url)}"><img src="${escape(slide.image_url || slide.mobile_image_url)}" alt="" ${index ? 'loading="lazy"' : 'fetchpriority="high"'}></picture>` : ''}
        <div class="store-hero__content"><h1>${escape(slide.title)}</h1><p>${escape(slide.text)}</p>${slide.button_label ? `<a class="btn btn-primary" href="${escape(target(slide.button_target))}">${escape(slide.button_label)}</a>` : ''}</div>
    </article>`).join('') + (slides.length > 1 ? `<div class="store-hero__dots" role="group" aria-label="صور العروض">${slides.map((_, i) => `<button type="button" class="store-hero__dot" data-hero-action="dot" data-slide-index="${i}" aria-label="عرض الصورة ${i + 1} من ${slides.length}" ${i === 0 ? 'aria-current="true"' : ''}><span></span></button>`).join('')}</div>${settings.hero_autoplay ? '<button class="store-hero__pause" type="button" data-hero-action="pause" aria-label="إيقاف العرض التلقائي">إيقاف</button>' : ''}` : '');
    hero.dataset.swipe = String(slides.length > 1);
    let active = 0, paused = matchMedia('(prefers-reduced-motion: reduce)').matches, explicitlyResumed = false;
    let gesture = null, suppressClickUntil = 0, nextAutoAt = 0;
    const pauseButton = hero.querySelector('[data-hero-action="pause"]');
    const updatePauseButton = () => {
        if (!pauseButton) return;
        pauseButton.textContent = paused ? 'تشغيل' : 'إيقاف';
        pauseButton.setAttribute('aria-label', paused ? 'تشغيل العرض التلقائي' : 'إيقاف العرض التلقائي');
    };
    updatePauseButton();
    hero.onfocusout = () => { explicitlyResumed = false; };
    const show = index => {
        active = (index + slides.length) % slides.length;
        hero.querySelectorAll('.store-hero__slide').forEach((el, i) => { el.hidden = i !== active; });
        hero.querySelectorAll('.store-hero__dot').forEach((dot, i) => {
            if (i === active) dot.setAttribute('aria-current', 'true');
            else dot.removeAttribute('aria-current');
        });
        nextAutoAt = Date.now() + settings.hero_interval * 1000;
    };
    hero.onclick = event => {
        if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
        const button = event.target.closest('[data-hero-action]');
        if (!button) return;
        if (button.dataset.heroAction === 'pause') { paused = !paused; explicitlyResumed = !paused; updatePauseButton(); }
        else show(Number(button.dataset.slideIndex));
    };
    const finishGesture = (event, cancelled = false) => {
        if (!gesture || event.pointerId !== gesture.id) return;
        const previous = gesture;
        gesture = null;
        previous.slide.style.removeProperty('transform');
        hero.classList.remove('is-dragging');
        if (hero.hasPointerCapture(event.pointerId)) hero.releasePointerCapture(event.pointerId);
        if (!previous.horizontal) return;
        suppressClickUntil = Date.now() + 400;
        if (!cancelled) {
            const dx = event.clientX - previous.x;
            const threshold = Math.min(80, Math.max(35, hero.clientWidth * .1));
            if (Math.abs(dx) >= threshold) show(active + (dx > 0 ? 1 : -1));
        }
    };
    hero.onpointerdown = event => {
        if (slides.length < 2 || !event.isPrimary || event.button !== 0 || event.target.closest('button')) return;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false, slide: hero.querySelector('.store-hero__slide:not([hidden])') };
    };
    hero.onpointermove = event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        if (!gesture.horizontal) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { finishGesture(event, true); return; }
            if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
            gesture.horizontal = true;
            hero.setPointerCapture(event.pointerId);
            hero.classList.add('is-dragging');
        }
        event.preventDefault();
        gesture.slide.style.transform = `translateX(${Math.max(-hero.clientWidth / 3, Math.min(hero.clientWidth / 3, dx))}px)`;
    };
    hero.onpointerup = event => finishGesture(event);
    hero.onpointercancel = event => finishGesture(event, true);
    hero.onlostpointercapture = event => finishGesture(event, true);
    hero.onpointerleave = event => { if (gesture && !gesture.horizontal) finishGesture(event, true); };
    hero.ondragstart = event => { if (slides.length > 1) event.preventDefault(); };
    if (settings.hero_autoplay && slides.length > 1) {
        timer = setInterval(() => {
            if (!gesture && Date.now() >= nextAutoAt && shouldAdvanceBanner({ paused, pageHidden: document.hidden,
                hoverCapable: matchMedia('(hover: hover) and (pointer: fine)').matches,
                hovered: hero.matches(':hover'), keyboardFocused: Boolean(hero.querySelector(':focus-visible')),
                explicitlyResumed })) show(active + 1);
        }, settings.hero_interval * 1000);
    }
}

function renderCategories() {
    if (!catalog) return;
    const categories = (catalog.categories || []).filter(c => c.is_active !== false);
    const links = categories.map(c => `<a href="${escape(categoryLink(c.slug))}">${escape(c.name_ar)}</a>`);
    const grid = document.querySelector('.category-grid');
    if (grid) grid.innerHTML = categories.length ? categories.map(c => `<a class="category-card" href="${escape(categoryLink(c.slug))}">${c.image_url ? `<img src="${escape(c.image_url)}" alt="" loading="lazy">` : '<span class="category-card__placeholder" aria-hidden="true">▦</span>'}<h3>${escape(c.name_ar)}</h3></a>`).join('') : '<p>ستتوفر الفئات قريباً.</p>';
    const nav = document.querySelector('.nav__list');
    if (nav) nav.innerHTML = `<li><a class="nav__link" href="index.html">الرئيسية</a></li>${categories.map(c => `<li><a class="nav__link" href="${escape(categoryLink(c.slug))}">${escape(c.name_ar)}</a></li>`).join('')}<li><a class="nav__link" href="track.html">متابعة فاتورتك</a></li>`;
    const quickNav = document.querySelector('.category-quick-nav');
    if (quickNav) quickNav.innerHTML = links.join('');
    const footerList = document.querySelector('.footer-col:last-child ul');
    if (footerList) footerList.innerHTML = links.map(link => `<li>${link}</li>`).join('');
}

function applyAppearance(value) {
    try { settings = validateAppearance(value); } catch { return; }
    const root = document.documentElement;
    root.classList.add('store-customized');
    root.style.setProperty('--primary-color', settings.primary_color);
    root.style.setProperty('--primary-dark', settings.primary_color);
    root.style.setProperty('--store-on-primary', contrast(settings.primary_color));
    root.style.setProperty('--radius-md', `${settings.corner_radius}px`);
    root.style.setProperty('--store-font-size', `${settings.font_size}px`);
    root.style.setProperty('--store-category-columns', settings.category_columns);
    root.style.setProperty('--store-product-columns', settings.product_columns);
    root.dataset.categoryStyle = settings.category_style;
    root.dataset.descriptions = String(settings.show_descriptions);
    document.querySelectorAll('.nav__logo').forEach(logo => {
        const name = logo.querySelector('span'); if (name) name.textContent = settings.brand_name;
        let image = logo.querySelector('.store-logo');
        if (settings.logo_url) {
            if (!image) { image = document.createElement('img'); image.className = 'store-logo'; image.alt = ''; logo.prepend(image); }
            image.src = settings.logo_url;
        } else image?.remove();
        const icon = logo.querySelector('svg'); if (icon) icon.style.display = settings.logo_url ? 'none' : '';
    });
    const header = document.querySelector('.header');
    if (header) {
        header.dataset.layout = settings.header_layout;
        header.style.position = settings.header_sticky ? 'sticky' : 'relative';
        let announcement = document.querySelector('.store-announcement');
        if (!announcement) { announcement = document.createElement('div'); announcement.className = 'store-announcement'; header.before(announcement); }
        announcement.textContent = settings.announcement_text;
        announcement.hidden = !settings.announcement_enabled || !settings.announcement_text;
    }
    const title = document.querySelector('#categories .section__title'); if (title) title.textContent = settings.category_title;
    const subtitle = document.querySelector('#categories .section__subtitle'); if (subtitle) subtitle.textContent = settings.category_subtitle;
    const footer = document.querySelector('.footer'); if (footer) { footer.hidden = !settings.footer_enabled; const text = footer.querySelector('.footer-col p'); if (text) text.textContent = settings.footer_text; }
    renderHero(); renderCategories();
}

async function start() {
    catalog = window.talagtyCatalog || null;
    window.addEventListener('talagty:catalog', event => { catalog = event.detail; renderCategories(); });
    if (preview) {
        applyAppearance(defaultAppearance);
        document.addEventListener('click', event => { if (event.target.closest('a,button') && !event.target.closest('[data-hero-action]')) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
        document.addEventListener('submit', event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
        window.addEventListener('message', event => { if (event.origin === location.origin && event.source === parent && event.data?.type === 'talagty-appearance-preview') applyAppearance(event.data.settings); });
        parent.postMessage({ type: 'talagty-preview-ready' }, location.origin);
        return;
    }
    try { const cached = localStorage.getItem('talagtyAppearance'); if (cached) applyAppearance(JSON.parse(cached)); } catch {}
    try {
        const base = (window.TALLAGTY_API_BASE_URL || '').replace(/\/$/, '');
        if (!base) return;
        const response = await fetch(`${base}/api/storefront/appearance`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        applyAppearance(data.settings);
        try { localStorage.setItem('talagtyAppearance', JSON.stringify(settings)); } catch {}
    } catch { /* Keep the last saved appearance available offline. */ }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
