#!/usr/bin/env python3
"""
Unified DeepWiki Ingestion Pipeline
====================================
Scrapes DeepWiki documentation, transforms to Astro/Starlight MDX, and writes output files.

Usage:
    python scripts/ingest-deepwiki.py \
        --url https://deepwiki.com/AffineFoundation/affine-cortex \
        --github https://github.com/AffineFoundation/affine-cortex \
        --output src/content/docs/subnets \
        --prefix subnets

Stages:
    1. SCRAPE  — Selenium headless Chrome extracts nav + markdown from DeepWiki
    2. TRANSFORM — Raw markdown → MDX (frontmatter, tables, mermaid, cross-refs)
    3. POST-PROCESS — H1 dedup, link resolution, source link components
    4. WRITE — Output .mdx files to target directory
"""

import argparse
import json
import logging
import os
import re
import shutil
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ingest")

# ---------------------------------------------------------------------------
# Selenium imports (deferred to allow --help without selenium installed)
# ---------------------------------------------------------------------------
selenium_available = True
try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.chrome.service import Service as ChromeService
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        TimeoutException,
        NoSuchElementException,
        WebDriverException,
    )
except ImportError:
    selenium_available = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MIN_PAGE_LEN = 500  # minimum chars for a valid markdown chunk
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds
PAGE_LOAD_TIMEOUT = 30  # seconds
NAV_WAIT_TIMEOUT = 25  # seconds

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def parse_args():
    p = argparse.ArgumentParser(description="Unified DeepWiki → Astro MDX ingestion pipeline")
    p.add_argument("--url", required=True, help="DeepWiki base URL (e.g. https://deepwiki.com/Org/Repo)")
    p.add_argument("--github", required=True, help="GitHub repo URL (e.g. https://github.com/Org/Repo)")
    p.add_argument("--output", required=True, help="Output directory for .mdx files (e.g. src/content/docs/subnets)")
    p.add_argument("--prefix", default="", help="URL prefix for internal links (e.g. 'subnets')")
    p.add_argument("--ref", default="main", help="Git ref for GitHub source links (default: main)")
    p.add_argument("--chromedriver", default="", help="Path to chromedriver (auto-detected if omitted)")
    p.add_argument("--json-out", default="", help="Path to save intermediate JSON (optional)")
    p.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    return p.parse_args()

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
def preflight(args):
    if not selenium_available:
        log.error("selenium is not installed. Run: pip install selenium")
        return False

    # Find chromedriver (optional — Selenium 4.15+ can auto-manage)
    if args.chromedriver and os.path.exists(args.chromedriver):
        log.info(f"chromedriver: {args.chromedriver}")
    elif args.chromedriver:
        log.warning(f"Specified chromedriver not found: {args.chromedriver}")
        args.chromedriver = ""
    else:
        found = shutil.which("chromedriver")
        if found:
            args.chromedriver = found
            log.info(f"chromedriver: {args.chromedriver}")
        else:
            log.info("chromedriver not found — Selenium will auto-manage the driver.")

    # Validate URL format
    parsed = urlparse(args.url)
    if not parsed.scheme or not parsed.netloc:
        log.error(f"Invalid DeepWiki URL: {args.url}")
        return False

    # Ensure output dir is creatable
    try:
        os.makedirs(args.output, exist_ok=True)
    except OSError as e:
        log.error(f"Cannot create output directory {args.output}: {e}")
        return False

    return True

# ===========================================================================
# STAGE 1: SCRAPE
# ===========================================================================

