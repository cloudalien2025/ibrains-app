#!/usr/bin/env python3
import argparse
import json
import os
import sys


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))


def snippet_around(text, query, radius=280):
    if not text:
      return ""
    lower_text = text.lower()
    lower_query = query.lower()
    idx = lower_text.find(lower_query)
    if idx < 0:
      return ""
    start = max(0, idx - radius)
    end = min(len(text), idx + len(query) + radius)
    return " ".join(text[start:end].split())


def main():
    parser = argparse.ArgumentParser(description="Extract page text and links for SKU evidence from PDF using PyMuPDF")
    parser.add_argument("--pdf", required=True, help="Absolute/local path to PDF")
    parser.add_argument("--query", required=True, help="Search term, usually SKU")
    parser.add_argument("--max-snippets", type=int, default=4)
    args = parser.parse_args()

    result = {
        "found": False,
        "pageNumbers": [],
        "textSnippets": [],
        "links": [],
        "errors": [],
        "sourceFile": args.pdf,
        "provenance": {
            "extractor": "pymupdf_pdf_evidence_v1",
            "query": args.query,
        },
    }

    if not os.path.isfile(args.pdf):
        result["errors"].append("pdf_file_not_found")
        emit(result)
        return

    try:
        import fitz  # type: ignore
    except Exception as exc:
        result["errors"].append(f"pymupdf_import_failed:{type(exc).__name__}")
        emit(result)
        return

    try:
        doc = fitz.open(args.pdf)
    except Exception as exc:
        result["errors"].append(f"pdf_open_failed:{type(exc).__name__}")
        emit(result)
        return

    try:
        for page_index in range(len(doc)):
            page = doc.load_page(page_index)
            page_no = page_index + 1
            text = page.get_text("text") or ""
            if args.query.lower() in text.lower():
                result["found"] = True
                result["pageNumbers"].append(page_no)
                if len(result["textSnippets"]) < args.max_snippets:
                    snip = snippet_around(text, args.query)
                    if snip:
                        result["textSnippets"].append({"pageNumber": page_no, "text": snip})

                try:
                    links = page.get_links() or []
                    for link in links:
                        uri = link.get("uri") if isinstance(link, dict) else None
                        if uri:
                            result["links"].append({"pageNumber": page_no, "uri": uri})
                except Exception:
                    result["errors"].append(f"page_links_failed:{page_no}")
    finally:
        doc.close()

    # Keep deterministic ordering while removing duplicates.
    dedup = set()
    unique_links = []
    for link in result["links"]:
        key = f"{link.get('pageNumber')}::{link.get('uri')}"
        if key in dedup:
            continue
        dedup.add(key)
        unique_links.append(link)
    result["links"] = unique_links

    emit(result)


if __name__ == "__main__":
    main()
