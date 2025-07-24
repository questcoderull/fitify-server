const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const admin = require("firebase-admin");

require("dotenv").config();

const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

var serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nmolcz4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    // collections
    const classesCollection = client.db("fitifyDB").collection("classes");
    const usersCollection = client.db("fitifyDB").collection("users");
    const trainersCollection = client.db("fitifyDB").collection("trainers");
    const subscribesCollection = client.db("fitifyDB").collection("subscribes");
    const forumsCollection = client.db("fitifyDB").collection("forums");
    const bookingsCollection = client.db("fitifyDB").collection("bookings");
    const paymentsCollection = client.db("fitifyDB").collection("payments");
    const reviewCollection = client.db("fitifyDB").collection("review");

    // custom middlewares
    const verifyFBToken = async (req, res, next) => {
      const authoHeader = req.headers.authorization;
      if (!authoHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authoHeader.split(" ")[1];
      // console.log("toke token token", token);
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      // now verifiying token (r ei jonno ekhon firebase admin sdk install korthe hobe)
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
      } catch (error) {
        return res.status(403).send({ message: "forbidden access" });
      }
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyTrainer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await usersCollection.findOne(query);

      if (!user || user.role !== "trainer") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };

    // Class releted apis
    // Get all classes
    app.get("/classes", async (req, res) => {
      try {
        const result = await classesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Failed to fetch classes:", error);
        res.status(500).send({ message: "Failed to load classes" });
      }
    });

    //get api for pagination
    app.get("/classes-with-pagination", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const result = await classesCollection
          .find()
          .skip(skip)
          .limit(limit)
          .toArray();

        const total = await classesCollection.estimatedDocumentCount();

        res.send({ result, total });
      } catch (error) {
        console.error("Failed to fetch classes:", error);
        res.status(500).send({ message: "Failed to load classes" });
      }
    });

    // GET top 6 featured classes based on bookedCount
    app.get("/featured-classes", async (req, res) => {
      try {
        const result = await classesCollection
          .find()
          .sort({ bookedCount: -1 })
          .limit(6)
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching featured classes:", error);
        res.status(500).send({ message: "Failed to fetch featured classes" });
      }
    });

    app.get("/classes/matching/:email", async (req, res) => {
      try {
        const email = req.params.email;
        // Get trainer
        const trainer = await trainersCollection.findOne({ email });

        if (!trainer) {
          return res.status(404).send({ message: "Trainer not found" });
        }
        // Get skills (expertise)
        const expertiseList = trainer.expertise;
        // Find classes that match any expertise
        const matchedClasses = await classesCollection
          .find({ category: { $in: expertiseList } })
          .toArray();
        res.send(matchedClasses);
      } catch (err) {
        console.error("Error fetching matched classes:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/classes/:id", async (req, res) => {
      const classId = req.params.id;
      const singleClass = await classesCollection.findOne({
        _id: new ObjectId(classId),
      });
      res.send(singleClass);
    });

    app.post("/class", async (req, res) => {
      try {
        const classData = req.body;
        classData.created_At = new Date().toISOString();
        const result = await classesCollection.insertOne(classData);
        res.send(result);
      } catch (error) {
        console.error("Error adding class:", error);
        res.status(500).send({ error: "Failed to add class" });
      }
    });

    // PATCH /classes/increase-booked/:id
    app.patch("/classes/increase-booked/:id", async (req, res) => {
      const classId = req.params.id;
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(classId) },
        { $inc: { bookedCount: 1 } }
      );
      res.send(result);
    });

    // trainers releted apis.
    app.get("/trainers", async (req, res) => {
      try {
        const result = await trainersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching trainers:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // for pagination.
    app.get("/trainers-with-paginaton", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1; // page nuber will come from frontend
        const limit = parseInt(req.query.limit) || 10; // how many  trainer will i show per page.
        const skip = (page - 1) * limit; //skipping data based on page number.

        const result = await trainersCollection
          .find()
          .skip(skip)
          .limit(limit)
          .toArray();

        const total = await trainersCollection.estimatedDocumentCount();

        res.send({
          result, // showing this in frontend.
          total, // toatl trainer count showing in frontend for pagination
        });
      } catch (error) {
        console.error("Error fetching trainers:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // pagination er jonno video dekhe likhechilam. jhonkar bhai korechilen.
    // app.get("/traineraCount", async (req, res) => {
    //   const count = trainersCollection.estimatedDocumentCount();
    //   res.send({ count });
    // });

    app.post("/trainers", async (req, res) => {
      const data = req.body;
      const result = await trainersCollection.insertOne(data);
      res.send(result);
    });

    app.get(
      "/trainers/pending",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const result = await trainersCollection
            .find({ application_status: "pending" })
            .sort({ joined_At: -1 })
            .toArray();
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Internal server error" });
        }
      }
    );

    app.get(
      "/trainers/approved",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const result = await trainersCollection
            .find({ application_status: "approved" })
            .sort({ joined_At: -1 })
            .toArray();
          res.send(result);
        } catch (error) {
          console.error("Error fetching trainers:", error);
          res.status(500).send({ message: "Internal server error" });
        }
      }
    );

    app.get("/random-trainers", async (req, res) => {
      const limit = parseInt(req.query.limit) || 3;
      const result = await trainersCollection
        .aggregate([{ $sample: { size: limit } }])
        .toArray();

      res.send(result);
    });

    // Remove trainer role
    // app.patch("/trainers/remove-trainer/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const update = { $set: { role: "member" } };
    //   const result = await usersCollection.updateOne(filter, update);
    //   res.send(result);
    // });

    app.patch("/trainers/remove-trainer/:id", async (req, res) => {
      const id = req.params.id;

      const trainer = await trainersCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!trainer?.email) {
        return res.status(404).send({ message: "Trainer not found" });
      }

      const userUpdateResult = await usersCollection.updateOne(
        { email: trainer.email },
        { $set: { role: "member" } }
      );

      const trainerUpdateResult = await trainersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { application_status: "pending" } }
      );

      res.send({
        message: "Trainer demoted successfully",
        userUpdateResult,
        trainerUpdateResult,
      });
    });

    app.get("/trainers/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const trainer = await trainersCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!trainer) {
          return res.status(404).send({ message: "Trainer not found" });
        }
        res.send(trainer);
      } catch (error) {
        // console.error("Error fetching trainer:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.patch("/trainers/approve/:id", async (req, res) => {
      const id = req.params.id;
      const trainer = await trainersCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!trainer)
        return res.status(404).send({ message: "Trainer not found" });

      await usersCollection.updateOne(
        { email: trainer.email },
        { $set: { role: "trainer" } }
      );

      const result = await trainersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { application_status: "approved" } }
      );

      res.send(result);
    });

    app.patch("/trainers/reject/:id", async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;

      const result = await trainersCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            application_status: "rejected",
            rejectionFeedback: feedback,
          },
        }
      );

      res.send(result);
    });

    // Get single trainer by email
    app.get(
      "/trainers-with-email/:email",
      verifyFBToken,
      verifyTrainer,
      async (req, res) => {
        const email = req.params.email;
        //checking the requiester is you,
        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "forbidden access" });
        }

        try {
          const trainer = await trainersCollection.findOne({ email });
          if (!trainer) {
            return res.status(404).send({ message: "Trainer not found" });
          }
          res.send(trainer);
        } catch (error) {
          // console.error("Error fetching trainer by email:", error);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    app.patch("/trainers/add-slot", async (req, res) => {
      const { email, newSlot } = req.body;
      if (!email || !newSlot) {
        return res.status(400).send({ message: "Missing data" });
      }
      try {
        const trainer = await trainersCollection.findOne({ email });
        if (!trainer) {
          return res.status(404).send({ message: "Trainer not found" });
        }
        // পুরানো স্লট গুলো আনো
        let structuredSlots = trainer.structuredSlots || [];
        // দিনটা খুঁজো
        const existingDay = structuredSlots.find((s) => s.day === newSlot.day);
        if (existingDay) {
          // ওই দিনের মধ্যে স্লট লেবেল আছে কিনা দেখো
          const existingLabel = existingDay.slots.find(
            (slot) => slot.label === newSlot.slot.label
          );
          if (existingLabel) {
            // টাইম গুলো যোগ করো যদি আগে না থাকে
            newSlot.slot.times.forEach((time) => {
              if (!existingLabel.times.includes(time)) {
                existingLabel.times.push(time);
              }
            });
          } else {
            // নতুন label যোগ করো
            existingDay.slots.push(newSlot.slot);
          }
        } else {
          // নতুন দিন আর স্লট দুটোই যোগ করো
          structuredSlots.push({
            day: newSlot.day,
            slots: [newSlot.slot],
          });
        }
        const result = await trainersCollection.updateOne(
          { email },
          { $set: { structuredSlots } }
        );
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // DELETE /trainers/:trainerId/slot
    // body: { day, label, time }
    // app.delete("/trainers/:trainerId/slot", async (req, res) => {
    //   const { trainerId } = req.params;
    //   const { day, label, time } = req.body;

    //   if (!day || !label || !time) {
    //     return res.status(400).json({ message: "Missing required fields" });
    //   }

    //   try {
    //     const trainer = await trainersCollection.findOne({
    //       _id: new ObjectId(trainerId),
    //     });

    //     if (!trainer)
    //       return res.status(404).json({ message: "Trainer not found" });

    //     // Deep copy for manipulation
    //     const structuredSlots = trainer.structuredSlots || [];

    //     // Find day block
    //     const dayIndex = structuredSlots.findIndex((d) => d.day === day);
    //     if (dayIndex === -1)
    //       return res.status(404).json({ message: "Day not found" });

    //     // Find slot with label
    //     const slotIndex = structuredSlots[dayIndex].slots.findIndex(
    //       (s) => s.label === label
    //     );
    //     if (slotIndex === -1)
    //       return res.status(404).json({ message: "Slot label not found" });

    //     // Remove the time from times array
    //     const timesArr = structuredSlots[dayIndex].slots[slotIndex].times;
    //     const timeIndex = timesArr.indexOf(time);
    //     if (timeIndex === -1)
    //       return res.status(404).json({ message: "Time not found" });

    //     timesArr.splice(timeIndex, 1);

    //     // If times array is empty, remove slot
    //     if (timesArr.length === 0) {
    //       structuredSlots[dayIndex].slots.splice(slotIndex, 1);
    //     }

    //     // If slots array is empty for that day, remove day block
    //     if (structuredSlots[dayIndex].slots.length === 0) {
    //       structuredSlots.splice(dayIndex, 1);
    //     }

    //     // Update trainer document
    //     await trainersCollection.updateOne(
    //       { _id: new ObjectId(trainerId) },
    //       { $set: { structuredSlots } }
    //     );

    //     return res.json({ message: "Slot deleted successfully" });
    //   } catch (error) {
    //     console.error("Error deleting slot:", error);
    //     return res.status(500).json({ message: "Server error" });
    //   }
    // });

    app.delete("/trainers/:trainerId/slot", async (req, res) => {
      const { trainerId } = req.params;
      const { day, label, time } = req.body;

      if (!day || !label || !time) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      try {
        const trainer = await trainersCollection.findOne({
          _id: new ObjectId(trainerId),
        });
        if (!trainer) {
          return res.status(404).json({ message: "Trainer not found" });
        }

        const structuredSlots = trainer.structuredSlots || [];

        // Find the day block
        const dayBlockIndex = structuredSlots.findIndex(
          (block) => block.day === day
        );
        if (dayBlockIndex === -1) {
          return res.status(404).json({ message: "Day not found" });
        }

        // Find the slot group by label
        const slotIndex = structuredSlots[dayBlockIndex].slots.findIndex(
          (slot) => slot.label === label
        );
        if (slotIndex === -1) {
          return res.status(404).json({ message: "Slot label not found" });
        }

        // Find the time index in that slot
        const timeIndex =
          structuredSlots[dayBlockIndex].slots[slotIndex].times.indexOf(time);
        if (timeIndex === -1) {
          return res.status(404).json({ message: "Time not found" });
        }

        // Remove the specific time from times array
        structuredSlots[dayBlockIndex].slots[slotIndex].times.splice(
          timeIndex,
          1
        );

        // If no more times in this slot, remove the entire slot
        if (
          structuredSlots[dayBlockIndex].slots[slotIndex].times.length === 0
        ) {
          structuredSlots[dayBlockIndex].slots.splice(slotIndex, 1);
        }

        // If no more slots on this day, remove the day block
        if (structuredSlots[dayBlockIndex].slots.length === 0) {
          structuredSlots.splice(dayBlockIndex, 1);
        }

        // Update the trainer document in DB
        await trainersCollection.updateOne(
          { _id: new ObjectId(trainerId) },
          { $set: { structuredSlots } }
        );

        res.json({ message: "Slot deleted successfully" });
      } catch (error) {
        console.error("Error deleting slot:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // users releted apis.
    app.get("/users", verifyFBToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection
        .find()
        .sort({ created_at: -1 })
        .toArray();

      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const email = req.body.email;

      const userExists = await usersCollection.findOne({ email });

      if (userExists) {
        return res
          .status(200)
          .send({ message: "user already exists", inserted: false });
      }
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // for getting user's role
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      if (user) {
        res.send({ role: user.role });
      } else {
        res.status(404).send({ role: "member" });
      }
    });

    app.get("/users/profile/:email", verifyFBToken, async (req, res) => {
      const email = req.params.email;
      //checking the requiester is you,
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    app.patch("/user/profile/:email", async (req, res) => {
      const email = req.params.email;
      const { name, profilePic } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        { $set: { name, profilePic } }
      );

      res.send(result);
    });

    app.post("/users/google", async (req, res) => {
      const { name, email, profilePic } = req.body;

      const userExists = await usersCollection.findOne({ email });

      if (userExists) {
        const result = await usersCollection.updateOne(
          { email },
          { $set: { last_log_in: new Date().toISOString() } }
        );
        return res.send({
          message: "last login updated",
          updated: true,
          result,
        });
      } else {
        const newUser = {
          name: name,
          email: email,
          profilePic: profilePic,
          role: "member",
          created_at: new Date().toISOString(),
          last_log_in: new Date().toISOString(),
        };
        const result = await usersCollection.insertOne(newUser);
        return res.send({ message: "user created", created: true, result });
      }
    });

    app.patch("/users/update-last-login", async (req, res) => {
      const { email, last_log_in } = req.body;
      const filter = { email };
      const updateDoc = {
        $set: { last_log_in },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/my-application/:email", async (req, res) => {
      const email = req.params.email;

      try {
        const result = await trainersCollection
          .find({
            email,
            application_status: { $in: ["pending", "rejected"] },
          })
          .toArray();

        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // Make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "admin" } }
      );
      res.send(result);
    });

    // Remove admin
    app.patch("/users/remove-admin/:id", async (req, res) => {
      try {
        const targetId = req.params.id;
        const requesterEmail = req.user.email;
        const requester = await usersCollection.findOne(
          { email: requesterEmail },
          { projection: { isMainAdmin: 1 } }
        );
        if (!requester || requester.isMainAdmin !== true) {
          return res.status(403).send({
            success: false,
            message: "You can't remove this admin. You are not the main admin.",
          });
        }
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(targetId) },
          { $set: { role: "member" } }
        );

        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Server error while removing admin",
        });
      }
    });

    // subscribe releted apis.
    app.get("/subscribes", verifyFBToken, verifyAdmin, async (req, res) => {
      const result = await subscribesCollection
        .find()
        .sort({ subscribed_At: -1 })
        .toArray();
      res.send(result);
    });

    app.get(
      "/admin/subscriber-vs-paid",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const subscribersCount =
            await subscribesCollection.estimatedDocumentCount();

          const allBookings = await bookingsCollection
            .find({})
            .project({ memberEmail: 1 })
            .toArray();
          const uniqueEmails = [
            ...new Set(allBookings.map((b) => b.memberEmail)),
          ];
          const paidMembersCount = uniqueEmails.length;

          res.send({
            subscribersCount,
            paidMembersCount,
          });
        } catch (error) {
          console.error("Error fetching chart data:", error);
          res.status(500).send({ error: "Failed to fetch chart data" });
        }
      }
    );

    app.post("/subscribes", async (req, res) => {
      const { email, name } = req.body;
      const existing = await subscribesCollection.findOne({ email });
      if (existing) {
        return res.status(400).send({ message: "You are already subscribed!" });
      }
      const subscribeData = {
        name,
        email,
        subscribed_At: new Date().toISOString(),
      };
      const result = await subscribesCollection.insertOne(subscribeData);
      res.send({ success: true, message: "Subscribed successfully!", result });
    });

    // Forum/community releted apis
    app.get("/forums", async (req, res) => {
      const result = await forumsCollection
        .find()
        .sort({ added_At: -1 })
        .toArray();
      res.send(result);
    });

    //for paignation.
    app.get("/forums-with-pagination", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const result = await forumsCollection
          .find()
          .sort({ added_At: -1 }) // latest forum first
          .skip(skip)
          .limit(limit)
          .toArray();

        const total = await forumsCollection.estimatedDocumentCount();

        res.send({ result, total });
      } catch (error) {
        console.error("Failed to fetch forums:", error);
        res.status(500).send({ message: "Failed to load forums" });
      }
    });

    app.get("/forums/:id", async (req, res) => {
      const id = req.params.id;
      const result = await forumsCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //  Route to get latest community/forum posts
    app.get("/latest-forums", async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 6;
        const result = await forumsCollection
          .find()
          .sort({ added_At: -1 })
          .limit(limit)
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch latest forums" });
      }
    });

    app.post("/forums", async (req, res) => {
      try {
        const forumData = req.body;

        const result = await forumsCollection.insertOne(forumData);
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Forum post failed" });
      }
    });

    app.patch("/forums/vote/:id", async (req, res) => {
      const { email, type } = req.body;
      const postId = req.params.id;

      const post = await forumsCollection.findOne({
        _id: new ObjectId(postId),
      });
      if (!post) return res.status(404).send({ message: "Post not found" });

      const updateDoc = {};

      // remove
      if (type === "remove") {
        updateDoc.$pull = {
          upVotes: email,
          downVotes: email,
        };
      }

      // upvote
      else if (type === "up") {
        updateDoc.$addToSet = { upVotes: email };
        updateDoc.$pull = { downVotes: email };
      }

      // downvote
      else if (type === "down") {
        updateDoc.$addToSet = { downVotes: email };
        updateDoc.$pull = { upVotes: email };
      }

      const result = await forumsCollection.updateOne(
        { _id: new ObjectId(postId) },
        updateDoc
      );

      res.send(result);
    });

    //booking  relted apis
    app.post("/bookings", async (req, res) => {
      const bookingData = req.body;
      const result = await bookingsCollection.insertOne(bookingData);
      res.send(result);
    });

    // Get all bookings by trainerId
    app.get(
      "/bookings/trainer/:trainerId",
      verifyFBToken,
      verifyTrainer,
      async (req, res) => {
        const trainerId = req.params.trainerId;
        try {
          const bookings = await bookingsCollection
            .find({ trainerId })
            .toArray();
          res.send(bookings);
        } catch (error) {
          console.error("Error fetching bookings:", error);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    //Pyment releted apis
    app.post("/create-payment-intent", async (req, res) => {
      const feeInCents = req.body.feeInCents;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: feeInCents, // Amount in cents
          currency: "usd",
          payment_method_types: ["card"], // Specify the payment method types
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // POST route to save payment info
    app.post("/payments", async (req, res) => {
      try {
        const paymentInfo = req.body;
        const result = await paymentsCollection.insertOne(paymentInfo);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to save payment", error });
      }
    });

    // GET /bookings/member/:email
    app.get("/bookings/member/:email", verifyFBToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "forbidden access" });
        }
        const bookings = await bookingsCollection
          .find({ memberEmail: email })
          .sort({ paymentTime: -1 })
          .toArray();

        res.send(bookings);
      } catch (error) {
        console.error("Error fetching member bookings:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get(
      "/admin/balance-overview",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const totalBalancePipeline = [
            {
              $group: {
                _id: null,
                total: { $sum: "$amountPaid" },
              },
            },
          ];

          const [totalResult] = await bookingsCollection
            .aggregate(totalBalancePipeline)
            .toArray();
          const totalBalance = totalResult?.total || 0;

          const lastPayments = await bookingsCollection
            .find()
            .sort({ paymentTime: -1 })
            .limit(6)
            .toArray();

          res.send({ totalBalance, lastPayments });
        } catch (error) {
          console.error("Failed to fetch balance overview", error);
          res.status(500).send({ message: "Internal server error" });
        }
      }
    );

    // review releted api.
    app.get("/review", async (req, res) => {
      const result = await reviewCollection
        .find()
        .sort({ reviwed_at: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
