import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveHeroMode, shouldAdvanceBanner } from '../storefront-banner.mjs';

test('existing saved single-image mode with autoplay uses both banners', () => {
    assert.equal(effectiveHeroMode({ hero_mode: 'banner', hero_autoplay: true, slides: [{}, {}] }), 'slider');
    assert.equal(effectiveHeroMode({ hero_mode: 'banner', hero_autoplay: false, slides: [{}, {}] }), 'banner');
    assert.equal(effectiveHeroMode({ hero_mode: 'hidden', hero_autoplay: true, slides: [{}, {}] }), 'hidden');
});
test('a sticky touch hover does not stop rotation; real desktop hover does', () => {
    const state = { paused: false, pageHidden: false, hoverCapable: false, hovered: true, keyboardFocused: false, explicitlyResumed: false };
    assert.equal(shouldAdvanceBanner(state), true);
    assert.equal(shouldAdvanceBanner({ ...state, hoverCapable: true }), false);
    assert.equal(shouldAdvanceBanner({ ...state, paused: true }), false);
    assert.equal(shouldAdvanceBanner({ ...state, pageHidden: true }), false);
});
test('keyboard focus pauses rotation but explicit play resumes it', () => {
    const state = { paused: false, pageHidden: false, hoverCapable: false, hovered: false, keyboardFocused: true, explicitlyResumed: false };
    assert.equal(shouldAdvanceBanner(state), false);
    assert.equal(shouldAdvanceBanner({ ...state, explicitlyResumed: true }), true);
});
