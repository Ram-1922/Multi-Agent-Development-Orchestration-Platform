from motor.motor_asyncio import AsyncIOMotorClient
import os
import certifi  # 1. Import certifi
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

# We create a global database object to hold our connection
class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def connect_to_mongo():
    print("Connecting to MongoDB Atlas...")
    
    # 2. Add tlsCAFile=certifi.where() to the connection
    db.client = AsyncIOMotorClient(MONGODB_URI, tlsCAFile=certifi.where())
    
    print("Connected successfully!")

async def close_mongo_connection():
    if db.client:
        db.client.close()
        print("MongoDB connection closed.")