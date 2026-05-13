# 🔧 Refactoring Guide - Inline Styles to CSS Classes

## ✅ Completed (2026-05-13)

1. **Cleanup**: Deleted 42MB of old backups and legacy HTML files
2. **CSS**: Added 117 utility classes to `styles.css`
3. **Git**: Added `.gitignore` for backup/temp files

## 📋 CSS Utility Classes Available

Use these classes instead of inline `style="..."`:

### Flex Layout
```html
<!-- Old: style="display:flex; gap:10px; align-items:center" -->
<!-- New: -->
<div class="flex-c gap-10">...</div>
```

**Available classes:**
- `flex-c` = display:flex + align-items:center
- `flex-col` = flex-direction:column
- `flex-wrap` = flex-wrap:wrap
- `gap-2`, `gap-3`, `gap-4`, `gap-5`, `gap-6`, `gap-8`, `gap-10`, `gap-12`
- `justify-center`, `justify-between`

### Text & Font
```html
<!-- Old: style="font-weight:700; text-align:center" -->
<!-- New: -->
<div class="font-bold text-center">...</div>
```

**Available:**
- `font-bold`, `font-600`, `font-800`
- `text-center`, `text-right`, `text-left`
- `text-sm`, `text-xs`, `text-base`
- `text-primary`, `text-secondary`, `text-success`, `text-error`, `text-warning`

### Padding & Spacing
```html
<!-- Old: style="padding:10px; margin-bottom:6px" -->
<!-- New: -->
<div class="p-10 mb-6">...</div>
```

**Available:** `p-*`, `px-*`, `py-*`, `m-*`, `mb-*`, `mt-*`, `mr-*`  
(Numbers: 0, 2, 4, 6, 8, 10, 12, 14)

### Colors & Sizes
- `text-light` = color:#546e7a
- `rounded-6`, `rounded-8`, `rounded-10`
- `opacity-30`, `opacity-50`, `opacity-80`
- `cursor-pointer`, `whitespace-nowrap`

## 🎯 Next Steps

### Priority 1: Quick wins in core.js
- Search for `style="display:flex` patterns
- Replace with `flex-c` or `flex-col` + gap-X

### Priority 2: Color/Typography
- Replace `style="font-weight:700"` with `font-bold`
- Replace `style="font-size:.8rem"` with `text-sm`

### Priority 3: Consolidate
- After replacing, remove unused inline color definitions
- Move color vars to CSS variables in `styles.css`

## 📊 Current Stats

- **core.js**: 207 inline styles → Target: 50% reduction
- **activity.js**: 185 inline styles
- **cal.js**: 191 inline styles
- **gardens.js**: 178 inline styles
- **Total**: 925 inline styles to clean

## ⚠️ Notes

- Don't remove `style="..."` attributes that include dynamic values like:
  ```html
  style="background:${color};padding:${size}px"
  ```
  These need refactoring to CSS custom properties (next phase)

- Test in browser after each file to ensure styles still work
