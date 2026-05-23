// This file is intentionally empty.
// The homepage is served from app/[lang]/(home)/page.tsx
// Next.js route groups allow (home) to resolve to the same /[lang] URL.
// Having both this file AND (home)/page.tsx causes a route conflict.
// Delete this file if you see a build error about duplicate routes.
export { default, metadata } from "./(home)/page"
