export interface Fingerprint {
    userAgent: string;
    platform: string;
    viewport: { width: number; height: number };
    locale: string;
    deviceScaleFactor: number;
}

export interface FingerprintFilter {
    deviceType?: 'all' | 'desktop' | 'mobile';
    os?: 'all' | 'windows' | 'macos' | 'ios' | 'android';
}

const DESKTOP_VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 2560, height: 1440 },
];

const MOBILE_VIEWPORTS = [
    { width: 390, height: 844 }, // iPhone 12/13/14
    { width: 414, height: 896 }, // iPhone XR/11
    { width: 360, height: 800 }, // Samsung S20/S21
    { width: 412, height: 915 }, // Pixel 6/7
    { width: 393, height: 851 }, // Pixel 5
];

const LOCALES = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ru-RU', 'pt-BR', 'ja-JP'];

interface FingerprintDefinition {
    ua: string;
    os: 'windows' | 'macos' | 'ios' | 'android';
    type: 'desktop' | 'mobile';
    platform: string;
}

const FINGERPRINTS: FingerprintDefinition[] = [
    // Windows Desktop (Chrome/Edge)
    {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        os: 'windows',
        type: 'desktop',
        platform: 'Win32',
    },
    {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
        os: 'windows',
        type: 'desktop',
        platform: 'Win32',
    },
    {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
        os: 'windows',
        type: 'desktop',
        platform: 'Win32',
    },

    // MacOS Desktop (Chrome/Safari)
    {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        os: 'macos',
        type: 'desktop',
        platform: 'MacIntel',
    },
    {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        os: 'macos',
        type: 'desktop',
        platform: 'MacIntel',
    },

    // iOS Mobile (Safari)
    {
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        os: 'ios',
        type: 'mobile',
        platform: 'iPhone',
    },
    {
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        os: 'ios',
        type: 'mobile',
        platform: 'iPhone',
    },

    // Android Mobile (Chrome)
    {
        ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        os: 'android',
        type: 'mobile',
        platform: 'Linux armv8l',
    },
    {
        ua: 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        os: 'android',
        type: 'mobile',
        platform: 'Linux armv8l',
    },
];

export function generateFingerprint(filter: FingerprintFilter = {}): Fingerprint {
    let candidates = FINGERPRINTS;

    // Filter by Device Type
    if (filter.deviceType && filter.deviceType !== 'all') {
        candidates = candidates.filter((f) => f.type === filter.deviceType);
    }

    // Filter by OS
    if (filter.os && filter.os !== 'all') {
        candidates = candidates.filter((f) => f.os === filter.os);
    }

    // Fallback if filtering leaves no results
    if (candidates.length === 0) {
        candidates = FINGERPRINTS;
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];

    // Select appropriate viewport
    let viewport;
    let scaleFactor = 1;

    if (selected.type === 'mobile') {
        viewport = MOBILE_VIEWPORTS[Math.floor(Math.random() * MOBILE_VIEWPORTS.length)];
        scaleFactor = 2 + Math.random(); // 2x or 3x retina
    } else {
        viewport = DESKTOP_VIEWPORTS[Math.floor(Math.random() * DESKTOP_VIEWPORTS.length)];
        scaleFactor = 1 + Math.random() * 0.5; // 1x to 1.5x
    }

    const locale = LOCALES[Math.floor(Math.random() * LOCALES.length)];

    return {
        userAgent: selected.ua,
        platform: selected.platform,
        viewport: viewport,
        locale: locale,
        deviceScaleFactor: scaleFactor,
    };
}
