# RCE application fonts

The application uses **SUIT** for UI/body text and **Wanted Sans** for display headings. Font binaries are unmodified, version-pinned upstream releases, served locally through `src/styles/fonts.css`; no font CDN is required at runtime. The landing page retains its existing typography.

| CSS family | Role | Exposed weights | Upstream release | Local WOFF2 files | WOFF2 bytes |
| --- | --- | --- | --- | --- | --- |
| `SUIT` | Navigation, body, forms, tables, labels | 400–700 | SUIT v2.0.5 | 1 variable font | 624,536 |
| `Wanted Sans` | Page titles, section headings, prominent numbers | 600–700 | Wanted Sans v1.0.3 | 92 variable Unicode subsets | 2,281,860 |

SUIT's original variable file supports weights 100–900. Wanted Sans's original variable subsets support 400–1000. The CSS exposes only the ranges used by this UI; no separate thin, heavy, or intermediate font files are requested. Each face uses `font-display: swap` so text remains visible while fonts load.

Wanted Sans's total above is the complete local asset inventory, **not the initial page download**. Its original `unicode-range` declarations are retained: browsers request only subsets needed by visible headings. Keep every subset so newly created Korean assignment titles remain covered. Do not preload all 92 files. `WantedSansVariable.upstream.css` is preserved as an upstream reference; the runtime stylesheet is `src/styles/fonts.css`, with local paths, CSS aliases, and the limited weight ranges.

## Selection

- [SUIT's official project](https://github.com/sun-typeface/SUIT) describes it as a UI body typeface. It supplies a restrained Korean/Latin rhythm for dense forms and tables; the variable file supports the 600/700 weights already used by application labels without synthesizing bold text.
- [Wanted Sans's official project](https://github.com/wanteddev/wanted-sans) combines geometric construction with flexible, readable letterforms. Its character gives headings a distinct voice while remaining compatible with SUIT's body text. The upstream project provides [variable Unicode subsets for web use](https://github.com/wanteddev/wanted-sans/blob/v1.0.3/packages/wanted-sans/documentation/webfonts/README.md).
- [Pretendard](https://github.com/orioncactus/pretendard) was also reviewed: its Inter/Source Han Sans basis and cross-platform UI focus make it a credible alternative. SUIT plus Wanted Sans was selected to establish more separation between quiet UI text and display headings. This comparison is a design judgment, not an upstream performance claim.

## Sources and permissions

Both fonts are distributed under SIL Open Font License 1.1, permitting embedding and redistribution with their copyright/license notices. These assets keep their original binary names and embedded license information; the CSS family names are application aliases. No glyphs were altered or removed locally.

- SUIT: [official license](https://github.com/sun-typeface/SUIT/blob/v2.0.5/LICENSE), local `suit/LICENSE.txt`.
- Wanted Sans: [official license](https://github.com/wanteddev/wanted-sans/blob/v1.0.3/OFL.txt), local `wanted-sans/OFL.txt`.
- The same unmodified notices are copied to `public/font-licenses/SUIT-LICENSE.txt` and `public/font-licenses/Wanted-Sans-OFL.txt`, so Vite includes them in the production build.
- [SUIT variable WOFF2 source](https://raw.githubusercontent.com/sun-typeface/SUIT/v2.0.5/fonts/variable/woff2/SUIT-Variable.woff2).
- [Wanted Sans upstream subset stylesheet](https://raw.githubusercontent.com/wanteddev/wanted-sans/v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css) lists the official WOFF2 names; [one subset source](https://raw.githubusercontent.com/wanteddev/wanted-sans/v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/woff2/WantedSansVariable.split.90.woff2) illustrates the pinned path.
- `manifest.json` records every downloaded file's exact source URL, byte size, and SHA-256 hash.

## Verification

Checked against the saved local files on 2026-09-20, without downloading or rewriting the binaries:

- All 93 WOFF2 files have the `wOF2` signature and match the manifest's byte sizes and SHA-256 hashes.
- All 93 runtime CSS font URLs resolve to local files. SUIT exposes 400–700, and all 92 Wanted Sans faces expose 600–700. The Wanted Sans Unicode ranges match upstream.
- FontTools, using the existing Node.js Brotli decoder for inspection, successfully read each font's name, `fvar`, Unicode `cmap`, and embedded OFL metadata.
- SUIT's typographic family is `SUIT Variable`; its legacy default-instance name is `SUIT Variable Thin`. That legacy name does not indicate the rendered CSS weight. Wanted Sans's internal family is `Wanted Sans Variable`.
- SUIT contains 2,668 modern Korean syllables and covers every Korean syllable currently in `src` TypeScript/TSX files, including the UI sample `대시보드 과제 공지사항 내 제출물 프로필 설정 운영진 학생 관리 검토 대기 웹해킹 포너블 리버싱 포렌식` and Latin digits. Rare user-entered syllables outside this official font's coverage use the application's Korean system fallback.
- The union of the Wanted Sans subsets covers all 11,172 modern Korean syllables, supporting arbitrary Korean headings.

Browser rendering, network errors, production bundling, and responsive typography are verified separately by the application integration checks. This asset inspection alone does not claim that the browser rendered the intended family.
