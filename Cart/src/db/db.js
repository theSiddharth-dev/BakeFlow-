const mongoose = require('mongoose')

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("Connected to Database Successfully")
    } catch (error) {
        console.log("failed to connect to database due to ", error);
    }
}

module.exports = connectDB;