class DeepWikiScraper:
    """Scrapes DeepWiki navigation structure and page markdown content."""

    def __init__(self, base_url, github_url, git_ref, chromedriver_path):
        self.base_url = base_url.rstrip("/")
        self.github_url = github_url.rstrip("/")
        self.github_blob_prefix = f"{self.github_url}/blob/{git_ref}/"
        self.chromedriver_path = chromedriver_path
        self.driver = None
        self.site_map = {}  # deepwiki_path → page_data
        self.link_map = {}  # lowercase path/title → astro_path
        self._parent_paths = {}  # level → parent astro path

    def start(self):
        log.info("Initializing headless Chrome...")
        opts = ChromeOptions()
        for flag in ["--headless", "--disable-gpu", "--no-sandbox", "--window-size=1920,1080", "--log-level=3",
                      "--disable-dev-shm-usage", "--disable-extensions"]:
            opts.add_argument(flag)
        if self.chromedriver_path:
            service = ChromeService(executable_path=self.chromedriver_path)
            self.driver = webdriver.Chrome(service=service, options=opts)
        else:
            # Let Selenium Manager auto-detect/download matching chromedriver
            self.driver = webdriver.Chrome(options=opts)
        self.driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
        log.info("Chrome initialized.")

    def stop(self):
        if self.driver:
            self.driver.quit()
            self.driver = None

    # --- Navigation ---

    def scrape_navigation(self):
        """Extract sidebar navigation structure from DeepWiki."""
        log.info(f"Navigating to {self.base_url}")
        self._load_url(self.base_url)

        try:
            nav = WebDriverWait(self.driver, NAV_WAIT_TIMEOUT).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.border-r-border[class*='md:sticky']"))
            )
            ul = nav.find_element(By.CSS_SELECTOR, "ul.flex-1")
        except (TimeoutException, NoSuchElementException) as e:
            log.error(f"Navigation sidebar not found: {e}")
            self._save_debug_html("debug_nav_failure.html")
            return False

        items = ul.find_elements(By.XPATH, "./li")
        log.info(f"Found {len(items)} navigation items.")

        # Determine root page href (first item)
        root_href = None
        for li in items:
            try:
                a = li.find_element(By.TAG_NAME, "a")
                title = a.text.strip()
                href_attr = a.get_attribute("href")
                if not title or not href_attr:
                    continue

                dw_path = urlparse(href_attr).path
                full_url = urljoin(self.base_url, dw_path)

                # Determine hierarchy level from padding
                style = li.get_attribute("style") or ""
                m = re.search(r"padding-left:\s*(\d+)px", style)
                level = int(m.group(1)) // 12 if m else 0

                if root_href is None:
                    root_href = dw_path

                astro_path = self._compute_astro_path(title, level, dw_path, root_href)

                self.site_map[dw_path] = {
                    "deepwiki_path": dw_path,
                    "title": title,
                    "full_url": full_url,
                    "level": level,
                    "astro_path": astro_path,
                    "markdown": None,
                    "links": [],
                    "mermaid_diagrams": [],
                }
                self.link_map[dw_path.lower()] = astro_path
                self.link_map[title.lower()] = astro_path

            except Exception as e:
                log.warning(f"Error parsing nav item: {e}")

        log.info(f"Site map: {len(self.site_map)} pages.")
        return bool(self.site_map)

    def _compute_astro_path(self, title, level, dw_path, root_href):
        slug = self._slugify(title) or f"page-{len(self.site_map)}"

        if dw_path == root_href:
            self._parent_paths[level] = "/"
            return "/"

        parent = self._parent_paths.get(level - 1, "") if level > 0 else ""
        if parent == "/":
            path = f"/{slug}"
        elif parent:
            path = f"{parent}/{slug}"
        else:
            path = f"/{slug}"

        self._parent_paths[level] = path
        return path

    @staticmethod
    def _slugify(text):
        if not text:
            return ""
        s = text.lower()
        s = re.sub(r"\s+", "-", s)
        s = re.sub(r"[^\w-]", "", s)
        s = re.sub(r"-+", "-", s).strip("-")
        return s

    # --- Content extraction ---

    def scrape_content(self):
        """Extract markdown content for all pages."""
        log.info("Extracting page content...")

        # Bulk extraction from base URL
        chunks = self._extract_markdown_chunks(self.base_url)
        by_title = {}
        for chunk in chunks:
            m = re.search(r"^#\s+(.+?)(?:\n|$)", chunk, re.MULTILINE)
            if m:
                t = m.group(1).strip()
                by_title[t] = chunk
                by_title[self._slugify(t)] = chunk

        found = 0
        for pd in self.site_map.values():
            content = by_title.get(pd["title"]) or by_title.get(self._slugify(pd["title"]))
            if content:
                pd["markdown"] = content
                found += 1

        log.info(f"Bulk extraction matched {found}/{len(self.site_map)} pages.")

        # Fallback: fetch individual pages
        missing = [pd for pd in self.site_map.values() if not pd["markdown"]]
        for i, pd in enumerate(missing):
            log.info(f"  Fallback {i+1}/{len(missing)}: {pd['title']}")
            try:
                chunks = self._extract_markdown_chunks(pd["full_url"])
                for chunk in chunks:
                    m = re.search(r"^#\s+(.+?)(?:\n|$)", chunk, re.MULTILINE)
                    if m and m.group(1).strip() == pd["title"]:
                        pd["markdown"] = chunk
                        break
                if not pd["markdown"]:
                    log.warning(f"  No content found for: {pd['title']}")
            except Exception as e:
                log.warning(f"  Fallback failed for {pd['title']}: {e}")

        total = sum(1 for pd in self.site_map.values() if pd["markdown"])
        log.info(f"Content scraped: {total}/{len(self.site_map)} pages have content.")

    def _extract_markdown_chunks(self, url):
        """Extract markdown from Next.js RSC payloads on a page."""
        self._load_url(url)
        scripts = self.driver.find_elements(By.TAG_NAME, "script")
        chunks = []
        for script in scripts:
            try:
                html = script.get_attribute("innerHTML") or ""
                if "self.__next_f.push" not in html:
                    continue
                payload = self._decode_nextjs_payload(html)
                if payload and payload.strip().startswith("# ") and len(payload.strip()) >= MIN_PAGE_LEN:
                    chunks.append(payload.strip())
            except Exception:
                pass
        return chunks

    @staticmethod
    def _decode_nextjs_payload(js_html):
        m = re.search(r'self\.__next_f\.push\(\s*\[\s*[^,\]]+\s*,\s*"(.*)"\s*\]\s*\)', js_html, re.DOTALL)
        if not m:
            return None
        escaped = m.group(1)
        try:
            return json.loads('"' + escaped + '"')
        except json.JSONDecodeError:
            try:
                return bytes(escaped, "utf-8").decode("unicode_escape", "ignore")
            except Exception:
                return escaped

    # --- Link extraction ---

    def extract_links(self):
        """Extract and resolve links from page content."""
        log.info("Extracting links from page content...")
        for pd in self.site_map.values():
            if not pd.get("markdown"):
                continue

            md = pd["markdown"]
            links = []

            # Mermaid diagrams
            pd["mermaid_diagrams"] = re.findall(r"```mermaid\n(.*?)\n```", md, re.DOTALL)

            # Relevant source files (<details> block)
            details_match = re.search(
                r"<details>\s*<summary>Relevant source files</summary>(.*?)</details>",
                md, re.IGNORECASE | re.DOTALL
            )
            if details_match:
                for lm in re.finditer(r"-\s*\[([^\]]+)\]\(([^)]+)\)", details_match.group(1)):
                    text, href = lm.group(1).strip(), lm.group(2).strip()
                    if text and href:
                        links.append({
                            "text": text,
                            "href": urljoin(self.github_blob_prefix, href.lstrip("/")),
                            "original_href": href,
                            "context": "collapsible_aside",
                        })

            # Inline source links (lines starting with "Sources:")
            for line in md.splitlines():
                if line.strip().lower().startswith("sources:"):
                    for lm in re.finditer(r"\[([^\]]+?)\]\(([^)]*?)\)", line):
                        links.append({
                            "text": lm.group(1).strip(),
                            "href": "",
                            "original_href": lm.group(2).strip(),
                            "context": "inline_source",
                        })

            # Internal page links
            for lm in re.finditer(r"\[([^!][^\]]*)\]\(([^)]+)\)", md):
                text, href = lm.group(1), lm.group(2)
                parsed = urlparse(href)
                path_lower = parsed.path.lower()
                resolved = self.link_map.get(path_lower)
                if not resolved and href.startswith("#"):
                    resolved = self.link_map.get(text.lower())
                    if resolved:
                        resolved = resolved + href
                if resolved:
                    links.append({
                        "text": text,
                        "href": resolved,
                        "original_href": href,
                        "context": "internal_link",
                    })

            pd["links"] = links

    # --- Helpers ---

    def _load_url(self, url, retries=MAX_RETRIES):
        for attempt in range(retries):
            try:
                if self.driver.current_url != url:
                    self.driver.get(url)
                WebDriverWait(self.driver, PAGE_LOAD_TIMEOUT).until(
                    lambda d: d.execute_script("return document.readyState") == "complete"
                )
                time.sleep(2)  # allow JS rendering
                return
            except (TimeoutException, WebDriverException) as e:
                if attempt < retries - 1:
                    delay = RETRY_DELAY * (attempt + 1)
                    log.warning(f"Page load failed (attempt {attempt+1}/{retries}), retrying in {delay}s: {e}")
                    time.sleep(delay)
                else:
                    raise

    def _save_debug_html(self, filename):
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write(self.driver.page_source)
            log.info(f"Debug HTML saved: {os.path.abspath(filename)}")
        except Exception as e:
            log.warning(f"Could not save debug HTML: {e}")


