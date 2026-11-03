import os
import sqlite3
import logging
from sqlalchemy import event
from sqlmodel import SQLModel, create_engine, Session

logger = logging.getLogger("netdock.database")

def resolve_canonical_db_path() -> str:
    env_path = os.environ.get("NETDOCK_DB_PATH")
    if env_path:
        return env_path

    data_dir = "/data" if os.path.isdir("/data") else os.path.abspath("./data")
    os.makedirs(data_dir, exist_ok=True)

    inv_path = os.path.join(data_dir, "inventory.db")
    legacy_path = os.path.join(data_dir, "netdock.db")

    # Preserve data: if inventory.db does not exist (or is 0 bytes) and netdock.db has data, copy it safely
    inv_size = os.path.getsize(inv_path) if os.path.exists(inv_path) else 0
    leg_size = os.path.getsize(legacy_path) if os.path.exists(legacy_path) else 0
    if inv_size == 0 and leg_size > 0:
        try:
            src = sqlite3.connect(legacy_path)
            dst = sqlite3.connect(inv_path)
            with dst:
                src.backup(dst)
            dst.close()
            src.close()
            logger.info("Migrated existing database records from %s to %s", legacy_path, inv_path)
        except Exception as exc:
            logger.error("Failed migrating legacy netdock.db to inventory.db: %s", exc)

    return inv_path

ACTIVE_DB_PATH = resolve_canonical_db_path()
DATABASE_URL = f"sqlite:///{ACTIVE_DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False, "timeout": 15},
)

@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA busy_timeout=10000;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
