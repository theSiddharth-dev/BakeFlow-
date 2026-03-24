const amqplib = require("amqplib");

let channel, connection;

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const Connect = async () => {
  if (connection) return connection;

  try {
    connection = await amqplib.connect(process.env.RABBIT_URL);
    console.log("Connected to RabbitMQ");
    channel = await connection.createChannel();
    channel.prefetch(toPositiveInt(process.env.NOTIFICATION_PREFETCH, 20));
  } catch (err) {
    console.error("Error connecting to RabbitMQ:", err);
    throw err;
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

  if (!channel || !connection) await Connect();

  await channel.assertQueue(queueName, {
    durable: true,
  });

  for (let worker = 0; worker < concurrency; worker++) {
    channel.consume(queueName, async (msg) => {
      if (msg === null) return;

      try {
        const data = JSON.parse(msg.content.toString());
        await callback(data);
        channel.ack(msg);
      } catch (err) {
        console.error(`Error processing queue ${queueName}:`, err.message);
        if (msg.fields.redelivered) {
          channel.nack(msg, false, false);
        } else {
          channel.nack(msg, false, true);
        }
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
