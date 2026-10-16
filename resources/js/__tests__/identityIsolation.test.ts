import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLUGIN_IDENTIFIER } from '../index';

const root = resolve(__dirname, '../../..');

describe('glitter-gdpr identity isolation', () => {
    it('uses an independent runtime and IIFE identity', () => {
        const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
        expect(PLUGIN_IDENTIFIER).toBe('glitter-gdpr');
        expect(vite).toContain("name: 'GlitterGdpr'");
        expect(vite).not.toContain('SirsoftGdpr');
        expect((window as any).__GlitterGdpr?.identifier).toBe('glitter-gdpr');
        expect((window as any).__SirsoftGdpr).toBeUndefined();
    });

    it('keeps independently named assets and public banner CSS input', () => {
        const manifest = JSON.parse(readFileSync(resolve(root, 'plugin.json'), 'utf8'));
        const css = readFileSync(resolve(root, 'resources/css/banner.css'), 'utf8');
        expect(manifest.assets.js.output).toBe('dist/js/plugin.iife.js');
        expect(manifest.assets.css.output).toBe('dist/css/plugin.css');
        expect(css).toContain('@source "../extensions/cookie_banner.json"');
    });
});
