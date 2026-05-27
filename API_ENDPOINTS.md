# ConstruPrice API - Complete Endpoint Documentation

## Overview
- Framework: FastAPI (Python)
- Base Path: /api
- Auth: JWT tokens via Authorization header
- Tenant-scoped: Most endpoints require tenant context

## AUTHENTICATION ROUTES (/api/auth)

POST /api/auth/login
- Auth: None (public)
- Login for tenant users
- Returns: JWT token, user info

POST /api/auth/super-admin/login
- Auth: None (public)
- Login for super admins (no tenant required)
- Returns: JWT token, user info

## USER MANAGEMENT ROUTES (/api/users)

GET /api/users/me - Get current user profile (Auth: Required)
PATCH /api/users/me - Update current user profile (Auth: Required)
GET /api/users - List all users in tenant (Auth: Required)
POST /api/users - Create new user (Auth: Required, admin+)
GET /api/users/{user_id} - Get specific user (Auth: Required)
PATCH /api/users/{user_id} - Update user (Auth: Required, admin+)
DELETE /api/users/{user_id} - Delete user (Auth: Required, admin+, Status: 204)
PATCH /api/users/{user_id}/toggle-status - Toggle active/inactive (Auth: Required, admin+)

## PRODUCT MANAGEMENT ROUTES (/api/products)

GET /api/products - List all products (Auth: Required)
POST /api/products - Create product (Auth: Required, Status: 201)
GET /api/products/{product_id} - Get product (Auth: Required)
PATCH /api/products/{product_id} - Update product (Auth: Required)
PATCH /api/products/{product_id}/variants - Update variants (Auth: Required)
DELETE /api/products/{product_id} - Delete product (Auth: Required, Status: 204)
POST /api/products/import-csv - Bulk import from CSV (Auth: Required, multipart/form-data)
POST /api/products/{product_id}/generate-variants - AI generate variants (Auth: Required)
POST /api/products/suggest-variants - AI suggest by name (Auth: Required)

## SUPPLIER MANAGEMENT ROUTES (/api/suppliers)

GET /api/suppliers - List suppliers (Auth: Required)
POST /api/suppliers - Create supplier (Auth: Required, Status: 201)
GET /api/suppliers/{supplier_id} - Get supplier (Auth: Required)
PATCH /api/suppliers/{supplier_id} - Update supplier (Auth: Required)
DELETE /api/suppliers/{supplier_id} - Delete supplier (Auth: Required, Status: 204)

## SEARCH/SCRAPING ROUTES (/api)

POST /api/search - Search all suppliers (Auth: Optional)
POST /api/search/stream - Streaming search with SSE (Auth: Optional, text/event-stream)
POST /api/search-by-supplier - Search single supplier (Auth: Optional)

## SAVED OFFERS ROUTES (/api/saves)

GET /api/saves - List saved offers (Auth: Required)
POST /api/saves - Save offer (Auth: Required)
DELETE /api/saves/{save_id} - Delete saved offer (Auth: Required)

## FEEDBACK ROUTES (/api/feedback)

POST /api/feedback - Submit feedback (Auth: Required, multipart/form-data)
GET /api/feedback - List feedback (Auth: Required, admin)
GET /api/feedback/{report_id} - Get feedback (Auth: Required, admin)
POST /api/feedback/{report_id}/reanalyze - Re-analyze (Auth: Required, admin)
PATCH /api/feedback/{report_id}/prompt - Edit prompt (Auth: Required, admin)
POST /api/feedback/{report_id}/validate - Validate feedback (Auth: Required, admin)
POST /api/feedback/{report_id}/execute - Create branch (Auth: Required, admin)
POST /api/feedback/{report_id}/merge - Mark merged (Auth: Required, admin)
POST /api/feedback/{report_id}/reject - Reject (Auth: Required, admin)
POST /api/feedback/{report_id}/chat - Chat with AI (Auth: Required, admin)

## AGENT/CHAT ROUTES (/api/agent)

POST /api/agent/chat - Interactive agent (Auth: Optional)

## TENANT MANAGEMENT ROUTES (/api/tenant*)

GET /api/tenant/me - Current tenant info (Auth: Optional)
POST /api/tenants/signup - Public signup (Auth: None, Status: 201)
GET /api/tenants/check-slug - Check slug availability (Auth: None)
GET /api/tenants - List tenants (Auth: Required, super admin)
POST /api/tenants - Create tenant (Auth: Required, super admin, Status: 201)
PATCH /api/tenants/{tenant_id} - Update tenant (Auth: Required, super admin)
DELETE /api/tenants/{tenant_id} - Delete tenant (Auth: Required, super admin, Status: 204)
POST /api/tenants/{tenant_id}/users - Create admin user (Auth: Required, super admin)

## ADMIN ROUTES (/api/admin)

GET /api/admin/scraper-sessions - List sessions (Auth: Required)
DELETE /api/admin/scraper-sessions/{scraper_key} - Delete session (Auth: Required)
DELETE /api/admin/scraper-sessions - Clear all sessions (Auth: Required)
POST /api/admin/reseed-suppliers - Reseed suppliers (Auth: Required)

## HEALTH ROUTES

GET /health - Health check (Auth: None)
GET / - API info (Auth: None)

## SCHEDULED TASKS

Catalog Scraper: Every 2 hours (local only, not on Vercel)

## ROUTE FILES

- /backend/app/api/routes/auth.py - Authentication
- /backend/app/api/routes/users.py - User management
- /backend/app/api/routes/products.py - Product management
- /backend/app/api/routes/suppliers.py - Supplier management
- /backend/app/api/routes/search.py - Search/scraping
- /backend/app/api/routes/saves.py - Saved offers
- /backend/app/api/routes/feedback.py - Feedback/suggestions
- /backend/app/api/routes/agent.py - Agent/chat
- /backend/app/api/routes/tenants.py - Tenant management
- /backend/main.py - Main app (health, admin routes, scheduler setup)

## USER ROLES

- super_admin: System administrator
- admin: Tenant administrator
- gerente: Manager
- funcionario: Employee

## FEEDBACK STATUS FLOW

pending > analyzed > validated > executing > deployed > merged
OR
pending > analyzed > validated > rejected
OR
analyzed > merged (auto-fix types)

