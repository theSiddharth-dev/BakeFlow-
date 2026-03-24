const mongoose = require("mongoose")

const ConnecttoDB = async()=>{
    try{
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("Product Service Connected to Database Successfully")
    }catch(error){
        console.log("Failed to connect due to ", error)
    }
}


module.exports = ConnecttoDB;