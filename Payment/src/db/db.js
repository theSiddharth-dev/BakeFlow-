const mongoose = require('mongoose')

const ConnecttoDb = async()=>{
    try{
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to Database Successfully")
    }catch(err){
        console.log("Error connecting to Database",err);
    }
}

module.exports = ConnecttoDb;