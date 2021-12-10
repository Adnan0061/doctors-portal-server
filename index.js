const express = require('express')
const app = express();
const cors = require('cors');
// let admin = require("firebase-admin");
require('dotenv').config()
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const fileUpload = require("express-fileUpload");


const port = process.env.PORT || 5000;


// admin.initializeApp({
//   credential: admin.credential.cert({
//     project_id: process.env.FIREBASE_PROJECT_ID,
//     client_email: process.env.FIREBASE_CLIENT_EMAIL,
//     private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
//   })
// });


//middleware
app.use(cors())
app.use(express.json())
app.use(fileUpload())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.70s8n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// async function verifyToken(req, res, next) {
//   if(req.headers?.authorization?.startsWith('Bearer ')){
//     const token = req.headers.authorization.split(' ')[1]
    
//     try {
//       const decodedUser = await admin.auth().verifyIdToken(token);
//       req.decodedEmail = decodedUser.email;
//     }
//     catch{

//     }
//   }
//   next();
// }

async function run() {
  try {
    await client.connect();
    // console.log('db connected')
    const database = client.db('doctors-portal');
    const usersCollection = database.collection('users');
    const appointmentsCollection = database.collection('appointments');
    const doctorsCollection = database.collection('doctors');

    // add users to db
    app.post('/users', async (req, res) => {
      const user = req.body;

      const existing = await usersCollection.find({}).toArray()
      let userExist = false;
      existing.map(existingUser => {
        if(existingUser.email === user.email){
          userExist = true;
          return;
        }
      })
      if(!userExist){
      const result = await usersCollection.insertOne(user)
      res.json(result)
      }
    })
    
    //make admin
    // app.put('/users/admin', verifyToken, async (req, res) => {
    //   const user = req.body;
    //   const requester = req.decodedEmail;
    //   if(requester){
    //     const requesterAccount = await usersCollection.findOne({email: requester})
    //     if(requesterAccount.role === 'admin'){
    //       const filter = {email: user.email}
    //       const updateDoc = { $set: {role: 'admin'}}
    //       const result = await usersCollection.updateOne(filter, updateDoc)
    //       res.json(result)
    //     }
    //     else{
    //       res.status(401).json({message: 'you do not have access to make admin'})
    //     }
    //   }
    // })

    
    //make admin
    app.put('/users/admin', async (req, res) => {
      const user = req.body;
      const email = user.email;
      // const requester = req.decodedEmail;
      // if(requester){
        const requesterAccount = await usersCollection.findOne({email: email})
        if(requesterAccount.role === 'admin'){
          const filter = {email: user.email}
          const updateDoc = { $set: {role: 'admin'}}
          const result = await usersCollection.updateOne(filter, updateDoc)
          res.json(result)
        }
        else{
          res.status(401).json({message: 'you do not have access to make admin'})
        }
      // }
    })

    //check if admin
    app.get('/users/:email', async (req, res)=>{
      const email = req.params.email;
      const query = { email: email};
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if(user?.role === 'admin'){
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    })


    // add doctors
    app.post('/doctors', async (req, res) => {
      const name = req.body.name
      const email = req.body.email
      const mobile = req.body.mobile
      const pic = req.files.image;

      const picData = pic.data;
      const encodedPic = picData.toString('base64')
      const imageBuffer = Buffer.from(encodedPic, 'base64')

      const doctor = {
        name,
        email,
        mobile,
        image: imageBuffer
      }
      const result = await doctorsCollection.insertOne(doctor)
      res.json(result)
    })

    //display doctors
    app.get('/doctors', async (req, res) => {
      const doctors = await doctorsCollection.find({}).toArray()
      res.json(doctors)
    })

    //add appoinments
    app.post('/appointments', async (req, res) => {
      const appoinment = req.body;
      const result = await appointmentsCollection.insertOne(appoinment)
      res.json(result)
    })
  
    app.put('/appointments/:id', async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id)};
      const updateDoc = {
        $set : {
          payment: payment
        }
      }
      const result = await appointmentsCollection.updateOne(filter, updateDoc)
      res.json(result);
    })

    // Load appoinments to show in dashboard
    // app.get('/appointments', verifyToken, async (req, res) => {
    //   const email = req.query.idemail;
    //   const date = req.query.date;
    //   const query = {idemail : email, date: date}
    //   const result = await appointmentsCollection.find(query).toArray()
    //   res.json(result)
    // })

    // Load appoinments to show in dashboard
    app.get('/appointments', async (req, res) => {
      const email = req.query.idemail;
      const date = req.query.date;
      const query = {idemail : email, date: date}
      const result = await appointmentsCollection.find(query).toArray()
      res.json(result)
    })


    //grt single 
    // app.get('/appointments/:id', verifyToken, async (req, res) => {
    //   const id = req.params.id;
    //   const query = {_id : ObjectId(id)}
    //   const result = await appointmentsCollection.findOne(query)
    //   res.json(result)
    // })

    //grt single 
    app.get('/appointments/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id : ObjectId(id)}
      const result = await appointmentsCollection.findOne(query)
      res.json(result)
    })

    //stripe payment
    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
    
      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    });
  
  }
  finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello from doctors portal')
})


app.listen(port, () => {
  console.log('listening to port', port);
})
