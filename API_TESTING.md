# API Testing Without Postman

Backend base URL:

```txt
http://localhost:5000/api
```

## Browser Checks

Health:

```txt
http://localhost:5000/api/health
```

Courts:

```txt
http://localhost:5000/api/courts
```

## Frontend Testing

1. Start PostgreSQL, backend, and frontend.
2. Open http://localhost:3000/login.
3. Log in as `user@gmail.com` / `user123`.
4. Open `/courts` and choose an active court.
5. Enter date/time and email.
6. Click Send OTP. In development, the OTP is shown in the UI message.
7. Enter OTP and hold the slot.
8. Click Pay mock amount.
9. Click Confirm booking.
10. Open `/my-bookings`.

Owner:

1. Log in as `owner@gmail.com` / `owner123`.
2. Open `/owner/dashboard`.

Admin:

1. Log in as `admin@gmail.com` / `admin123`.
2. Open `/admin/dashboard`.

## Fetch Examples

Login:

```js
const login = await fetch("http://localhost:5000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "user@gmail.com", password: "user123" })
}).then(r => r.json());

localStorage.setItem("token", login.data.token);
```

List courts:

```js
fetch("http://localhost:5000/api/courts").then(r => r.json()).then(console.log);
```

Send OTP:

```js
fetch("http://localhost:5000/api/otp/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "user@gmail.com" })
}).then(r => r.json()).then(console.log);
```

Create booking hold:

```js
const token = localStorage.getItem("token");

fetch("http://localhost:5000/api/bookings/hold", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    courtId: "replace-with-court-id",
    startTime: "2026-05-03T10:00:00.000Z",
    endTime: "2026-05-03T11:00:00.000Z"
  })
}).then(r => r.json()).then(console.log);
```

Mock payment create:

```js
fetch("http://localhost:5000/api/payments/mock/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ bookingId: "replace-with-booking-id" })
}).then(r => r.json()).then(console.log);
```

Mock payment verify:

```js
fetch("http://localhost:5000/api/payments/mock/verify", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ paymentId: "replace-with-payment-id" })
}).then(r => r.json()).then(console.log);
```

Confirm booking:

```js
fetch("http://localhost:5000/api/bookings/confirm", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    bookingId: "replace-with-booking-id",
    paymentId: "replace-with-payment-id"
  })
}).then(r => r.json()).then(console.log);
```

## VS Code Thunder Client Optional

Thunder Client can call the same routes directly from VS Code. Create a new request, set the URL, choose the HTTP method, and add the JSON body. For protected routes, add an `Authorization` header:

```txt
Bearer your-jwt-token
```
