const express = require('express');
const { Connect } = require('./broker/broker');
const setListeners = require("./broker/Listeners")

const app = express()

Connect().then(()=>{
    setListeners();
});

app.get("/",(req,res)=>{
    res.status(200).json({
        message:"Notification service is up and running"
    });
})



module.exports = app
