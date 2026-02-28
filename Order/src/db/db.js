const mongoose = require("mongoose")

const ConnecttoDb = async()=>{
    try{
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Database Connected Successfully");

    }catch(error){
        console.log("Failed to connect due to ", error);
    }
}

module.exports  = ConnecttoDb;