import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAppearance, validateAppearance, imageUrl } from '../supabase/functions/talagty-api/appearance-config.mjs';
import { appearanceApi } from '../supabase/functions/talagty-api/appearance-api.mjs';

function database({ active = true, unavailable = false } = {}) {
    let row = { settings: {}, revision: 0, updated_at: new Date().toISOString() };
    return {
        from(table) {
            const filters = {}; let change;
            return {
                select() { return this; }, eq(key, value) { filters[key] = value; return this; },
                update(value) { change = value; return this; },
                async maybeSingle() {
                    if (unavailable) return { data: null, error: { code: '42P01' } };
                    if (table === 'users') return { data: active ? { id: 1 } : null, error: null };
                    if (change && filters.revision !== row.revision) return { data: null, error: null };
                    if (change) row = { ...row, ...change };
                    return { data: structuredClone(row), error: null };
                }
            };
        }
    };
}
const adminRoute = '/api/admin/storefront/appearance';
const publicRoute = '/api/storefront/appearance';
const get = route => new Request(`https://example.test${route}`);
const patch = body => new Request(`https://example.test${adminRoute}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

test('defaults are valid and independent copies', () => {
    const copy = validateAppearance({}); assert.deepEqual(copy, defaultAppearance);
    copy.slides[0].title = 'Changed'; assert.notEqual(copy.slides[0].title, defaultAppearance.slides[0].title);
});
test('all supported header modes validate', () => {
    for (const hero_mode of ['banner', 'slider', 'split', 'hidden']) assert.equal(validateAppearance({ hero_mode }).hero_mode, hero_mode);
});
test('unsafe image URLs and arbitrary button destinations are rejected', () => {
    for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg>', 'http://example.com/a.jpg', 'https://user:pass@example.com/a.jpg']) assert.throws(() => imageUrl(url));
    assert.throws(() => validateAppearance({ slides: [{ ...defaultAppearance.slides[0], button_target: 'https://attacker.test' }] }));
});
test('Drive links normalize without accepting lookalike hosts', () => {
    assert.equal(imageUrl('https://drive.google.com/file/d/abc123/view'), 'https://drive.google.com/thumbnail?id=abc123&sz=w1600');
    assert.equal(imageUrl('https://drive.google.com.evil.test/file/d/abc123/view'), 'https://drive.google.com.evil.test/file/d/abc123/view');
});
test('malformed, oversized and out-of-range designs are rejected', () => {
    for (const value of [null, [], { primary_color: 'red' }, { font_size: 80 }, { slides: [] }, { header_sticky: 'true' }, { extra: true }, { slides: Array(7).fill(defaultAppearance.slides[0]) }, { brand_name: 'x'.repeat(61) }]) assert.throws(() => validateAppearance(value));
});
test('public read returns defaults from the seeded row', async () => {
    const result = await appearanceApi(get(publicRoute), publicRoute, database());
    assert.equal(result.status, 200); assert.deepEqual(result.body.settings, defaultAppearance);
});
test('admin routes reject missing and inactive administrators', async () => {
    assert.equal((await appearanceApi(get(adminRoute), adminRoute, database())).status, 401);
    assert.equal((await appearanceApi(get(adminRoute), adminRoute, database({ active: false }), 1)).status, 403);
});
test('save persists then public read sees the same settings', async () => {
    const db = database(), settings = { ...defaultAppearance, brand_name: 'تلاجتى الجديدة', hero_mode: 'split' };
    const result = await appearanceApi(patch({ settings, revision: 0 }), adminRoute, db, 1);
    assert.equal(result.status, 200); assert.equal(result.body.revision, 1);
    const read = await appearanceApi(get(publicRoute), publicRoute, db);
    assert.equal(read.body.settings.brand_name, settings.brand_name); assert.equal(read.body.settings.hero_mode, 'split');
});
test('stale saves cannot overwrite newer edits', async () => {
    const db = database();
    assert.equal((await appearanceApi(patch({ settings: defaultAppearance, revision: 0 }), adminRoute, db, 1)).status, 200);
    assert.equal((await appearanceApi(patch({ settings: { brand_name: 'stale' }, revision: 0 }), adminRoute, db, 1)).status, 409);
    assert.equal((await appearanceApi(get(publicRoute), publicRoute, db)).body.settings.brand_name, 'تلاجتى');
});
test('invalid payload cannot be saved and missing migration gives useful failure', async () => {
    assert.equal((await appearanceApi(patch({ settings: { primary_color: 'javascript:x' }, revision: 0 }), adminRoute, database(), 1)).status, 422);
    assert.equal((await appearanceApi(get(publicRoute), publicRoute, database({ unavailable: true }))).status, 503);
});
test('public writes and invalid image contents are rejected', async () => {
    const request = new Request(`https://example.test${publicRoute}`, { method: 'POST' });
    assert.equal((await appearanceApi(request, publicRoute, database())).status, 405);
    const form = new FormData(); form.append('image', new File(['this is not a png image'], 'fake.png', { type: 'image/png' }));
    const upload = new Request('https://example.test/api/admin/storefront-images', { method: 'POST', body: form });
    assert.equal((await appearanceApi(upload, '/api/admin/storefront-images', database(), 1)).status, 422);
});
