import { defaultAppearance, validateAppearance, imageUrl } from './supabase/functions/talagty-api/appearance-config.mjs';

const panel = document.getElementById('view-appearance');
const base = (window.TALLAGTY_API_BASE_URL || '').replace(/\/$/, '');
const previewMode = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('preview');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let draft = structuredClone(defaultAppearance), saved = structuredClone(defaultAppearance), revision = 0, loaded = false, busy = false, categories = [];
const $ = id => document.getElementById(id);
const dirty = () => JSON.stringify(draft) !== JSON.stringify(saved);
const status = (text, error = false) => { $('appearance-status').textContent = text; $('appearance-status').classList.toggle('error', error); };

panel.innerHTML = `<div class="section-toolbar"><div><h2>صمم متجرك بطريقتك</h2><p>غيّر الشكل، راجع المعاينة، ثم احفظ ليظهر التغيير للعملاء.</p></div><a class="btn btn-secondary" href="index.html" target="_blank" rel="noopener">فتح المتجر ↗</a></div>
    <div class="appearance-layout">
      <form id="appearance-form" class="appearance-editor">
        <div class="appearance-savebar"><div><strong id="appearance-dirty">المظهر المحفوظ</strong><small id="appearance-updated"></small></div><button type="submit" class="btn btn-primary" id="appearance-save" disabled>حفظ المظهر</button></div>
        <p id="appearance-status" role="status" aria-live="polite"></p>
        <fieldset id="appearance-fields" disabled></fieldset>
        <div class="appearance-draft-actions"><button type="button" id="appearance-undo" class="btn btn-secondary">إلغاء التعديلات</button><button type="button" id="appearance-defaults" class="btn btn-secondary">استعادة التصميم الافتراضي</button><button type="button" id="appearance-reload" class="btn btn-secondary">تحميل النسخة المحفوظة</button></div>
      </form>
      <aside class="appearance-preview"><div class="appearance-preview__bar"><div><strong>معاينة المتجر</strong><small>الأزرار هنا للعرض فقط</small></div><select id="appearance-device" aria-label="حجم شاشة المعاينة"><option value="390">هاتف 390</option><option value="320">هاتف صغير 320</option><option value="768">تابلت 768</option><option value="1100">كمبيوتر 1100</option></select></div><div class="appearance-preview__stage"><iframe id="appearance-frame" title="معاينة شكل المتجر" style="width:390px" referrerpolicy="same-origin"></iframe></div></aside>
    </div>`;

