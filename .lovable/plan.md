
# Fix: Replace Lovable Logo in Search Results with Aivia Logo

## Why This Happens
Google search results show a **favicon** next to your site URL. Your site has two favicon files:
- `public/favicon.png` — likely your Aivia logo (referenced in HTML)
- `public/favicon.ico` — likely the **default Lovable logo** that Google is picking up

Google's crawler often prefers the `.ico` file at the root, which is why the Lovable logo appears instead of Aivia's.

Additionally, the `og:image` meta tag in `index.html` points to `/favicon.jpg`, which doesn't exist.

## What Needs to Change

### 1. Replace `favicon.ico` with Aivia branding
- Convert the Aivia logo (`public/favicon.png`) into a proper `.ico` format and replace `public/favicon.ico`
- Alternatively, since you already have `favicon.png` set up, we can ensure the `.ico` file is also the Aivia logo by copying the PNG over it

### 2. Fix `og:image` meta tag
- Update `index.html` to point `og:image` and `twitter:image` to `/favicon.png` (which actually exists) instead of `/favicon.jpg` (which does not exist)

### 3. Wait for Google to re-crawl
- After publishing, it can take **days to weeks** for Google to update the favicon in search results
- You can speed this up by requesting a re-crawl via [Google Search Console](https://search.google.com/search-console)

## Technical Details

**File: `index.html`**
- Change `<meta property="og:image" content="/favicon.jpg" />` to `<meta property="og:image" content="/favicon.png" />`
- Change `<meta name="twitter:image" content="/favicon.jpg" />` to `<meta name="twitter:image" content="/favicon.png" />`

**File: `public/favicon.ico`**
- Replace with the Aivia logo so that any crawler requesting `/favicon.ico` gets the correct branding
