const mongoose = require('mongoose')

const connectDb = async()=>{
    
    try{
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("Connected to MongoDB successfully");
    }catch(err){
        console.log("Error connecting to MongoDB",err);
    }
}

module.exports = connectDb;