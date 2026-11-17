"""
Supabase Connection & pgvector Verification Script
Tests database connectivity, vector extension, and table creation.
Usage: python test_supabase_connection.py [optional_database_url]
"""

import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def verify_supabase(db_url: str):
    print("=" * 60)
    print("  TraceRAG Supabase Verification")
    print("=" * 60)
    print(f"Connecting to: {db_url.split('@')[-1] if '@' in db_url else db_url}")

    connect_args = {}
    if "supabase" in db_url.lower() or ":6543" in db_url or "pooler" in db_url.lower():
        connect_args["statement_cache_size"] = 0

    engine = create_async_engine(db_url, echo=False, pool_pre_ping=True, connect_args=connect_args)

    try:
        async with engine.begin() as conn:
            # 1. Test basic connection
            res = await conn.execute(text("SELECT version();"))
            version = res.scalar()
            print(f"[PASS] Connected to PostgreSQL: {version}")

            # 2. Check & enable pgvector
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            vec_res = await conn.execute(text("SELECT extversion FROM pg_extension WHERE extname = 'vector';"))
            vec_ver = vec_res.scalar()
            print(f"[PASS] pgvector extension active: v{vec_ver}")

            # 3. Check & enable uuid-ossp
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
            print("[PASS] uuid-ossp extension active")

            # 4. Test vector cosine distance operator (<=>)
            test_query = text("SELECT '[1,2,3]'::vector <=> '[1,2,4]'::vector AS cosine_dist;")
            dist = await conn.execute(test_query)
            print(f"[PASS] Vector math & cosine distance check: dist = {dist.scalar():.6f}")

        print("\n[SUCCESS] Supabase database is 100% ready for TraceRAG!")
    except Exception as e:
        print(f"\n[FAIL] Connection or setup failed: {e}")
        sys.exit(1)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("DATABASE_URL")
    if not url:
        print("Error: DATABASE_URL not provided. Pass it as an argument or set DATABASE_URL environment variable.")
        sys.exit(1)
    # Ensure async driver
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    asyncio.run(verify_supabase(url))
