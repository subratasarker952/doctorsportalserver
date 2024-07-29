require('dotenv').config()
const express = require('express');
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const nodemailerSendgrid = require('nodemailer-sendgrid');


const transport = nodemailer.createTransport(
    nodemailerSendgrid({
        apiKey: process.env.SENDGRID_API_KEY
    })
);


app.use(cors())
app.use(express.json())

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.MONGODB_ATLUS_USER}:${process.env.MONGODB_ATLUS_PASS}@cluster0.sczdaw7.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function veryfyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "unauthorize" })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "forbidden" })
        }
        req.decoded = decoded
        next()
    });

}


async function run() {
    try {
        const serviceCollections = client.db("Doctors-Portal").collection("Services");
        const bookingCollections = client.db("Doctors-Portal").collection("Bookings");
        const userCollections = client.db("Doctors-Portal").collection("users");

        app.get("/services", async (req, res) => {
            const query = {};
            const cursor = serviceCollections.find(query).project({name:1});
            const services = await cursor.toArray();
            res.send(services)
        })
        app.get("/allusers", async (req, res) => {
            const allusers = await userCollections.find().toArray();
            res.send(allusers)
        })

        app.put("/user/:email", async (req, res) => {
            const email = req.params.email
            const userInfo = req.body;
            const query = { email };
            const options = { upsert: true }
            const updatedDoc = {
                $set: userInfo
            }
            const result = await userCollections.updateOne(query, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.JWT_SECRET);
            res.send({ result, token })
        })
        app.put("/user/admin/:email", veryfyJWT, async (req, res) => {
            const email = req.params.email
            const requister = req.decoded.email
            const requesterAccound = await userCollections.findOne({ email: requister });

            if (requesterAccound.role === "admin") {
                const query = { email };
                const updatedDoc = {
                    $set: { role: 'admin' }
                }
                const result = await userCollections.updateOne(query, updatedDoc);
                res.send(result)
            }
            else {
                res.status(403).send({ message: "forbbiden" })
            }
        })
        app.get('/available', async (req, res) => {
            const date = req.query.date
            const services = await serviceCollections.find().toArray()
            const query = { date: date }

            const bookings = await bookingCollections.find(query).toArray()

            services.forEach(service => {
                const serviceBookings = bookings.filter(booking => booking.service === service.name)
                const booked = serviceBookings.map(s => s.slot)

                const available = service.slots.filter(e => !booked.includes(e))
                service.available = available
            })
            res.send(services)
        })
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await userCollections.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        }
        )

        app.get("/bookings", veryfyJWT, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (decodedEmail === email) {
                const query = { email: email }
                const bookings = await bookingCollections.find(query).toArray()
                return res.send(bookings)
            }
            else {
                res.status(403).send({ message: "forbidden" })
            }
        })
        app.post("/bookings", async (req, res) => {
            const newBooking = req.body;
            const query = { service: newBooking.service, date: newBooking.date, email: newBooking.email }
            const exist = await bookingCollections.findOne(query)
            if (exist) {
                return res.send({
                    success: false,
                    booking: exist
                })
            }
            const result = await bookingCollections.insertOne(newBooking);
            res.send({
                success: true,
                booking: result
            })
        })
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);






app.get("/", (req, res) => {
    res.send("Doctor portal server is running")
})
app.all("*", (req, res) => {
    res.send("your request very bad")
})

app.listen(port, () => {
    console.log("Doctor portal server is running", port);
})