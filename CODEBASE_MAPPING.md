# PriceTracker Codebase Mapping for Multi-Tenancy Planning

## EXECUTIVE SUMMARY
Single-tenant app, email-based user IDs, NO tenant concept, mock JWT tokens.
Ready for refactor—minimal breaking changes.

---

## 1. SQLALCHEMY MODELS (backend/app/models/db_models.py)

UserDB (users):
  id (int, PK), nome, email (UNIQUE, indexed), telefone, empresa, cargo
  avatar, password_hash, role (ADMIN|GESTOR|USUARIO|FUNCIONARIO)
  parent_id (FK users.id—hierarchical, not tenant), is_active, created_at
  NO TENANT_ID

ProductDB (products):
  id (str, PK), name, category, brand, unit, sku, logo, notes
  variants (JSON), created_at
  NO SUPPLIER_ID, NO TENANT_ID

ScrapedProductDB (scraped_products):
  id (int), store, product_name, product_name_normalized
  price, currency, product_url, add_to_cart_url, image_url
  availability, sku, brand, source_query, scraper_key (indexed), scraped_at
  NO TENANT_ID

SupplierDB (suppliers):
  id (str, PK), name, url, logo
  requires_login, username, password
  is_active, region, notes, created_by (FK users.id), created_at
  NO TENANT_ID, only created_by tracking

SearchCacheDB (search_cache):
  scraper_key, query (both indexed), results (JSON), result_count
  created_at, updated_at
  GLOBAL (no tenant filter)

ScrapeTimingDB (scrape_timings):
  scraper_key (indexed), duration_seconds, query, created_at
  GLOBAL

SavedOfferDB (saved_offers):
  id (int), user_email (indexed), store, product_name, price, currency
  product_url, image_url, availability, sku, brand, created_at
  EMAIL-BASED SCOPING (not user_id)

FeedbackReportDB (feedback_reports):
  id (int), user_email, user_name (indexed)
  problem_type, search_query, expected_result, description
  ai_fix_type, ai_proposed_fix (JSON), ai_confidence, ai_explanation
  admin_email, admin_notes
  execution_status, execution_diff, execution_summary, execution_error
  branch_name, commit_sha, preview_url, branch_url
  created_at
  NO TENANT_ID

---

## 2. API ROUTES (backend/app/api/routes/)

auth.py:
  POST /login → token = f"mock-token-{email}"
  GET /users → hardcoded dev creds list

users.py:
  GET /users/me (requires get_current_user_email) → fetch by email
  PATCH /users/me → update profile
  GET /users → ALL users (no filtering)
  POST /users → create (no tenant assignment)

products.py:
  CRUD /products → no tenant filtering

suppliers.py:
  CRUD /suppliers → no tenant filtering
  POST /suppliers/{id}/test-connection

search.py (48KB):
  POST /search/query → main search, no tenant scoping
  GET /search/trending → top queries
  POST /search/instant → pre-scraped search
  GET /search/cached/{scraper_key}

saves.py:
  GET /saved-offers → filter by user_email
  POST /saved-offers, DELETE /saved-offers/{id}

feedback.py:
  GET /feedback → all feedback, no filtering
  POST /feedback → create
  PATCH /feedback/{id} → admin approval
  POST /feedback/{id}/execute → run AI fix

agent.py:
  POST /agent/auto-fix, GET /agent/fixes

---

## 3. AUTHENTICATION

Backend (backend/app/utils/auth.py):
  In-memory mock DB: {admin@construprice.com, gestor@construprice.com}
  
  authenticate_user(email, password):
    1. Look up in USERS_DB
    2. verify_password(plain, hashed) → SHA256(plain) == hashed
    3. Return {email, name, role}
  
  Login response: token = f"mock-token-{email}"
  
  Protected dependency get_current_user_email:
    1. Extract Authorization header
    2. Strip "Bearer " prefix
    3. Check token.startswith("mock-token-")
    4. Extract email from token
    5. Return email
  
  ISSUES:
    - No JWT validation
    - No token expiration
    - No JWT_SECRET in config
    - Email is globally unique
    - No tenant_id in token

Frontend (frontend/src/context/AuthContext.tsx):
  Storage: localStorage["construprice-auth"] = {email, displayName, role, token, avatar}
  
  login(email, password):
    1. Call authApi.login()
    2. Get {success, user, token}
    3. Store in localStorage as UserSession
    4. Fetch /users/me for avatar
  
  useAuth() hook:
    - Returns {user, isAuthenticated, login, logout, updateUser}
    - Reads localStorage on init
  
  ISSUES:
    - No token freshness validation
    - AuthContext stores email, not user_id

Protected routes (frontend/src/app/(protected)/layout.tsx):
  Empty file, no middleware
  Client-side logout redirect only

---

## 4. USER/TENANT SCOPING STATUS

CURRENT SCOPING:
  ✓ Email-based user identification (UserDB.email is UNIQUE)
  ✓ Role-based access (ADMIN, GESTOR, USUARIO, FUNCIONARIO)
  ✓ Hierarchical relationships (parent_id)
  ✓ Created-by tracking (suppliers.created_by)
  ✓ SavedOfferDB filters by user_email only

