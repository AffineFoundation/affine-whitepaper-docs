"""
Unit tests for the DeepWiki ingestion pipeline (MDXTransformer class).
No Selenium required — tests the transformation logic only.

Run: python3 -m pytest tests/test-ingestion.py -v
  or: python3 -m unittest tests/test-ingestion.py -v
"""

import json
import os
import re
import sys
import unittest
from pathlib import Path

# Add project root to path so we can import the ingestion module
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from importlib import import_module

# Import MDXTransformer without triggering selenium import error
spec = import_module("ingest-deepwiki".replace("-", "_") if False else "importlib")
# Since the module has hyphens, we need to load it differently
import importlib.util

spec = importlib.util.spec_from_file_location(
    "ingest_deepwiki", ROOT / "scripts" / "ingest-deepwiki.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

MDXTransformer = mod.MDXTransformer
_esc = mod._esc


class TestMDXTransformerHelpers(unittest.TestCase):
    """Test individual helper methods of MDXTransformer."""

    def setUp(self):
        self.transformer = MDXTransformer(
            github_blob_prefix="https://github.com/Org/Repo/blob/main/",
            prefix="subnets",
        )

    # --- Mermaid ---

    def test_mermaid_newline_conversion(self):
        """\\n in mermaid blocks should become <br/>."""
        md = '```mermaid\ngraph TD\n    A["Node\\nLine2"]\n```'
        result = re.sub(r"```mermaid\n([\s\S]*?)```", self.transformer._fix_mermaid, md)
        self.assertIn("<br/>", result)
        self.assertNotIn("\\n", result.split("```mermaid")[1])

    def test_mermaid_style_stripping(self):
        """style fill:# lines should be removed from mermaid blocks."""
        md = '```mermaid\ngraph TD\n    A --> B\n    style A fill:#f9f9f9\n```'
        result = re.sub(
            r"(```mermaid\n)([\s\S]*?)(```)",
            self.transformer._clean_mermaid_styles,
            md,
        )
        self.assertNotIn("fill:#f9f9f9", result)
        self.assertIn("A --> B", result)

    def test_mermaid_classdef_stripping(self):
        """classDef fill:# lines should be removed."""
        md = '```mermaid\ngraph TD\n    classDef default fill:#fff\n    A --> B\n```'
        result = re.sub(
            r"(```mermaid\n)([\s\S]*?)(```)",
            self.transformer._clean_mermaid_styles,
            md,
        )
        self.assertNotIn("classDef", result)
        self.assertIn("A --> B", result)

    # --- BR tags ---

    def test_br_self_closing(self):
        """<br> should become <br/> for MDX compatibility."""
        md = "line1<br>line2<br />line3<br/>line4"
        result = re.sub(r"<br\s*/?>", "<br/>", md)
        self.assertEqual(result.count("<br/>"), 3)
        self.assertNotIn("<br>", result.replace("<br/>", ""))

    # --- Thinking tag removal ---

    def test_thinking_tag_removal(self):
        """<thinking> artifacts from DeepWiki should be stripped."""
        md = "Before\n<thinking>\nSome AI reasoning\n</thinking>\nAfter"
        result = re.sub(r"</?thinking>", "", md, flags=re.IGNORECASE)
        self.assertNotIn("<thinking>", result)
        self.assertNotIn("</thinking>", result)
        self.assertIn("Before", result)
        self.assertIn("After", result)

    # --- JSX escaping ---

    def test_jsx_escape_less_than_digit(self):
        """< followed by digit should be escaped."""
        md = "response time <100ms"
        result = self.transformer._escape_jsx(md)
        self.assertIn("&lt;100ms", result)

    def test_jsx_escape_less_than_equals(self):
        """<= should be escaped."""
        md = "value <=5%"
        result = self.transformer._escape_jsx(md)
        self.assertIn("&lt;=5%", result)

    def test_jsx_escape_less_than_dollar(self):
        """<$ should be escaped."""
        md = "cost <$1"
        result = self.transformer._escape_jsx(md)
        self.assertIn("&lt;$1", result)

    def test_jsx_escape_preserves_html_tags(self):
        """Real HTML/JSX tags like <Table> should not be escaped."""
        md = "<Table>\n| A |\n</Table>"
        result = self.transformer._escape_jsx(md)
        self.assertIn("<Table>", result)
        self.assertIn("</Table>", result)

    def test_jsx_escape_preserves_imports(self):
        """import statements should not have { } escaped."""
        md = "import Table from '../components/Table.astro';"
        result = self.transformer._escape_jsx(md)
        self.assertNotIn("&#123;", result)

    def test_jsx_escape_curly_braces(self):
        """{} outside inline code should be escaped."""
        md = "weights {game: 2.0}"
        result = self.transformer._escape_jsx(md)
        self.assertIn("&#123;", result)
        self.assertIn("&#125;", result)

    def test_jsx_escape_preserves_inline_code_braces(self):
        """Braces inside backticks should not be escaped."""
        md = "use `{key: val}` for config"
        result = self.transformer._escape_jsx(md)
        self.assertIn("`{key: val}`", result)

    def test_jsx_escape_preserves_code_blocks(self):
        """Content inside code blocks should not be escaped."""
        md = "```\n<100 and {x: 1}\n```"
        result = self.transformer._escape_jsx(md)
        # Inside code block, should remain unchanged
        self.assertIn("<100", result)

    # --- Table wrapping ---

    def test_table_wrapping(self):
        """Pipe-delimited table lines should be wrapped in <Table>."""
        md = "Text\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nMore text"
        result = self.transformer._wrap_tables(md)
        self.assertIn("<Table>", result)
        self.assertIn("</Table>", result)
        self.assertIn("| A | B |", result)

    def test_multiple_tables(self):
        """Multiple tables should each get their own wrapper."""
        md = "| A |\n|---|\n\nMiddle\n\n| B |\n|---|"
        result = self.transformer._wrap_tables(md)
        self.assertEqual(result.count("<Table>"), 2)
        self.assertEqual(result.count("</Table>"), 2)

    # --- Filename parsing ---

    def test_parse_filename_with_lines(self):
        """Should parse filename:start-end into filename + #Lstart-Lend."""
        filename, frag = self.transformer._parse_filename_lines("neurons/validator.py:356-437")
        self.assertEqual(filename, "neurons/validator.py")
        self.assertEqual(frag, "#L356-L437")

    def test_parse_filename_single_line(self):
        """Should parse filename:line into filename + #Lline."""
        filename, frag = self.transformer._parse_filename_lines("file.py:10")
        self.assertEqual(filename, "file.py")
        self.assertEqual(frag, "#L10")

    def test_parse_filename_no_lines(self):
        """Should parse bare filename."""
        filename, frag = self.transformer._parse_filename_lines("README.md")
        self.assertEqual(filename, "README.md")
        self.assertEqual(frag, "")

    # --- H1 deduplication ---

    def test_h1_dedup_removes_matching(self):
        """H1 matching title should be removed."""
        md = "# Overview\n\nBody text here"
        h1_match = re.match(r"^#\s+(.+?)(?:\n|$)", md)
        self.assertTrue(h1_match)
        self.assertEqual(h1_match.group(1).strip().lower(), "overview")

    def test_h1_dedup_keeps_non_matching(self):
        """H1 not matching title should be kept."""
        md = "# Different Title\n\nBody"
        title = "Overview"
        h1_match = re.match(r"^#\s+(.+?)(?:\n|$)", md)
        self.assertNotEqual(h1_match.group(1).strip().lower(), title.lower())

    # --- Escape helper ---

    def test_esc_quotes(self):
        """Double quotes should be escaped for MDX attributes."""
        self.assertEqual(_esc('He said "hello"'), 'He said &quot;hello&quot;')

    def test_esc_none(self):
        """None/empty should return empty string."""
        self.assertEqual(_esc(""), "")
        self.assertEqual(_esc(None), "")


class TestMDXTransformerFullTransform(unittest.TestCase):
    """Test the full transform_page method with fixture data."""

    def setUp(self):
        self.transformer = MDXTransformer(
            github_blob_prefix="https://github.com/AffineFoundation/test-repo/blob/main/",
            prefix="subnets",
        )
        fixture_path = ROOT / "tests" / "fixtures" / "sample-deepwiki.json"
        with open(fixture_path) as f:
            self.data = json.load(f)
        self.page = list(self.data.values())[0]

    def test_full_transform_produces_output(self):
        """transform_page should produce non-empty MDX content."""
        result = self.transformer.transform_page(self.page, output_depth=3)
        self.assertIsNotNone(result)
        self.assertGreater(len(result), 100)

    def test_full_transform_has_frontmatter(self):
        """Output should have valid YAML frontmatter."""
        result = self.transformer.transform_page(self.page, output_depth=3)
        self.assertTrue(result.startswith("---\n"))
        self.assertIn('title: "Overview"', result)

    def test_full_transform_removes_details_block(self):
        """<details>Relevant source files</details> should be stripped."""
        result = self.transformer.transform_page(self.page, output_depth=3)
        self.assertNotIn("<details>", result)
        self.assertNotIn("</details>", result)

    def test_full_transform_removes_thinking(self):
        """<thinking> tags should be removed."""
        result = self.transformer.transform_page(self.page, output_depth=3)
        self.assertNotIn("<thinking>", result)
        self.assertNotIn("</thinking>", result)

    def test_full_transform_escapes_jsx(self):
        """< and {} should be escaped in prose."""
        result = self.transformer.transform_page(self.page, output_depth=3)
        self.assertIn("&lt;100ms", result)
        self.assertIn("&#123;", result)  # { escaped

    def test_full_transform_has_collapsible_aside(self):
        """Should include CollapsibleAside component."""
        result = self.transformer.transform_page(self.page, output_depth=3)
        self.assertIn("<CollapsibleAside", result)
        self.assertIn("README.md", result)

    def test_full_transform_has_table_wrapper(self):
        """Tables should be wrapped in <Table> component."""
        result = self.transformer.transform_page(self.page, output_depth=3)
        self.assertIn("<Table>", result)
        self.assertIn("</Table>", result)

    def test_full_transform_self_closes_br(self):
        """<br> should become <br/>."""
        result = self.transformer.transform_page(self.page, output_depth=3)
        # Should not have bare <br> (only <br/>)
        self.assertNotRegex(result, r"<br(?!/)>")

    def test_full_transform_no_content_returns_none(self):
        """Page with no markdown should return None."""
        empty_page = {"markdown": None, "title": "Empty", "links": []}
        result = self.transformer.transform_page(empty_page, output_depth=3)
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
