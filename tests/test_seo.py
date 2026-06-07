import os
import json
import pytest
from services.content.seo_generator import generate_seo_params, init_seo_database


@pytest.fixture(autouse=True, scope="module")
def setup_seo_test_db():
    # Make sure we use a test db for testing
    os.environ["DATABASE_URL"] = "sqlite:///./test_prediction_new.db"
    os.environ["MAX_SEO_COLLEGES"] = "3"
    init_seo_database()
    yield


def test_seo_generator_runs_and_generates_files():
    """Verify that the SEO generator runs and creates three JSON files."""
    colleges_path = os.path.join("frontend", "web", "src", "lib", "seo_data", "colleges.json")
    cutoffs_path = os.path.join("frontend", "web", "src", "lib", "seo_data", "cutoffs.json")
    guides_path = os.path.join("frontend", "web", "src", "lib", "seo_data", "guides.json")

    # Run generator
    c_len, cut_len, g_len = generate_seo_params()

    # Assert outputs exist
    assert os.path.exists(colleges_path)
    assert os.path.exists(cutoffs_path)
    assert os.path.exists(guides_path)

    # Read and validate JSON format and structure
    with open(colleges_path, "r", encoding="utf-8") as f:
        colleges = json.load(f)
        assert isinstance(colleges, list)
        assert len(colleges) <= 3
        if len(colleges) > 0:
            assert "code" in colleges[0]

    with open(cutoffs_path, "r", encoding="utf-8") as f:
        cutoffs = json.load(f)
        assert isinstance(cutoffs, list)
        if len(cutoffs) > 0:
            assert "college" in cutoffs[0]
            assert "branch" in cutoffs[0]
            assert "category" in cutoffs[0]

    with open(guides_path, "r", encoding="utf-8") as f:
        guides = json.load(f)
        assert isinstance(guides, list)
        assert len(guides) > 0
        if len(guides) > 0:
            assert "slug" in guides[0]


def test_seo_generator_max_colleges_constraint():
    """Verify the MAX_SEO_COLLEGES env variable strictly limits page output."""
    os.environ["MAX_SEO_COLLEGES"] = "1"
    generate_seo_params()
    
    colleges_path = os.path.join("frontend", "web", "src", "lib", "seo_data", "colleges.json")
    with open(colleges_path, "r", encoding="utf-8") as f:
        colleges = json.load(f)
        assert len(colleges) <= 1


def test_robots_txt_crawlability():
    """Verify robots.ts has valid, crawlable rules and points to sitemap."""
    robots_path = os.path.join("frontend", "web", "src", "app", "robots.ts")
    assert os.path.exists(robots_path)

    with open(robots_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Assert that allowed/disallowed paths and sitemap exist in the return block
    assert '"*"' in content
    assert '"/"' in content
    assert '"/api/"' in content
    assert '"/chat/history"' in content
    assert '"/admin/"' in content
    assert "sitemap.xml" in content


def test_sitemap_correctness():
    """Verify sitemap.ts maps base paths and imports static parameters."""
    sitemap_path = os.path.join("frontend", "web", "src", "app", "sitemap.ts")
    assert os.path.exists(sitemap_path)

    with open(sitemap_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert 'const baseUrl = "https://admitos.in"' in content
    assert "rank-radar" in content
    assert "chat" in content
    assert "collegesData" in content
    assert "cutoffsData" in content
    assert "guidesData" in content


def test_og_image_route_exists_and_uses_image_response():
    """Verify route.tsx for OG image exists and imports next/og ImageResponse."""
    og_route_path = os.path.join("frontend", "web", "src", "app", "api", "og", "route.tsx")
    assert os.path.exists(og_route_path)

    with open(og_route_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "ImageResponse" in content
    assert "next/og" in content or "@vercel/og" in content
    assert "title" in content
    assert "subtitle" in content
    assert "badge" in content
