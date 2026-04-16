#!/usr/bin/env python3
"""
Examine the debug HTML file saved from the scraper and write output to a file
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

def examine_file():
    filename = "debug_superabc_page.html"
    if not os.path.exists(filename):
        print(f"File {filename} not found")
        return

    # Read as binary to see what we have
    with open(filename, "rb") as f:
        data = f.read()
    print(f"File size: {len(data)} bytes")
    print(f"First 20 bytes: {data[:20]}")
    print(f"Last 20 bytes: {data[-20:]}")

    # Try to decode as utf-8
    try:
        text = data.decode('utf-8')
        print(f"Decoded as UTF-8, length: {len(text)} characters")
        # Look for DOCTYPE
        if '<!DOCTYPE' in text.upper():
            print("Contains DOCTYPE")
        # Look for common product-related text
        lower_text = text.lower()
        if 'produto' in lower_text:
            print("Contains 'produto'")
        if 'preço' in lower_text or 'price' in lower_text:
            print("Contains 'preço' or 'price'")
        if 'adicionar ao carrinho' in lower_text or 'add to cart' in lower_text:
            print("Contains 'add to cart'")
        # Save a snippet to see
        with open("debug_snippet.txt", "w", encoding="utf-8") as f:
            f.write("--- First 500 characters ---\n")
            f.write(text[:500])
            f.write("\n\n--- Last 500 characters ---\n")
            f.write(text[-500:])
        print("Saved snippet to debug_snippet.txt")
    except UnicodeDecodeError as e:
        print(f"Cannot decode as UTF-8: {e}")
        # Try other encodings
        for enc in ['latin-1', 'cp1252', 'iso-8859-1']:
            try:
                text = data.decode(enc)
                print(f"Decoded as {enc}, length: {len(text)}")
                with open(f"debug_decoded_{enc}.txt", "w", encoding="utf-8") as f:
                    f.write(text[:1000])
                print(f"Saved first 1000 chars decoded with {enc} to debug_decoded_{enc}.txt")
                break
            except UnicodeDecodeError:
                continue

if __name__ == "__main__":
    examine_file()