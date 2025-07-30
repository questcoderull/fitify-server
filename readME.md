🧘 Fitify - Fitness Tracker Backend
Welcome to the backend of the Fitify Fitness Tracker Web App!
This backend is built with Node.js, Express.js, and MongoDB, and handles all REST APIs, authentication, role management, Stripe payments, and more.

🔗 Live Backend URL: https://fitify-backend.vercel.app
💻 Frontend Repo: [Fitify Frontend](https://github.com/Programming-Hero-Web-Course4/b11a12-client-side-questcoderull)

⚙️ Tech Stack

- Tech / Tool Purpose
- Node.js JavaScript runtime
- Express.js Web framework
- MongoDB NoSQL database
- Mongoose MongoDB ODM (optional if you used native driver)
- JWT (jsonwebtoken) Secure authentication
- CORS Cross-Origin Resource Sharing
- dotenv Environment variable management
- Stripe Payment gateway integration
- Firebase Admin SDK Verifies Firebase token & user authentication

🔐 Authentication & Authorization

- Users sign up/sign in via Firebase on frontend
- Frontend sends token in Authorization header (Bearer token)
- Backend verifies token using Firebase Admin SDK
- After verification, sets req.user and checks role for authorization

🧠 Role Management

- Three user roles supported:
- member: Can book classes, leave reviews
- trainer: Can create slots, assign classes
- admin: Can manage users, trainers, and view statistics

🧾 Core Collections
Collection Description:

- usersCollection Stores all registered users & their roles
- trainersCollection Stores trainer info, slots, expertise
- classesCollection Stores fitness classes info
- bookingsCollection Stores member bookings with trainer & class info
- paymentsCollection Records Stripe payment success
- reviewsCollection Stores reviews left by members for trainers
- forumsCollection Stores community forum posts and votes
- quotesCollection Stores motivational quotes by members

🧍 Users
Method Endpoint Description

- GET /users Get all users (admin only)
- POST /users Save a new user
- PATCH /users/admin/:id Make a user admin
- GET /users/role/:email Get role by email

🧘 Classes
Method Endpoint Description

- GET /classes Get all classes
- GET /classes-with-pagination Paginated + searchable classes
- GET /classes/featured Top 6 most booked classes
- POST /classes Add new class (admin or trainer)

🏋️ Trainers
Method Endpoint Description

- GET /trainers Get all trainers
- GET /trainers/:id Get trainer by ID
- GET /trainers/email/:email Get trainer by email
- POST /trainers Add new trainer (after approval)
- PATCH /trainers/:id Update trainer profile

📅 Slots & Booking
Method Endpoint Description

- POST /slots Add available slot (trainer only)
- GET /slots/trainer/:trainerId Get slots for a trainer
- DELETE /slots/:id Delete a slot
- POST /bookings Record booking after payment
- GET /bookings/member/:email Get member's bookings
- GET /bookings Admin: get all bookings

💳 Payments (Stripe)
Method Endpoint Description

- POST /create-payment-intent Creates a Stripe payment intent
- POST /payments Records a successful payment
- GET /payments/member/:email Get payment history of a member

📝 Reviews & Quotes
Method Endpoint Description

- POST /reviews Member adds a trainer review
- GET /reviews/trainer/:id Get reviews for a trainer
- GET /quotes Get all motivational quotes
- POST /quotes Add a new motivational quote

💬 Forums
Method Endpoint Description

- GET /forums Get all forum posts
- POST /forums Create new forum post
- PATCH /forums/:id/upvote Upvote a post
- PATCH /forums/:id/downvote Downvote a post

🙌 Credits
Made with ❤️ by Rejaul Karim
📧 Email: questcoderull@gmail.com
🌐 Portfolio: [GitHub - questcoderull](https://github.com/questcoderull)