function field(key, label, type = 'text', max = 200) {
    return `<label>${label}<input data-field="${key}" type="${type}" value="${esc(draft[key])}" ${type === 'text' ? `maxlength="${max}"` : ''}></label>`;
}
function select(key, label, options) {
    return `<label>${label}<select data-field="${key}">${options.map(([v, text]) => `<option value="${v}" ${String(draft[key]) === String(v) ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
}
function check(key, label) { return `<label class="appearance-check"><input type="checkbox" data-field="${key}" ${draft[key] ? 'checked' : ''}>${label}</label>`; }
function photo(key, label, value, index = '') {
    return `<div class="appearance-photo"><label>${label}<input type="url" data-image-key="${key}" data-image-index="${index}" value="${esc(value)}" placeholder="رابط صورة عام أو رابط Google Drive"></label><div class="appearance-photo__actions"><label class="appearance-upload">رفع من الجهاز<input type="file" accept="image/png,image/jpeg,image/webp" data-upload-key="${key}" data-upload-index="${index}"></label><button type="button" data-clear-key="${key}" data-clear-index="${index}">إزالة الصورة</button></div><small>JPG، PNG أو WebP حتى 5 ميجابايت. رابط Drive يجب أن يكون متاحاً للجميع.</small></div>`;
}
function renderForm() {
    const slideCards = draft.slides.map((slide, i) => `<article class="appearance-slide"><div class="appearance-slide__head"><strong>البنر ${i + 1}</strong><div><button type="button" data-move="${i}" data-direction="-1" ${i === 0 ? 'disabled' : ''} aria-label="تحريك البنر لأعلى">↑</button><button type="button" data-move="${i}" data-direction="1" ${i === draft.slides.length - 1 ? 'disabled' : ''} aria-label="تحريك البنر لأسفل">↓</button><button type="button" data-remove-slide="${i}" ${draft.slides.length === 1 ? 'disabled' : ''}>حذف</button></div></div>
      <label>العنوان<input data-slide="${i}" data-key="title" maxlength="120" value="${esc(slide.title)}"></label>
      <label>الوصف<textarea data-slide="${i}" data-key="text" maxlength="350" rows="2">${esc(slide.text)}</textarea></label>
      ${photo('image_url', 'الصورة الرئيسية', slide.image_url, i)}${photo('mobile_image_url', 'صورة خاصة بالهاتف (اختياري)', slide.mobile_image_url, i)}
      <label>نص الزر (اتركه فارغاً لإخفائه)<input data-slide="${i}" data-key="button_label" maxlength="40" value="${esc(slide.button_label)}"></label>
      <label>الزر يفتح<select data-slide="${i}" data-key="button_target">${[['categories', 'فئات المنتجات'], ['track', 'متابعة الطلبات'], ...categories.map(c => [`category:${c.slug}`, c.name_ar]), ...(!categories.some(c => `category:${c.slug}` === slide.button_target) && slide.button_target.startsWith('category:') ? [[slide.button_target, 'الفئة المختارة سابقاً']] : [])].map(([v, text]) => `<option value="${esc(v)}" ${slide.button_target === v ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>
    </article>`).join('');
    $('appearance-fields').innerHTML = `
      <details open><summary><span>01</span> الهوية ورأس الصفحة</summary><div class="appearance-section">${field('brand_name', 'اسم المتجر', 'text', 60)}${photo('logo_url', 'شعار المتجر', draft.logo_url)}${select('header_layout', 'شكل رأس الصفحة', [['standard', 'شعار وروابط بجانبه'], ['centered', 'شعار في المنتصف'], ['minimal', 'مختصر مع قائمة']])}${check('header_sticky', 'تثبيت رأس الصفحة عند التمرير')}${check('announcement_enabled', 'إظهار شريط إعلان أعلى الصفحة')}${field('announcement_text', 'نص الإعلان', 'text', 180)}</div></details>
      <details open><summary><span>02</span> البنر والصور</summary><div class="appearance-section">${select('hero_mode', 'طريقة العرض', [['banner', 'صورة واحدة'], ['slider', 'صور متغيرة'], ['split', 'صورة بجانب النص'], ['hidden', 'إخفاء البنر']])}<p class="hint">الصورة الواحدة والتصميم المقسوم يستخدمان أول بنر. يمكنك تغيير الترتيب بالأسهم.</p>${select('hero_height', 'ارتفاع البنر', [['compact', 'صغير'], ['standard', 'متوسط'], ['tall', 'كبير']])}${select('hero_position', 'الجزء الظاهر من الصورة', [['center', 'المنتصف'], ['top', 'الأعلى'], ['bottom', 'الأسفل']])}<label>تعتيم الصورة لتحسين وضوح النص<input data-field="hero_overlay" type="range" min="0" max="80" value="${draft.hero_overlay}"></label>${check('hero_autoplay', 'تغيير الصور تلقائياً')}${select('hero_interval', 'الوقت بين الصور', [[4, '4 ثوانٍ'], [6, '6 ثوانٍ'], [8, '8 ثوانٍ'], [10, '10 ثوانٍ'], [15, '15 ثانية']])}${slideCards}<button type="button" class="btn btn-secondary" id="appearance-add-slide" ${draft.slides.length >= 6 ? 'disabled' : ''}>+ إضافة بنر</button></div></details>
      <details><summary><span>03</span> الألوان والقراءة</summary><div class="appearance-section">${field('primary_color', 'لون المتجر', 'color')}${select('font_size', 'حجم الخط', [[16, 'عادي'], [18, 'كبير'], [20, 'كبير جداً']])}${select('corner_radius', 'حواف البطاقات', [[0, 'مستقيمة'], [12, 'ناعمة'], [20, 'دائرية']])}</div></details>
      <details><summary><span>04</span> الفئات والمنتجات</summary><div class="appearance-section">${field('category_title', 'عنوان قسم الفئات', 'text', 100)}${field('category_subtitle', 'وصف قسم الفئات', 'text', 250)}${select('category_style', 'شكل الفئات', [['cards', 'بطاقات بصور'], ['chips', 'أزرار صغيرة']])}${select('category_columns', 'عدد الفئات في صف الهاتف', [[2, 'فئتان'], [3, '3 فئات'], [4, '4 فئات']])}${select('product_columns', 'عدد المنتجات في صف الهاتف', [[1, 'منتج واحد'], [2, 'منتجان']])}${check('show_descriptions', 'إظهار وصف المنتج')}<p class="hint">لتعديل صور الفئات وأسمائها، افتح قسم «الفئات» من القائمة.</p></div></details>
      <details><summary><span>05</span> أسفل المتجر</summary><div class="appearance-section">${check('footer_enabled', 'إظهار أسفل الصفحة')}<label>نبذة المتجر<textarea data-field="footer_text" maxlength="500" rows="3">${esc(draft.footer_text)}</textarea></label></div></details>`;
    update();
}
function update() {
    $('appearance-dirty').textContent = dirty() ? 'تعديلات لم تُحفظ بعد' : 'المظهر المحفوظ';
    $('appearance-save').disabled = busy || !loaded || previewMode || !dirty();
    $('appearance-fields').disabled = busy || !loaded;
    try { $('appearance-frame').contentWindow?.postMessage({ type: 'talagty-appearance-preview', settings: validateAppearance(draft) }, location.origin); } catch {}
}
async function request(path, options = {}) {
    const token = sessionStorage.getItem('tallagtyAdminToken');
    if (!token) throw new Error('سجل الدخول كمدير أولاً');
    const headers = { Authorization: `Bearer ${token}` };
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    let response;
    try { response = await fetch(`${base}${path}`, { ...options, headers, cache: 'no-store' }); } catch { throw new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 404 ? 'محرر المظهر يحتاج تحديث الخادم أولاً. طبّق ترقية المظهر وانشر دالة Supabase.' : result.detail || 'تعذر تنفيذ العملية');
    return result;
}
async function load() {
    if (busy) return;
    if (loaded && dirty() && !confirm('لديك تعديلات غير محفوظة. هل تريد تحميل النسخة المحفوظة وإلغاء هذه التعديلات؟')) return;
    busy = true; update(); status('جاري تحميل المظهر المحفوظ…');
    try {
        const result = previewMode ? { settings: defaultAppearance, revision: 0 } : await request('/api/admin/storefront/appearance');
        draft = validateAppearance(result.settings); saved = structuredClone(draft); revision = result.revision; loaded = true;
        try { const res = await fetch(`${base}/api/catalog`); if (res.ok) categories = (await res.json()).categories || []; } catch {}
        renderForm();
        $('appearance-updated').textContent = result.updated_at ? `آخر حفظ: ${new Date(result.updated_at).toLocaleString('ar-EG')}` : '';
        status(previewMode ? 'وضع معاينة: يمكنك تجربة التصميم هنا، والحفظ الفعلي متاح بعد تسجيل الدخول.' : 'المظهر جاهز للتعديل. لن يظهر التغيير للعملاء قبل الحفظ.');
    } catch (error) { status(error.message, true); }
    finally { busy = false; update(); }
}

$('appearance-form').addEventListener('input', event => {
    const el = event.target;
    if (el.dataset.field) { const numeric = ['font_size', 'corner_radius', 'category_columns', 'product_columns', 'hero_overlay', 'hero_interval']; draft[el.dataset.field] = el.type === 'checkbox' ? el.checked : numeric.includes(el.dataset.field) ? Number(el.value) : el.value; }
    if (el.dataset.slide !== undefined) draft.slides[Number(el.dataset.slide)][el.dataset.key] = el.value;
    if (el.dataset.imageKey) { const dest = el.dataset.imageIndex === '' ? draft : draft.slides[Number(el.dataset.imageIndex)]; dest[el.dataset.imageKey] = el.value; }
    update();
});
$('appearance-form').addEventListener('change', async event => {
    const input = event.target;
    if (!input.dataset.uploadKey || !input.files?.[0]) return;
    const file = input.files[0];
    if (previewMode) { status('رفع الصور متاح في لوحة الإدارة الفعلية. يمكنك تجربة رابط صورة في المعاينة.', true); input.value = ''; return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { status('اختر صورة JPG أو PNG أو WebP حتى 5 ميجابايت.', true); input.value = ''; return; }
    busy = true; update(); status('جاري رفع الصورة…');
    try {
        const form = new FormData(); form.append('image', file);
        const result = await request('/api/admin/storefront-images', { method: 'POST', body: form });
        const dest = input.dataset.uploadIndex === '' ? draft : draft.slides[Number(input.dataset.uploadIndex)];
        dest[input.dataset.uploadKey] = imageUrl(result.url);
        renderForm(); status('تم رفع الصورة. احفظ المظهر لتظهر للعملاء.');
    } catch (error) { status(error.message, true); }
    finally { busy = false; update(); }
});
$('appearance-form').addEventListener('click', event => {
    if (busy || !loaded) return;
    const button = event.target.closest('button'); if (!button) return;
    let render = false;
    if (button.id === 'appearance-add-slide' && draft.slides.length < 6) { draft.slides.push({ ...defaultAppearance.slides[0], title: 'عنوان بنر جديد' }); render = true; }
    if (button.dataset.removeSlide !== undefined && draft.slides.length > 1) { draft.slides.splice(Number(button.dataset.removeSlide), 1); render = true; }
    if (button.dataset.move !== undefined) { const i = Number(button.dataset.move), j = i + Number(button.dataset.direction); if (j >= 0 && j < draft.slides.length) { [draft.slides[i], draft.slides[j]] = [draft.slides[j], draft.slides[i]]; render = true; } }
    if (button.dataset.clearKey) { const dest = button.dataset.clearIndex === '' ? draft : draft.slides[Number(button.dataset.clearIndex)]; dest[button.dataset.clearKey] = ''; render = true; }
    if (button.id === 'appearance-undo') { draft = structuredClone(saved); render = true; status('تم إلغاء التعديلات غير المحفوظة.'); }
    if (button.id === 'appearance-defaults') { draft = structuredClone(defaultAppearance); render = true; status('تم تطبيق التصميم الافتراضي في المعاينة. اضغط حفظ لاعتماده.'); }
    if (render) renderForm();
});
$('appearance-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !loaded || previewMode) return;
    let settings;
    try { settings = validateAppearance(draft); } catch (error) { status(error.message, true); return; }
    busy = true; update(); status('جاري حفظ المظهر…');
    try {
        const result = await request('/api/admin/storefront/appearance', { method: 'PATCH', body: JSON.stringify({ settings, revision }) });
        saved = validateAppearance(result.settings); draft = structuredClone(saved); revision = result.revision;
        $('appearance-updated').textContent = `آخر حفظ: ${new Date(result.updated_at).toLocaleString('ar-EG')}`;
        renderForm(); status('تم حفظ المظهر بنجاح. سيظهر للعملاء عند فتح المتجر أو تحديث الصفحة.');
    } catch (error) { status(error.message, true); }
    finally { busy = false; update(); }
});
$('appearance-reload').addEventListener('click', load);
$('appearance-device').addEventListener('change', event => { $('appearance-frame').style.width = `${event.target.value}px`; });
window.addEventListener('message', event => { if (event.origin === location.origin && event.source === $('appearance-frame').contentWindow && event.data?.type === 'talagty-preview-ready') update(); });
window.addEventListener('appearance:reload', load);
window.addEventListener('beforeunload', event => { if (loaded && dirty()) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('click', event => { if (event.target.closest('[data-view="appearance"]')) { if (!$('appearance-frame').getAttribute('src')) $('appearance-frame').src = 'index.html?appearance-preview=1'; if (!loaded) load(); } });
renderForm();