MISSING ENTIRELY:
  ✗ No tenant_id in any table
  ✗ No organization/workspace concept
  ✗ No data filtering except SavedOfferDB.user_email
  ✗ No supplier access control (all suppliers visible)
  ✗ No product/scrape filtering by ownership

EXAMPLE QUERIES (all unscoped):
  # Search all stores globally
  offers = await scraper_manager.scrape_store_async(...)
  
  # List all suppliers
  result = await db.execute(select(SupplierDB))
  
  # Only SavedOfferDB uses email filtering
  result = await db.execute(
    select(SavedOfferDB).filter(SavedOfferDB.user_email == email)
  )

---

## 5. FRONTEND STRUCTURE

Routes (frontend/src/app/):
  layout.tsx → Root layout
  providers.tsx → Providers wrapper
  login/page.tsx → Login form
  (protected)/ → Requires auth
    layout.tsx (empty)
    page.tsx, search/, results/, saves/, products/, suppliers/
    catalog/, feedback/, agent/, settings/

Contexts:
  AuthContext.tsx → {email, displayName, role, token, avatar}
  ProductCatalogContext.tsx → Global products
  SupplierContext.tsx → Global suppliers
  ThemeContext.tsx → Dark/light

ISSUES:
  - AuthContext stores email, not user_id
  - No workspace/tenant selector
  - No permission checking in routes (client-side only)

---

## 6. SCRAPER MANAGER (backend/app/services/scraper_manager.py)

Architecture:
  ThreadPoolExecutor(max_workers=5)
  circuit_breakers: Dict[scraper_key] → {failures, last_failure_time, is_open}

async scrape_store_async(scraper_class, query, scraper_key, credentials, force_refresh):
  Returns (offers, duration_seconds, scraper_key, error_message)

Flow:
  1. Check circuit breaker (open if 5+ failures in 5 min)
  2. Check cache (SearchCacheDB by scraper_key + query, 30 min TTL)
  3. Run scraper (ThreadPoolExecutor, 30s timeout)
  4. Record timing (ScrapeTimingDB)
  5. Cache results (SearchCacheDB)

Methods:
  _check_circuit_breaker(scraper_key) → bool
  _record_success(scraper_key) → reset failures
  _record_failure(scraper_key) → increment, open after 5
  _run_scraper(scraper_class, query, credentials) → ThreadPool

MULTI-TENANCY ISSUES:
  - No tenant_id in scraper calls
  - Cache is global (by scraper_key + query)
  - Circuit breaker is global (per scraper)

---

## 7. CONFIG FILES

backend/app/config.py:
  API_HOST, API_PORT, CORS_ORIGINS
  SCRAPING_TIMEOUT=10, MAX_CONCURRENT_SCRAPERS=5
  CREDENTIALS_ENCRYPTION_KEY (None)
  DATABASE_URL="postgresql+asyncpg://localhost/constructprice"
  REDIS_URL="redis://localhost:6379", SEARCH_CACHE_TTL=1800
  ANTHROPIC_API_KEY, GEMINI_API_KEY, PERPLEXITY_API_KEY, GROQ_API_KEY, OLLAMA_URL
  GITHUB_TOKEN, GITHUB_REPO, GIT_BASE_BRANCH, VERCEL_PREVIEW_PATTERN
  SUPPLIER_* credentials (hardcoded)
  
  MISSING FOR MULTI-TENANCY:
    JWT_SECRET_KEY
    JWT_ALGORITHM
    JWT_EXPIRATION_HOURS
    ALLOW_ORIGINS_CREDENTIALS

backend/app/database.py:
  create_async_engine(DATABASE_URL, pool_size=5, max_overflow=10)
  AsyncSession with async_sessionmaker
  get_db() → dependency
  create_tables() → runs on startup

---

## 8. MULTI-TENANCY ROADMAP

PHASE 1: Add Tenant Foundation (non-breaking)
  - Add tenant_id (nullable) to: users, suppliers, feedback_reports, saved_offers
  - Create TenantDB(id, name, owner_id, created_at)
  - Add to config: JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS

PHASE 2: Real JWT
  - Replace mock-token with JWT: {sub: user_id, email, tenant_id, role, exp}
  - Update get_current_user_email to decode & validate
  - Add tenant extraction middleware

PHASE 3: Query Scoping
  - Add WHERE tenant_id = current_tenant to all queries
    (NOT needed: products, scraped_products, search_cache—global)
  - Add endpoint guards for tenant access

PHASE 4: Frontend
  - Tenant selector in navbar (AuthContext)
  - Store tenant_id in localStorage
  - Pass X-Tenant-ID header in API calls

---

## FILE PATHS

Models: backend/app/models/db_models.py
Auth Utils: backend/app/utils/auth.py
Database: backend/app/database.py
Config: backend/app/config.py
Auth Routes: backend/app/api/routes/auth.py
Users Routes: backend/app/api/routes/users.py
Search Routes: backend/app/api/routes/search.py
Products Routes: backend/app/api/routes/products.py
Suppliers Routes: backend/app/api/routes/suppliers.py
Saves Routes: backend/app/api/routes/saves.py
Feedback Routes: backend/app/api/routes/feedback.py
Scraper Manager: backend/app/services/scraper_manager.py
Frontend Auth: frontend/src/context/AuthContext.tsx
Frontend Providers: frontend/src/app/providers.tsx
Protected Layout: frontend/src/app/(protected)/layout.tsx
