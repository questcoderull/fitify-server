const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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

    // Calass releted apis
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

    app.post("/trainers", async (req, res) => {
      const data = req.body;
      const result = await trainersCollection.insertOne(data);
      res.send(result);
    });

    app.get("/trainers/pending", async (req, res) => {
      try {
        const result = await trainersCollection
          .find({ application_status: "pending" })
          .sort({ joined_At: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/trainers/approved", async (req, res) => {
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
        console.error("Error fetching trainer:", error);
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
    app.get("/trainers-with-email/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const trainer = await trainersCollection.findOne({ email });
        if (!trainer) {
          return res.status(404).send({ message: "Trainer not found" });
        }
        res.send(trainer);
      } catch (error) {
        console.error("Error fetching trainer by email:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

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

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      if (user) {
        res.send({ role: user.role });
      } else {
        res.status(404).send({ role: "member" });
      }
    });

    app.get("/users/profile/:email", async (req, res) => {
      const email = req.params.email;
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

    // subscribe releted apis.
    app.get("/subscribes", async (req, res) => {
      const result = await subscribesCollection
        .find()
        .sort({ subscribed_At: -1 })
        .toArray();
      res.send(result);
    });

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
    app.get("/bookings/trainer/:trainerId", async (req, res) => {
      const trainerId = req.params.trainerId;
      try {
        const bookings = await bookingsCollection.find({ trainerId }).toArray();
        res.send(bookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

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

    // ✅ GET /bookings/member/:email
    app.get("/bookings/member/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const bookings = await bookingsCollection
          .find({ memberEmail: email })
          .sort({ paymentTime: -1 }) // Sort by paymentTime instead of 'date'
          .toArray();

        res.send(bookings);
      } catch (error) {
        console.error("Error fetching member bookings:", error);
        res.status(500).send({ message: "Server error" });
      }
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
