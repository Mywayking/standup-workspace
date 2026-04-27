#!/usr/bin/env python3
"""为所有已有用户创建缺失的 UserProfile"""
import sys
sys.path.insert(0, '.')

from app.database import SessionLocal, User, UserProfile

def main():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        created = 0

        for user in users:
            profile = db.query(UserProfile).filter(
                UserProfile.user_id == user.id
            ).first()

            if profile:
                continue

            profile = UserProfile(
                user_id=user.id,
                display_name=user.nickname or "用户",
                username=None,
                avatar_url="",
                bio="",
                role="creator",
            )
            db.add(profile)
            created += 1

        db.commit()
        print(f"Backfilled {created} user profiles")

    finally:
        db.close()

if __name__ == "__main__":
    main()
