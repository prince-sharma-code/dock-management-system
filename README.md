# ⚓ Dock Management System — Galley-La DockMaster

> **Smart Port Booking & Dock Management System**  
> A full-stack platform for managing limited docking spaces, reservations, berth availability, and vessel operations while preventing booking conflicts and reducing unused dock capacity.

---

## 🌊 Overview

**Galley-La DockMaster** is a smart maritime dock management platform designed to digitize and simplify port berth allocation and vessel reservations.

The system allows captains to register, log in, check berth availability, reserve docking slots, manage bookings, check in at the dock, and track their booking history.

Administrators can monitor users, bookings, berth utilization, and operational activity through a centralized control room.

The project combines a themed frontend inspired by **Water 7 / Galley-La** with a functional backend and MongoDB database.

---

## 🎯 Problem Statement

Ports often have a limited number of docking spaces while receiving multiple vessel booking requests.

Traditional or poorly coordinated booking systems can lead to:

- Double booking of berths
- Unused docking slots
- Difficult reservation management
- No-show vessels
- Lack of booking history
- Manual administrative work
- Poor visibility into berth utilization

### 💡 Our Solution

Galley-La DockMaster provides a centralized booking system that:

- Shows berth availability
- Prevents conflicting reservations
- Stores bookings permanently
- Tracks check-ins and cancellations
- Maintains captain reliability scores
- Provides an administrative control room
- Uses MongoDB for persistent data storage

---

## ✨ Key Features

### 👨‍✈️ Captain Portal

- Captain registration
- Secure login
- Password hashing using bcrypt
- Persistent user accounts
- Captain profile
- Reliability score
- Booking history

### ⚓ Smart Dock Booking

- View available berths
- Select date and time
- Reserve docking slots
- Prevent overlapping bookings
- Store reservation details
- Generate booking records

### 🔄 Booking Management

- View active bookings
- Cancel reservations
- Check in to a berth
- Track completed trips
- Detect no-shows
- Maintain booking history

### 📊 Reliability Score

Captain reliability is dynamically affected by actions:

| Action | Score Change |
|--------|--------------|
| ✅ Check-in | +2 |
| ❌ Cancellation | -5 |
| ⚠️ No-show | -15 |

This encourages responsible berth usage and helps reduce unused docking capacity.

### 🛠️ Admin Control Room

Administrators can monitor:

- Registered captains
- Berths
- Reservations
- Booking status
- Check-ins
- Cancellations
- No-shows
- Reliability scores

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │      Captain        │
                    │   / Administrator   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Frontend UI     │
                    │ HTML / CSS / JS     │
                    └──────────┬──────────┘
                               │
                         HTTP Requests
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Node.js + Express │
                    │      Backend API     │
                    └──────────┬──────────┘
                               │
                         Mongoose ODM
                               │
                               ▼
                    ┌─────────────────────┐
                    │       MongoDB       │
                    │ galleyla_dockmaster │
                    └─────────────────────┘
