#!/usr/bin/env python3
"""
Test script to verify all MCP servers can be imported and initialized.
Run: python scripts/test_mcp_servers.py
"""

import sys
import subprocess
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def test_import(module_path: str, module_name: str) -> bool:
    """Test if a module can be imported."""
    try:
        result = subprocess.run(
            [sys.executable, "-c", f"import {module_name}"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            print(f"  ✓ {module_path}")
            return True
        else:
            print(f"  ✗ {module_path} - {result.stderr.strip()}")
            return False
    except subprocess.TimeoutExpired:
        print(f"  ✗ {module_path} - timeout")
        return False
    except Exception as e:
        print(f"  ✗ {module_path} - {e}")
        return False


def main():
    print("=== Legilimens MCP Server Tests ===\n")

    # Test backend services (already implemented)
    print("Backend Services:")
    test_import("backend.services.vectorai_client", "services.vectorai_client")
    test_import("backend.services.vector_client", "services.vector_client")
    test_import("backend.services.embedder", "services.embedder")
    test_import("backend.services.gemini_client", "services.gemini_client")
    test_import("backend.services.elevenlabs_client", "services.elevenlabs_client")
    test_import("backend.services.offline_cache", "services.offline_cache")

    print("\nMCP Servers:")
    # Test MCP servers
    mcp_servers = [
        ("mcp/vectorai_db_mcp.py", "vectorai_db_mcp"),
        ("mcp/vector_analytics_mcp.py", "vector_analytics_mcp"),
        ("mcp/embedder_mcp.py", "embedder_mcp"),
        ("mcp/gemini_mcp.py", "gemini_mcp"),
        ("mcp/elevenlabs_mcp.py", "elevenlabs_mcp"),
    ]

    all_pass = True
    for path, name in mcp_servers:
        full_path = os.path.join(os.path.dirname(__file__), "..", path)
        if os.path.exists(full_path):
            if test_import(path, name):
                pass
            else:
                all_pass = False
        else:
            print(f"  ✗ {path} - file not found")
            all_pass = False

    print("\n" + "=" * 40)
    if all_pass:
        print("✓ All MCP servers import successfully!")
        return 0
    else:
        print("✗ Some servers failed to import")
        return 1


if __name__ == "__main__":
    sys.exit(main())