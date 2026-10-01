# Nexasoul Project — Windows Backend Setup

This version keeps the original frontend/UI/UX intact and connects its existing interactions to a real Node.js + Express + MongoDB backend.

## Requirements
- Windows 10/11
- Node.js LTS
- MongoDB Community Server running locally
- MongoDB Compass (optional)

## Run
1. Open this folder in VS Code.
2. Open Terminal.
3. Run `npm install`.
4. Make sure MongoDB is running on `mongodb://127.0.0.1:27017`.
5. Confirm `.env` contains:
   - `PORT=8080`
   - `MONGODB_URI=mongodb://127.0.0.1:27017/galleyla_dockmaster`
   - `MONGODB_DB=galleyla_dockmaster`
6. Run `npm start`.
7. Open http://localhost:8080

## Database
MongoDB database name: `galleyla_dockmaster`

Collections created automatically:
- `users`
- `berths`
- `bookings`
- `noShowLog`
- `fortuneHistory`
- `settings`

## Demo accounts
Captain: `luffy` / `gomugomu`
Admin: `iceburg` / `galleyla2024`

## Backend features
- Registration/login with bcrypt password hashing and JWT sessions
- Persistent berth data
- Server-side booking overlap validation
- Booking creation
- Cancellation with reliability penalty
- Check-in with reliability reward
- No-show processing
- Booking history through MongoDB
- Admin summary API
- Health endpoint at `/api/health`

## Important
Do not open `index.html` directly. Start the server and use `http://localhost:8080`.
Do not commit `.env` to GitHub.