# ===========================================================================
# STAGE 2+3: TRANSFORM & POST-PROCESS
# ===========================================================================

class MDXTransformer:
    """Transforms scraped data into Astro/Starlight MDX files."""

    def __init__(self, github_blob_prefix, prefix=""):
        self.github_blob_prefix = github_blob_prefix
        self.prefix = prefix.strip("/")

    def transform_page(self, page_data, output_depth=3):
        """Convert a single page's data into MDX content string.

        output_depth: number of directory levels from src/ to the output file.
        e.g. src/content/docs/subnets/file.mdx = 4, src/content/docs/subnets/subdir/file.mdx = 5
        """
        md = page_data.get("markdown", "")
        if not md:
            return None

        title = page_data.get("title", "Untitled")
        links = page_data.get("links", [])

        # --- Remove <details> block ---
        md = re.sub(
            r"<details>\s*<summary>Relevant source files</summary>.*?</details>",
            "", md, count=1, flags=re.IGNORECASE | re.DOTALL
        )

        # --- Remove redundant H1 (matches frontmatter title) ---
        h1_match = re.match(r"^#\s+(.+?)(?:\n|$)", md)
        if h1_match and h1_match.group(1).strip().lower() == title.lower():
            md = md[h1_match.end():].lstrip("\n")

        # --- Strip mermaid style/classDef lines (light-mode colors override dark theme) ---
        md = re.sub(r"(```mermaid\n)([\s\S]*?)(```)", self._clean_mermaid_styles, md)

        # --- Mermaid \n → <br/> ---
        md = re.sub(r"```mermaid\n([\s\S]*?)```", self._fix_mermaid, md)

        # --- Convert <br> to <br/> for MDX compatibility ---
        md = re.sub(r"<br\s*/?>", "<br/>", md)

        # --- Remove DeepWiki AI artifacts (<thinking>, </thinking>, etc.) ---
        md = re.sub(r"</?thinking>", "", md, flags=re.IGNORECASE)

        # --- Escape JSX-problematic characters outside code blocks ---
        md = self._escape_jsx(md)

        # --- Wrap tables in <Table> component ---
        has_table = bool(re.search(r"^\|", md, re.MULTILINE))
        if has_table:
            md = self._wrap_tables(md)

        # --- Replace inline source links with SourceLink components ---
        has_source_links = False
        inline_sources = [l for l in links if l["context"] == "inline_source"]
        for link in inline_sources:
            text = link["text"]
            orig_href = link["original_href"]
            filename, line_frag = self._parse_filename_lines(text)
            if filename:
                has_source_links = True
                prefix = self.github_blob_prefix
                if not prefix.endswith("/"):
                    prefix += "/"
                github_url = urljoin(prefix, filename.lstrip("/")) + line_frag
                component = f'<SourceLink text="{_esc(text)}" href="{_esc(github_url)}" />'
                pattern = rf"\[{re.escape(text)}\]\({re.escape(orig_href)}\)"
                md = re.sub(pattern, component, md, count=1)

        # --- Replace internal links ---
        internal_links = [l for l in links if l["context"] == "internal_link"]
        for link in internal_links:
            orig_pattern = f"[{link['text']}]({link['original_href']})"
            # Add prefix to resolved path if needed
            resolved = link["href"]
            if self.prefix and not resolved.startswith(f"/{self.prefix}"):
                resolved = f"/{self.prefix}{resolved}"
            new_link = f"[{link['text']}]({resolved})"
            md = md.replace(orig_pattern, new_link, 1)

        # Note: code language detection skipped for DeepWiki content
        # DeepWiki already provides language-tagged code blocks

        # --- Build final MDX ---
        collapsible_links = [l for l in links if l["context"] == "collapsible_aside"]
        has_collapsible = bool(collapsible_links)

        parts = []
        # Frontmatter
        parts.append(f'---\ntitle: "{_esc(title)}"\n---\n')

        # Imports — depth is relative from the output file location to src/components/
        imports = []
        rel = "../" * output_depth
        if has_table:
            imports.append(f"import Table from '{rel}components/Table.astro';")
        if has_collapsible:
            imports.append(f"import CollapsibleAside from '{rel}components/CollapsibleAside.astro';")
        if has_collapsible or has_source_links:
            imports.append(f"import SourceLink from '{rel}components/SourceLink.astro';")
        if imports:
            parts.append("\n".join(sorted(set(imports))))

        # CollapsibleAside
        if has_collapsible:
            aside_lines = ['<CollapsibleAside title="Relevant Source Files">']
            for link in collapsible_links:
                aside_lines.append(f'  <SourceLink text="{_esc(link["text"])}" href="{_esc(link["href"])}" />')
            aside_lines.append("</CollapsibleAside>")
            parts.append("\n".join(aside_lines))

        # Main content
        parts.append(md.strip())

        return "\n\n".join(parts) + "\n"

    # --- Helpers ---

    @staticmethod
    def _clean_mermaid_styles(match):
        """Remove style/classDef lines with light-mode fill colors from mermaid blocks."""
        opening = match.group(1)
        code = match.group(2)
        closing = match.group(3)
        # Remove lines like: style NodeName fill:#f9f9f9
        # Remove lines like: classDef default fill:#fff
        code = re.sub(r"^\s*(style\s+\w+\s+fill:#[a-fA-F0-9]+.*|classDef\s+.*fill:#[a-fA-F0-9]+.*)$",
                       "", code, flags=re.MULTILINE)
        return opening + code + closing

    @staticmethod
    def _fix_mermaid(match):
        code = match.group(1).replace("\\n", "<br/>")
        return "```mermaid\n" + code + "```"

    @staticmethod
    def _escape_jsx(md):
        lines = md.split("\n")
        in_code = False
        in_component = False
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith("```"):
                in_code = not in_code
                continue
            if in_code:
                continue
            # Don't escape inside JSX component tags (Table, CollapsibleAside, SourceLink)
            if stripped.startswith("<Table") or stripped.startswith("<CollapsibleAside") or stripped.startswith("<SourceLink"):
                continue
            if stripped.startswith("</Table") or stripped.startswith("</CollapsibleAside"):
                continue
            # Escape < that isn't part of HTML tags or JSX components
            lines[i] = re.sub(r"<(?=[^a-zA-Z/!])", "&lt;", lines[i])
            # Escape curly braces outside inline code (MDX interprets {} as expressions)
            # Only escape if line contains { but is not an import statement
            if "{" in lines[i] and not lines[i].strip().startswith("import "):
                # Escape { } that are NOT inside backtick-delimited inline code
                parts = lines[i].split("`")
                for j in range(0, len(parts), 2):  # even indices are outside backticks
                    if j < len(parts):
                        parts[j] = parts[j].replace("{", "&#123;").replace("}", "&#125;")
                lines[i] = "`".join(parts)
        return "\n".join(lines)

    @staticmethod
    def _wrap_tables(md):
        lines = md.split("\n")
        result = []
        in_table = False
        for line in lines:
            is_table = line.strip().startswith("|")
            if is_table and not in_table:
                in_table = True
                result.append("<Table>")
                result.append("")
            elif not is_table and in_table:
                in_table = False
                result.append("")
                result.append("</Table>")
                result.append("")
            result.append(line)
        if in_table:
            result.append("")
            result.append("</Table>")
        return "\n".join(result)

    @staticmethod
    def _parse_filename_lines(text):
        m = re.match(r"([\w._/-]+)(?::(\d+)(?:-(\d+))?)?", text)
        if not m:
            return text, ""
        filename = m.group(1)
        start, end = m.group(2), m.group(3)
        if start and end:
            return filename, f"#L{start}-L{end}"
        elif start:
            return filename, f"#L{start}"
        return filename, ""

    @staticmethod
    def _detect_code_languages(md):
        def replacer(match):
            code = match.group(1)
            if re.search(r"\b(await|async|import|def |class |print\(|self\.)", code):
                return "```python\n" + code + "```"
            if re.search(r"^\s*(pip |npm |git |curl |docker |sudo |cd |mkdir |export )", code):
                return "```bash\n" + code + "```"
            if re.match(r"^\s*\{[\s\S]*\}\s*$", code.strip()):
                return "```json\n" + code + "```"
            return match.group(0)
        # Only match code blocks that start with bare ``` on its own line (no language tag)
        # Use negative lookahead to avoid matching ```mermaid, ```python, etc.
        return re.sub(r"```\n([\s\S]*?\n)```(?!\w)", replacer, md)


