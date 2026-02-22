const amqplib = require('amqplib');

let channel, connection;

const Connect = async()=>{

    if(connection) return connection;

    try{

        connection = await amqplib.connect(process.env.RABBIT_URL);
        console.log('Connected to RabbitMQ');
        channel = await connection.createChannel();

    }catch(err){
        console.error('Error connecting to RabbitMQ:', err);
    }
}

const publishtoQueue = async(queueName, data)=>{
    if(!channel || !connection) await Connect();

    try{
        await channel.assertQueue(queueName, { durable: true });

        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)));
        console.log(`Message sent to queue ${queueName}:`, data);
    
    }catch(err){
        console.error('Error publishing to queue:', err);
    }
}

const subscribeToQueue = async(queueName,callback)=>{

    if(!channel || !connection)  await Connect();

    await channel.assertQueue(queueName,{
        durable:true
    });

    channel.consume(queueName,async(msg)=>{

        if(msg !== null){
            const data = JSON.parse(msg.content.toString());
            await callback(data);
            channel.ack(msg);
        }

    })
}


module.exports = {
    Connect,
    connection,
    channel,
    publishtoQueue,
    subscribeToQueue
}

