export const defaultAppearance = {
  brand_name: 'تلاجتى', logo_url: '', primary_color: '#06b6d4',
  header_layout: 'standard', header_sticky: true,
  announcement_enabled: false, announcement_text: 'أهلاً بك في تلاجتى — اطلب احتياجاتك بسهولة',
  hero_mode: 'banner', hero_height: 'standard', hero_overlay: 45, hero_position: 'center',
  hero_autoplay: false, hero_interval: 6,
  slides: [{ title: 'منتجات طازجة لطلبك اليومي', text: 'تصفح منتجاتنا واختر احتياجاتك في خطوات بسيطة.', image_url: '', mobile_image_url: '', button_label: 'تسوق الآن', button_target: 'categories' }],
  font_size: 16, corner_radius: 12, category_style: 'cards', category_columns: 3,
  category_title: 'تسوق حسب الفئة', category_subtitle: 'اختر الفئة المناسبة لتجد منتجاتك بسرعة.',
  product_columns: 2, show_descriptions: true, footer_enabled: true,
  footer_text: 'تلاجتى — احتياجات متجرك في مكان واحد.'
};

export function imageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('رابط الصورة غير صحيح');
  const text = value.trim();
  if (!text) return '';
  let url;
  try { url = new URL(text); } catch { throw new Error('استخدم رابط صورة عام يبدأ بـ https://'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('استخدم رابط صورة آمن يبدأ بـ https://');
  if (url.hostname === 'drive.google.com') {
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
    if (id && /^[\w-]+$/.test(id)) return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
  }
  return url.href;
}

export function validateAppearance(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('إعدادات المظهر غير صحيحة');
  const result = structuredClone(defaultAppearance);
  for (const key of Object.keys(input)) if (!(key in defaultAppearance)) throw new Error('يوجد إعداد غير معروف');
  for (const [key, max] of Object.entries({ brand_name: 60, announcement_text: 180, category_title: 100, category_subtitle: 250, footer_text: 500 })) {
    const value = input[key] ?? result[key];
    if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u0008]/.test(value)) throw new Error('النص طويل أو غير صحيح');
    result[key] = value.trim();
  }
  if (!result.brand_name || !result.category_title) throw new Error('اكتب اسم المتجر وعنوان الفئات');
  for (const key of ['header_sticky', 'announcement_enabled', 'hero_autoplay', 'show_descriptions', 'footer_enabled']) {
    const value = input[key] ?? result[key];
    if (typeof value !== 'boolean') throw new Error('اختيار الظهور غير صحيح');
    result[key] = value;
  }
  for (const [key, options] of Object.entries({ header_layout: ['standard', 'centered', 'minimal'], hero_mode: ['slider', 'banner', 'split', 'hidden'], hero_height: ['compact', 'standard', 'tall'], hero_position: ['top', 'center', 'bottom'], category_style: ['cards', 'chips'], font_size: [16, 18, 20], corner_radius: [0, 12, 20], category_columns: [2, 3, 4], product_columns: [1, 2] })) {
    const value = input[key] ?? result[key];
    if (!options.includes(value)) throw new Error('اختيار تنسيق غير صحيح');
    result[key] = value;
  }
  result.primary_color = input.primary_color ?? result.primary_color;
  if (typeof result.primary_color !== 'string' || !/^#[0-9a-f]{6}$/i.test(result.primary_color)) throw new Error('لون المتجر غير صحيح');
  for (const [key, min, max] of [['hero_overlay', 0, 80], ['hero_interval', 4, 15]]) {
    const value = input[key] ?? result[key];
    if (!Number.isInteger(value) || value < min || value > max) throw new Error('قيمة العرض خارج النطاق المسموح');
    result[key] = value;
  }
  result.logo_url = imageUrl(input.logo_url ?? '');
  const slides = input.slides ?? result.slides;
  if (!Array.isArray(slides) || slides.length < 1 || slides.length > 6) throw new Error('أضف من صورة واحدة إلى 6 صور للبنر');
  result.slides = slides.map(slide => {
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) throw new Error('بيانات البنر غير صحيحة');
    const row = {};
    for (const [key, max] of Object.entries({ title: 120, text: 350, button_label: 40, button_target: 100 })) {
      if (typeof slide[key] !== 'string' || slide[key].length > max) throw new Error('نص البنر طويل أو غير صحيح');
      row[key] = slide[key].trim();
    }
    if (!row.title) throw new Error('اكتب عنواناً لكل بنر');
    if (!/^(categories|track|category:[a-z0-9-]{1,80})$/.test(row.button_target)) throw new Error('وجهة زر البنر غير صحيحة');
    row.image_url = imageUrl(slide.image_url ?? '');
    row.mobile_image_url = imageUrl(slide.mobile_image_url ?? '');
    return row;
  });
  return result;
}
