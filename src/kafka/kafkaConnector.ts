
import kafka = require('kafka-node')
const crypto = require('crypto')
const debug = require("debug")("kafka")
import {AddressGenerator} from "@logic/addressGenerator"
import {TransactionBuilder} from "@logic/transactionBuilder"
import {AddressInfo} from "@logic/addressInfo"
import {TransactionInfo} from "@logic/transactionInfo"
import {KafkaMessage} from "@db/models/kafkaMessage"
import {default as config} from "@root/config.json"

const METHOD_GET_ADDRESS = "getAddress"
const METHOD_SEND_TRANSACTION = "sendTransaction"
const METHOD_GET_ADDRESS_INFO = "getAddressInfo"
const METHOD_GET_TRANSACTION_INFO = "getTransactionInfo"

interface iMessage{
    topic: string,
    value: string,
    offset: number,
    partition: number,
    key?: string,
    timestamp: Date,
}

export class KafkaConnector {
    client: kafka.Client;

    constructor() {
        this.client = new kafka.KafkaClient({kafkaHost: config.KAFKA_CONNECTION})
    }

    send(message: Object) {
        return new Promise((resolve, reject) => {
            const producer = new kafka.Producer(this.client);
            const payloads = [
                {topic: config.KAFKA_TOPIC_SEND, messages: [JSON.stringify(message)]},
            ];
            producer.send(payloads, (err, data) => {
                if (err) {
                    return debug(err.toString())
                }
                const messageId = data[config.KAFKA_TOPIC_SEND][0]
                debug(`sent to kafka, messageId: ${messageId}, initial message: `, message)
                resolve(messageId)
            });
        })
    }

    async listen() {
        /**
         * for testing purpose you can clear message table
         * KafkaMessage.collection.drop()
         */

        const messageList = await KafkaMessage.find({});
        const hashList = {}
        messageList.map(item => {
            hashList[item.hash] = 1
        })

        const consumer = new kafka.Consumer(
            this.client,
            [
                {topic: config.KAFKA_TOPIC_LISTEN, partition: 0},
            ],
            {
                autoCommit: false,
                fromOffset: true,
            }
        );
        consumer.on('message', async (message: iMessage) => {
            try {
                const hash = crypto.createHash('sha256').update(message.topic + message.value + message.offset).digest('hex')
                if (hashList[hash]) {
                    return
                }
                debug(`------------new kafka message------------`, JSON.stringify(message))
                const km = new KafkaMessage(Object.assign({}, message, {hash: hash}))
                await km.save()
                const inMsg = JSON.parse(message.value)
                const outMsg = Object.assign({}, inMsg)

                switch (inMsg.metadata.methodName) {
                    case METHOD_GET_ADDRESS:
                        let gen = new AddressGenerator()
                        const addressItem = await gen.getAddress()
                        inMsg.data.address = addressItem.address
                        const kmId = await this.send(outMsg)
                        gen.updateKmId(addressItem._id, kmId)
                        break;

                    case METHOD_SEND_TRANSACTION:
                        let txBuilder = new TransactionBuilder(inMsg.data.to, inMsg.data.amount)
                        const txItem = await txBuilder.run()
                        outMsg.data.txId = txItem.txId
                        outMsg.data.type = txItem.type
                        this.send(outMsg)
                        break;

                    case METHOD_GET_ADDRESS_INFO:
                        const addrInfo = new AddressInfo(inMsg.data.address)
                        const addrInfoItem = await addrInfo.get()
                        outMsg.data = Object.assign({}, inMsg.data, addrInfoItem)
                        this.send(outMsg)
                        break;

                    case METHOD_GET_TRANSACTION_INFO:
                        const txInfo = new TransactionInfo(inMsg.data.txId)
                        const txInfoItem = await txInfo.get()
                        outMsg.data = Object.assign({}, inMsg.data, txInfoItem)
                        this.send(outMsg)
                        break;

                    default:
                        outMsg.error = {
                            message: `unknown kafka request method: ${inMsg.metadata.methodName}`,
                        }
                        this.send(outMsg)
                        break;
                }

            }
            catch(ex){
                this.send({
                    originalMessage: message.value,
                    error: {
                        message: ex.toString(),
                    }
                })
            }
        })

    }
}