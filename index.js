
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const app = express() ;
const port = process.env.PORT || 5555 ;

app.use(cors()) ;
app.use(express.json()) ;
require('dotenv').config() ;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w0yjihf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyToken = async (req , res , next) => {
  if(!req.headers?.authorization?.split(' ')[1]){
    return res.status(401).send({message : "unAuthorized access !"}) ;
  }
  jwt.verify(req.headers?.authorization?.split(' ')[1] , process.env.SECRET_ACCESS_TOKEN , (error , decoded) => {
    if(error){
      return res.status(403).send({message : "forbidden access !"}) ;
    }
    req.user = decoded ;
    next() ;
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db('assignment12').collection('users') ;
    const reviewsCollection = client.db('assignment12').collection('reviews') ;
    const worksCollection = client.db('assignment12').collection('works') ;

    app.get('/reviews' , async (req , res) => {
      const result = await reviewsCollection.find().toArray() ;
      res.send(result) ;
    })

    app.get('/user/:email' , async (req , res) => {
      const email = req.params.email ;
      const filter = {email : email} ;
      const result = await usersCollection.findOne(filter) ;
      res.send(result) ;
    })

    app.get('/workSheets/:email' , verifyToken , async (req , res) => {
      const email = req.params.email ;
      if(req.user.email !== email){
        return res.status(403).send({message : "forbidden access !"})
      }
      const result = (await worksCollection.find({email : email}).sort({date : -1}).toArray()) ;
      res.send(result) ;
    })

    app.post('/jwt' , async (req , res) => {
      const email = req.body ;
      const token = jwt.sign(email , process.env.SECRET_ACCESS_TOKEN , {expiresIn : '3h'}) ;
      res.send({token}) ;
    })

    app.post('/workSheet' , async (req , res) => {
      const workSheet = req.body ;
      const result = await worksCollection.insertOne(workSheet) ;
      res.send(result) ;
    })

    app.put('/users' , async (req , res) => {
      const user = req.body ;
      const filter = {email : user?.email} ;
      const isAxist = await usersCollection.findOne(filter) ;
      if(isAxist){
        return res.send({isAxist , message : "already axist !"})
      }
      const options = { upsert: true };
      const updatedDoc = {
        $set : {
          ...user ,
        }
      }
      const result= await usersCollection.updateOne(filter , updatedDoc , options) ;
      res.send(result) ;
    })

    app.delete('/workSheet/:id' , async (req , res) => {
      const id = req.params.id ;
      const result = await worksCollection.deleteOne({_id : new ObjectId(id)}) ;
      res.send(result) ;
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/' , (req , res) => {
    res.send("the server is running for A12 ! ")
})

app.listen(port , () => {
    console.log(`the port is running at : ${port}`);
})
