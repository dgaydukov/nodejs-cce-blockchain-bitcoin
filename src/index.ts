require('module-alias/register')

import express = require('express')
import {KafkaConnector} from "@kafka/kafkaConnector"

const app = express()
const port = process.env.PORT

const kc = new KafkaConnector()
kc.listen()

/**
 * todo разобраться как работает zeroMq в биткоин-демоне
 *
 *
 * import {ZmqBalanceCheck} from "@deamons/zmqBalanceCheck"
 * const bc = new ZmqBalanceCheck()
 * bc.listen()
 *
 */
app.listen(port, function (err) {
    if (err) {
        return console.error(err);
    }
    console.log(`Listening http://127.0.0.1:${port}`)
})