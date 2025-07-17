const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

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
    const trainesCollection = client.db("fitifyDB").collection("trainers");
    const subscribesCollection = client.db("fitifyDB").collection("subscribes");

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
        const result = await trainesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching trainers:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/trainers/approved", async (req, res) => {
      try {
        const result = await trainesCollection
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

      const trainer = await trainesCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!trainer?.email) {
        return res.status(404).send({ message: "Trainer not found" });
      }

      const userUpdateResult = await usersCollection.updateOne(
        { email: trainer.email },
        { $set: { role: "member" } }
      );

      const trainerUpdateResult = await trainesCollection.updateOne(
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
        const trainer = await trainesCollection.findOne({
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
