#!/usr/bin/env python3
import argparse
import hashlib
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


def file_sha256(path):
    sha = hashlib.sha256()
    with open(path, "rb") as file_handle:
        while True:
            chunk = file_handle.read(1024 * 1024)
            if not chunk:
                break
            sha.update(chunk)
    return sha.hexdigest()


def safe_page_label(doc, page_index):
    try:
        return doc.get_page_label(page_index)  # type: ignore[attr-defined]
    except Exception:
        return None


def render_page_image(page, output_path, dpi):
    pix = page.get_pixmap(dpi=dpi, alpha=False)
    pix.save(output_path)
    return output_path


def render_panel_crop(page, output_path, dpi):
    rect = None
    try:
        matches = page.search_for("Supplement Facts")
        if matches:
            first = matches[0]
            x0 = max(0, first.x0 - 24)
            y0 = max(0, first.y0 - 40)
            x1 = min(page.rect.width, page.rect.width)
            y1 = min(page.rect.height, first.y0 + (page.rect.height * 0.7))
            rect = (x0, y0, x1, y1)
    except Exception:
        rect = None

    if rect is None:
        return None

    pix = page.get_pixmap(dpi=dpi, alpha=False, clip=rect)
    pix.save(output_path)
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Extract page text and links for SKU evidence from PDF using PyMuPDF")
    parser.add_argument("--pdf", required=True, help="Absolute/local path to PDF")
    parser.add_argument("--query", required=True, help="Search term, usually SKU")
    parser.add_argument("--sku", default=None, help="SKU token for context")
    parser.add_argument("--product-name", default=None, help="Product name for context")
    parser.add_argument("--max-snippets", type=int, default=4)
    parser.add_argument("--render-pages", action="store_true", help="Render candidate pages to images")
    parser.add_argument("--crop-panel", action="store_true", help="Try deterministic Supplement Facts panel crop")
    parser.add_argument("--render-dir", default=None, help="Render output directory")
    parser.add_argument("--render-dpi", type=int, default=144)
    args = parser.parse_args()

    result = {
        "found": False,
        "sku": args.sku or None,
        "productName": args.product_name or None,
        "candidatePages": [],
        "pageNumbers": [],
        "textSnippets": [],
        "links": [],
        "errors": [],
        "sourceFile": args.pdf,
        "sourceHash": None,
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
        try:
            result["sourceHash"] = file_sha256(args.pdf)
        except Exception:
            result["errors"].append("source_hash_failed")

        render_dir = None
        if args.render_pages and args.render_dir:
            try:
                os.makedirs(args.render_dir, exist_ok=True)
                render_dir = args.render_dir
            except Exception:
                result["errors"].append("render_dir_unavailable")

        for page_index in range(len(doc)):
            page = doc.load_page(page_index)
            page_no = page_index + 1
            text = page.get_text("text") or ""
            lower_text = text.lower()
            query_hit = args.query.lower() in lower_text
            sku_hit = (args.sku or "").lower() in lower_text if args.sku else False
            name_hit = (args.product_name or "").lower() in lower_text if args.product_name else False
            if query_hit or sku_hit or name_hit:
                result["found"] = True
                result["pageNumbers"].append(page_no)
                page_links = []
                try:
                    links = page.get_links() or []
                    for link in links:
                        uri = link.get("uri") if isinstance(link, dict) else None
                        if uri:
                            page_links.append(uri)
                            result["links"].append({"pageNumber": page_no, "uri": uri})
                except Exception:
                    result["errors"].append(f"page_links_failed:{page_no}")

                if len(result["textSnippets"]) < args.max_snippets:
                    snip = snippet_around(text, args.query)
                    if snip:
                        result["textSnippets"].append({"pageNumber": page_no, "text": snip})

                rendered_image_path = None
                panel_image_path = None
                warnings = []
                if args.render_pages and render_dir:
                    page_image = os.path.join(render_dir, f"page-{page_no}.png")
                    try:
                        rendered_image_path = render_page_image(page, page_image, args.render_dpi)
                    except Exception:
                        warnings.append("page_render_failed")
                    if args.crop_panel:
                        panel_image = os.path.join(render_dir, f"page-{page_no}-panel.png")
                        try:
                            panel_image_path = render_panel_crop(page, panel_image, args.render_dpi)
                            if panel_image_path is None:
                                warnings.append("panel_crop_not_found")
                        except Exception:
                            warnings.append("panel_crop_failed")

                catalog_page_label = safe_page_label(doc, page_index)
                compact_text = " ".join(text.split())
                if len(compact_text) > 12000:
                    compact_text = compact_text[:12000]
                    warnings.append("text_truncated")

                result["candidatePages"].append({
                    "pageNumber": page_no,
                    "pdfPageIndex": page_index,
                    "catalogPageLabel": catalog_page_label,
                    "text": compact_text,
                    "links": page_links,
                    "renderedImagePath": rendered_image_path,
                    "panelImagePath": panel_image_path,
                    "warnings": warnings,
                })
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