def _esc(s):
    """Escape double quotes for MDX attributes."""
    return s.replace('"', "&quot;") if s else ""


# ===========================================================================
# STAGE 4: WRITE
# ===========================================================================

def write_pages(site_map, transformer, output_dir, prefix):
    """Write transformed MDX files to disk."""
    log.info(f"Writing MDX files to {output_dir}")
    written = 0
    skipped = 0

    # Calculate base depth: output_dir relative to src/
    # e.g. src/content/docs/subnets → depth from src/ = 3 (content/docs/subnets)
    output_path = Path(output_dir)
    # Find how many levels from "src" to output_dir
    try:
        src_idx = output_path.parts.index("src")
        base_depth = len(output_path.parts) - src_idx - 1  # levels after src/
    except ValueError:
        base_depth = 3  # fallback

    for pd in site_map.values():
        astro_path = pd["astro_path"]
        if astro_path == "/":
            filepath = Path(output_dir) / "index.mdx"
            extra_depth = 0
        else:
            segments = astro_path.strip("/").split("/")
            filename = f"{segments[-1]}.mdx"
            if len(segments) > 1:
                filepath = Path(output_dir) / "/".join(segments[:-1]) / filename
                extra_depth = len(segments) - 1
            else:
                filepath = Path(output_dir) / filename
                extra_depth = 0

        output_depth = base_depth + extra_depth
        mdx = transformer.transform_page(pd, output_depth=output_depth)
        if not mdx:
            skipped += 1
            continue

        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_text(mdx, encoding="utf-8")
        written += 1

    log.info(f"Written {written} files, skipped {skipped} (no content).")
    return written


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    args = parse_args()
    if args.verbose:
        log.setLevel(logging.DEBUG)

    log.info("=" * 60)
    log.info("DeepWiki Ingestion Pipeline")
    log.info("=" * 60)
    log.info(f"DeepWiki URL: {args.url}")
    log.info(f"GitHub repo:  {args.github}")
    log.info(f"Output dir:   {args.output}")
    log.info(f"Prefix:       {args.prefix or '(none)'}")
    log.info(f"Git ref:      {args.ref}")

    if not preflight(args):
        sys.exit(1)

    start_time = time.time()
    scraper = DeepWikiScraper(args.url, args.github, args.ref, args.chromedriver)

    try:
        # Stage 1: Scrape
        scraper.start()
        if not scraper.scrape_navigation():
            log.error("Failed to scrape navigation. Aborting.")
            sys.exit(1)

        scraper.scrape_content()
        scraper.extract_links()

        # Save intermediate JSON if requested
        if args.json_out:
            Path(args.json_out).parent.mkdir(parents=True, exist_ok=True)
            with open(args.json_out, "w", encoding="utf-8") as f:
                json.dump(scraper.site_map, f, indent=2, ensure_ascii=False)
            log.info(f"Intermediate JSON saved: {args.json_out}")

        # Stage 2+3: Transform
        blob_prefix = f"{args.github.rstrip('/')}/blob/{args.ref}/"
        transformer = MDXTransformer(blob_prefix, prefix=args.prefix)

        # Stage 4: Write
        written = write_pages(scraper.site_map, transformer, args.output, args.prefix)

        elapsed = time.time() - start_time
        total = len(scraper.site_map)
        with_content = sum(1 for pd in scraper.site_map.values() if pd["markdown"])

        log.info("=" * 60)
        log.info("DONE")
        log.info(f"  Pages discovered: {total}")
        log.info(f"  Pages with content: {with_content}")
        log.info(f"  MDX files written: {written}")
        log.info(f"  Elapsed: {elapsed:.1f}s")
        log.info("=" * 60)

        if written == 0:
            log.error("No files written — check DeepWiki URL and content.")
            sys.exit(1)

    except KeyboardInterrupt:
        log.info("Interrupted by user.")
        sys.exit(130)
    except Exception as e:
        log.exception(f"Unhandled error: {e}")
        sys.exit(1)
    finally:
        scraper.stop()


if __name__ == "__main__":
    main()
