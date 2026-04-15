

# Fix: Plus Jakarta Sans font 404 breaking PDF generation

## Problem
The Plus Jakarta Sans font URLs in `ProvaRevisadaDocument.tsx` point to version **v8** which Google Fonts has removed. Current version is **v12**, causing a 404 → "Unknown font format" error that crashes PDF generation.

## Fix

**File:** `src/lib/pdf/ProvaRevisadaDocument.tsx`

Update the `Font.register` block for PlusJakarta (lines 30-35) with the correct v12 Latin URLs:

```typescript
Font.register({
  family: 'PlusJakarta',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2', fontWeight: 700 },
  ],
});
```

Note: The latin subset URL is the same for both weights in the current Google Fonts API response for this font — both 600 and 700 resolve to the same woff2 file in the latin range. This is normal for variable fonts served as static subsets.

