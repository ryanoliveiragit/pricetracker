#!/usr/bin/env python3
"""
Check the encoding/compression of the Super ABC response
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

import requests
from bs4 import BeautifulSoup
import gzip
import zlib

def check_response():
    url = "https://superabcdistribuidora.com.br/index.php?route=product/search&search=cimento&description=1&page=1"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    print(f"Fetching: {url}")
    resp = requests.get(url, headers=headers, timeout=20, verify=False)

    print(f"Status: {resp.status_code}")
    print(f"Headers: {dict(resp.headers)}")
    print(f"Content-Encoding: {resp.headers.get('Content-Encoding', 'None')}")
    print(f"Content-Type: {resp.headers.get('Content-Type', 'None')}")
    print(f"Raw content length: {len(resp.content)}")
    print(f"Decoded content length: {len(resp.text)}")

    # Check if content looks like it's compressed
    content_preview = resp.content[:20]
    print(f"First 20 bytes of raw content: {content_preview}")

    # Try to decompress if needed
    encoding = resp.headers.get('Content-Encoding', '').lower()
    if encoding == 'gzip':
        print("Content is gzip encoded, decompressing...")
        try:
            decompressed = gzip.decompress(resp.content)
            print(f"Decompressed length: {len(decompressed)}")
            # Try to decode as UTF-8
            text = decompressed.decode('utf-8')
            print(f"Decoded text length: {len(text)}")
            # Save for inspection
            with open("debug_gzip_decompressed.html", "w", encoding="utf-8") as f:
                f.write(text)
            print("Saved decompressed content to debug_gzip_decompressed.html")
        except Exception as e:
            print(f"Error decompressing gzip: {e}")
    elif encoding == 'deflate':
        print("Content is deflate encoded, decompressing...")
        try:
            decompressed = zlib.decompress(resp.content)
            print(f"Decompressed length: {len(decompressed)}")
            text = decompressed.decode('utf-8')
            print(f"Decoded text length: {len(text)}")
        except Exception as e:
            print(f"Error decompressing deflate: {e}")
    elif 'br' in encoding:
        print("Content is brotli encoded, but brotli module not installed. Skipping decompression.")
        print("You can install brotli with: pip install brotli")
    else:
        print("No known content encoding, using resp.text")
        # Save the text for inspection
        with open("debug_raw_text.html", "w", encoding="utf-8") as f:
            f.write(resp.text)
        print("Saved raw text to debug_raw_text.html")

        # Also save raw content
        with open("debug_raw_content.bin", "wb") as f:
            f.write(resp.content)
        print("Saved raw content to debug_raw_content.bin")

if __name__ == "__main__":
    check_response()