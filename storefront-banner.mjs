// Older saved designs allowed autoplay while still selecting single-image mode.
export function effectiveHeroMode(settings) {
    return settings.hero_mode === 'banner' && settings.hero_autoplay && settings.slides.length > 1
        ? 'slider' : settings.hero_mode;
}

export function shouldAdvanceBanner({ paused, pageHidden, hoverCapable, hovered, keyboardFocused, explicitlyResumed }) {
    return !paused && !pageHidden && !(hoverCapable && hovered) && (!keyboardFocused || explicitlyResumed);
}
