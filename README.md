# Sabara — Woven with Tradition

Sabara is a modern, premium e-commerce platform dedicated to handwoven natural-fibre mats. Crafted by artisans using traditional techniques, Sabara showcases beautiful floor mats, yoga mats, doormats, and table linens. 

Built using state-of-the-art web technologies, the application delivers a super-fast, responsive, and engaging user experience, backed by a robust admin panel and seamless database integration.

---

## 🚀 Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (React 19 + TanStack Router) for server-side rendering (SSR), type-safe routing, and fast data loading.
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) for modern, utility-first layouts and styling.
- **Database & Auth**: [Supabase](https://supabase.com/) for user authentication, product catalogs, and order management.
- **Components**: [Radix UI](https://www.radix-ui.com/) primitives combined with [Lucide React](https://lucide.dev/) icons.
- **State & Data Fetching**: [TanStack Query (React Query)](https://tanstack.com/query/latest) for robust async state management.
- **Bundler & Server**: [Vite](https://vite.dev/) with [Nitro](https://nitro.unjs.io/) and [Cloudflare Wrangler / Workers](https://developers.cloudflare.com/workers/) adapter for serverless deployment.

---

## ✨ Features

- **Storefront**: Browse high-quality natural-fibre collections by category (Floor Mats, Yoga Mats, Doormats, Table Linens).
- **Product Details**: Learn about the artisan stories, materials, dimensions, and craft background of each individual item.
- **Shopping Cart**: Fully functional interactive cart page (`/cart`) to adjust quantities and manage purchases.
- **Wishlist**: Save favorite items (`/wishlist`) for later consideration.
- **User Accounts**: Login, sign up, and view order histories and profile details (`/account`).
- **Admin Dashboard**: Comprehensive dashboard (`/admin`) for product catalogue management, order fulfillment tracking, and configuring site-wide hero settings.
- **Email Notifications**: Server-side transactional emails using **Nodemailer**.

---

## 🛠️ Getting Started

### 1. Prerequisites
Ensure you have Node.js and npm (or Bun) installed:
```bash
npm install -g bun
```

### 2. Install Dependencies
Install all package dependencies:
```bash
bun install
# or
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory and configure your Supabase credentials:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: Nodemailer config for emails
SMTP_HOST=your_smtp_host
SMTP_PORT=your_smtp_port
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
```

### 4. Running Locally
Run the development server:
```bash
bun dev
# or
npm run dev
```
The server will start, typically at `http://localhost:8080`.

### 5. Build for Production
To build the application for deployment (Vercel or Cloudflare Workers):
```bash
bun run build
# or
npm run build
```

---

## 📂 Project Structure

- `src/components/`
  - `site/` — Layout components like `Navbar`, `Footer`, and `ProductCard`.
  - `ui/` — Low-level reusable UI components (buttons, dialogs, dropdowns, etc.).
- `src/routes/` — Fully typed routes defining page views and Server Functions:
  - `index.tsx` — Homepage featuring stories, hero section, and featured items.
  - `shop.tsx` — Product catalog with client-side searching and filtering.
  - `product.$id.tsx` — Individual product detail page.
  - `cart.tsx` & `wishlist.tsx` — E-commerce utilities.
  - `account.tsx`, `login.tsx`, `signup.tsx` — Authentication and user profiling.
  - `admin.tsx` — Administrative management.
  - `api/` — Backend handler endpoints (checkout, seeding, settings, mailers).
- `src/integrations/supabase/` — Client & Server SDK configurations, JWT middleware, and Types.
- `src/services/` — Auth and business logic wrappers.
- `src/styles.css` — Global CSS stylesheet using Tailwind CSS v4 variables and custom layouts.

---

## 🗄️ Database Schemas

The application interacts with the following Supabase tables:
1. `products`: Catalog containing names, categories, prices, image URLs, descriptions, materials, and artisan story details.
2. `orders`: Record of purchases, client metadata, prices, status, and shipping information.
3. `user_profiles`: User-specific details and permissions.
4. `site_settings`: Global settings (such as the Hero background, titles, and layout configurations).
