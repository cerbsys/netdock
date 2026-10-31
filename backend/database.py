from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = "sqlite:////data/inventory.db"

# connect_args={"check_same_thread": False} allows multiple FastAPI workers
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})

def init_db():
    with engine.connect() as conn:
        # Enable Write-Ahead Logging for fast concurrent reads and writes
        conn.exec_driver_sql("PRAGMA journal_mode=WAL;")
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
