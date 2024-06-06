
const { MongoClient, ServerApiVersion, ObjectId, ListCollectionsCursor } = require('mongodb');
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const app = express() ;
const port = process.env.PORT || 5555 ;

app.use(cors()) ;
app.use(express.json()) ;
require('dotenv').config() ;

const stripe = require('stripe')(process.env.VITE_STRIPE_API_KEY) ;

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
    const paymentsCollection = client.db('assignment12').collection('payments') ;

    app.get('/reviews' , async (req , res) => {
      const result = await reviewsCollection.find().toArray() ;
      res.send(result) ;
    })

    app.get('/userRole/:email' , async (req , res) => {
      const email = req.params.email ;
      const filter = {email : email} ;
      const result = await usersCollection.findOne(filter) ;
      res.send(result) ;
    })

    app.get('/employees' , async (req , res) => {
      const filter = {role : 'employee'} ;
      const result = await usersCollection.find(filter).toArray() ;
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

    // Single users data for details page -------------------------------
    app.get('/users/:email' , async (req , res) => {
      const email = req.params.email ;
      const filter = {email} ;
      const result = await usersCollection.findOne(filter) ;
      res.send(result) ;
    })

    // get all users name --------------------------------------
    app.get('/users' , async (req , res) => {
      const result = await usersCollection.find({role : 'employee'}).toArray() ;
      res.send(result) ;
    })

    // Is salary already pay or not ----------------------------
    app.get('/user/idSalaryPay' , async (req , res) => {
      const email = req.query.email ;
      const month = parseInt(req.query.month) ;
      const year = parseInt(req.query.year) ;
      const filter = {email , month , year} ;
      const result = await paymentsCollection.findOne(filter) ;
      if(result){
        res.send({success : false , message : "already given"}) ;
      }
      else{
        res.send({success : true , message : "not given"}) ;
      }
    })

    // for useing bar chart --------------------------
    app.get('/users/barCharts/:email' , async (req , res) => {
      const email = req.params.email ;
      const filter = {email} ;
      const result = await paymentsCollection.find(filter).toArray() ;
      res.send(result) ;
    })

    // Get all verified employee with hr ! ---------------------------
    app.get('/verified-users' , async (req , res) => {
      const result = await usersCollection.find({Verified : true}).toArray() ;
      res.send(result) ;
    })

    // get all employees work ------------------------
    app.get('/all-users-works' , async (req , res) => {
      const name = req.query.name ;
      const month = parseInt(req.query.month) ;
      let filter = {} ;
      let options = {} ;
      if(name) filter = {name : name} ;
      if(month) options = {month : month} ;
      const result = await worksCollection.find({...filter , ...options}).toArray() ;
      res.send(result) ;
    })

    // Employees monthly payments --------------------
    app.get('/user/monthly/payments/:email' , async (req , res) => {
      const email = req.params.email ;
      const filter = {email} ;
      const result = await paymentsCollection.find(filter).sort({year : 1 , month : 1}).toArray() ;
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

    // stripe payment intent ---------------------------
    app.post('/create-payment-intent' , async (req , res) => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount : req.body.amount * 100 ,
        currency : 'usd' ,
        payment_method_types : ['card'] ,
      })

      res.send({clientSecret : paymentIntent?.client_secret}) ;
    })

    // Payment save into db ----------------------------
    app.post('/payment-data' , async (req , res) => {
      const data = req.body ;
      const filter = {$and : [{month : data.month} , {year : data.year} , {email : data.email}]} ;
      const isMonthValid = await paymentsCollection.findOne(filter) ;

      if(isMonthValid){
        return res.send({isMonthValid , message : "salary already given !" , success : false})
      }

      const result = await paymentsCollection.insertOne(data) ;
      res.send(result) ;
    })

    app.patch('/user/verify/:id' , async (req , res) => {
      const id = req.params.id ;
      const {Verified} = req.body ;
      const filter = {_id : new ObjectId(id)} ;
      const updatedDoc = {
        $set : {
          Verified ,
        }
      }
      const result = await usersCollection.updateOne(filter , updatedDoc) ;
      res.send(result) ;
    })

    // to update the salary -----------------------------------
    app.patch('/user-salary-update/:id' , async (req , res) => {
      const id = req.params.id ;
      const data = req.body ;
      const filter = {_id : new ObjectId(id)} ;
      const updatedDoc = {
        $set : {
          ...data ,
        }
      }
      const result = await usersCollection.updateOne(filter , updatedDoc) ;
      res.send(result) ;
    }) 

    // to update users role -----------------------------------
    app.patch('/users-role-update/:id' , async (req , res) => {
      const id = req.params.id ;
      const filter = {_id : new ObjectId(id)} ;
      const data = req.body ;
      const updatedDoc = {
        $set : {
          ...data ,
        }
      }
      const result = await usersCollection.updateOne(filter , updatedDoc) ;
      res.send(result) ;
    })

    // update users fireing --------------------------------
    app.patch('/users-isFired/:id' , async (req , res) => {
      const id = req.params.id ;
      const filter = {_id : new ObjectId(id)} ;
      const updatedDoc = {
        $set : {
          isFired : true ,
        }
      }
      const result = await usersCollection.updateOne(filter , updatedDoc) ; 
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
