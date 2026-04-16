#!/usr/bin/env python3
"""
Debug script for SuperABCScraper to see what HTML we're getting
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.scrapers.superabc_scraper import SuperABCScraper
from bs4 import BeautifulSoup
import logging

# Configure logging to see what's happening
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def debug_superabc_scraper():
    """Debug the SuperABCScraper by examining the HTML"""
    print("=" * 50)
    print("Debugging SuperABCScraper")
    print("=" * 50)

    # Initialize scraper
    scraper = SuperABCScraper()
    print(f"Scraper initialized: {scraper.store_name}")
    print(f"Base URL: {scraper.base_url}")

    # Test query
    test_query = "cimento"
    print(f"\nTesting search for: '{test_query}'")

    # Manually fetch the page to see what we get
    query_encoded = __import__('urllib.parse').parse.quote(test_query)
    url = (
        f"{scraper.base_url}/index.php?route=product/search"
        f"&search={query_encoded}&description=1&page=1"
    )
    print(f"URL: {url}")

    try:
        resp = scraper.session.get(url, timeout=20, verify=False, headers={"Referer": scraper.base_url + "/"})
        print(f"Status: {resp.status_code}")
        print(f"Content length: {len(resp.text)}")

        # Save HTML for inspection
        with open("debug_superabc_page.html", "w", encoding="utf-8") as f:
            f.write(resp.text)
        print("Saved HTML to debug_superabc_page.html")

        # Parse with BeautifulSoup
        soup = BeautifulSoup(resp.text, "html.parser")

        # Check title
        title = soup.find("title")
        print(f"Title: {title.get_text(strip=True) if title else 'NO TITLE'}")

        # Look for common product container patterns
        print("\nChecking for product containers:")

        selectors_to_try = [
            ".main-posts .post-layout",
            ".post-layout",
            ".product-layout",
            ".product-thumb",
            ".product-item",
            "[class*='product']",
            ".item-product",
            ".product"
        ]

        for selector in selectors_to_try:
            elements = soup.select(selector)
            print(f"  {selector}: {len(elements)} elements")
            if elements:
                # Show first element's classes and a bit of HTML
                first = elements[0]
                print(f"    First element classes: {first.get('class', [])}")
                print(f"    First element tag: {first.name}")
                if len(elements) > 0 and len(elements) < 5:
                    for i, el in enumerate(elements[:3]):
                        print(f"    Element {i+1}: {el.name} with classes {el.get('class', [])}")

        # Look for any text containing "Produto" or product-like content
        print("\nChecking for product-related text:")
        page_text = soup.get_text()
        if "produto" in page_text.lower():
            print("  Found 'produto' in page text")
        if "preço" in page_text.lower() or "price" in page_text.lower():
            print("  Found 'preço' or 'price' in page text")
        if "adicionar ao carrinho" in page_text.lower() or "add to cart" in page_text.lower():
            print("  Found 'add to cart' text")

        # Show a snippet of the page text
        print(f"\nPage text snippet (first 500 chars):")
        print(repr(page_text[:500]))

        # Check if we're getting a login page or captcha
        if "login" in url.lower() or "account" in url.lower():
            print("  WARNING: URL contains login/account - might be redirected to login")
        if "captcha" in page_text.lower():
            print("  WARNING: CAPTCHA detected in page")

    except Exception as e:
        logger.error(f"Error during debugging: {e}", exc_info=True)
        print(f"\nERROR: {e}")

if __name__ == "__main__":
    debug_superabc_scraper()