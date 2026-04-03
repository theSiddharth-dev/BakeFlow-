const amqplib = require("amqplib");

let channel, connection;
let subscriptions = [];

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const Connect = async () => {
  if (connection) return connection;

  try {
    connection = await amqplib.connect(process.env.RABBIT_URL);
    console.log("✅ Connected to RabbitMQ");

    connection.on("close", () => {
      console.log("❌ RabbitMQ connection closed. Reconnecting...");
      connection = null;
      channel = null;
      setTimeout(Connect, 5000);
    });

    connection.on("error", (err) => {
      console.error("RabbitMQ error:", err);
    });

    channel = await connection.createChannel();
    channel.prefetch(toPositiveInt(process.env.NOTIFICATION_PREFETCH, 20));

    //  RE-SUBSCRIBE after reconnect
    for (const sub of subscriptions) {
      await subscribeToQueue(sub.queueName, sub.callback, sub.options);
    }

  } catch (err) {
    console.error("Error connecting to RabbitMQ:", err);
    setTimeout(Connect, 5000); // retry
  }
};

const publishtoQueue = async (queueName, data) => {
  if (!channel || !connection) await Connect();

  try {
    await channel.assertQueue(queueName, { durable: true });

    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });
    console.log(`Message sent to queue ${queueName}:`, data);
  } catch (err) {
    console.error("Error publishing to queue:", err);
  }
};

const subscribeToQueue = async (queueName, callback, options = {}) => {
  const concurrency = toPositiveInt(options.concurrency, 1);

  subscriptions.push({ queueName, callback, options }); //  store

  if (!channel || !connection) await Connect();

  await channel.assertQueue(queueName, { durable: true });

  console.log(" Subscribed to queue:", queueName);

  for (let worker = 0; worker < concurrency; worker++) {
    channel.consume(queueName, async (msg) => {
      if (msg === null) return;

      try {
        const data = JSON.parse(msg.content.toString());
        console.log(" Received:", data);

        await callback(data);

        channel.ack(msg);
      } catch (err) {
        console.error(` Error processing queue ${queueName}:`, err.message);
        channel.nack(msg, false, false);
      }
    });
  }
};

module.exports = {
  Connect,
  connection,
  channel,
  publishtoQueue,
  subscribeToQueue,
};
