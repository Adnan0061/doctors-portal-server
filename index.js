const express = require('express')

const app = express();
const cors = require('cors');
let admin = require("firebase-admin");

require('dotenv').config()
const { MongoClient } = require('mongodb');
const port = process.env.PORT || 5000;


// const serviceAccount = require("./doctors-portal-firebase-adminsdk.json");
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


//middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.70s8n.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1]
    // console.log(token)
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
      // console.log(req.decodedEmail)
    }
    catch{

    }
  }
  next();
}

// console.log(uri)

async function run() {
  try {
    await client.connect();
    // console.log('db connected')
    const database = client.db('doctors-portal');
    const usersCollection = database.collection('users');
    const appointmentsCollection = database.collection('appointments');

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
    app.put('/users/admin', verifyToken, async (req, res) => {
      const user = req.body;
      // console.log('put',req.decodedEmail)
      const requester = req.decodedEmail;
      if(requester){
        const requesterAccount = await usersCollection.findOne({email: requester})
        if(requesterAccount.role === 'admin'){
          const filter = {email: user.email}
          // console.log(filter)
          const updateDoc = { $set: {role: 'admin'}}
          const result = await usersCollection.updateOne(filter, updateDoc)
          res.json(result)
        }
        else{
          res.status(401).json({message: 'you do not have access to make admin'})
        }
      }
      // const filter = {email: user.email}
      // const updateDoc = {$set : {role: 'admin'}}
      // const result = await usersCollection.updateOne(filter, updateDoc)
      // res.json(result)
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

    //add appoinments
    app.post('/appointments', async (req, res) => {
      const appoinment = req.body;
      const result = await appointmentsCollection.insertOne(appoinment)
      res.json(result)
    })
  
    // Load appoinments to show in dashboard
    app.get('/appointments', verifyToken, async (req, res) => {
      const email = req.query.idemail;
      const date = req.query.date;
      // const date = new Date(req.query.date).toLocaleDateString();
      // console.log(date)
      // console.log(email)
      const query = {idemail : email, date: date}
      const result = await appointmentsCollection.find(query).toArray()
      res.json(result)
      // console.log(result)
    })
  
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