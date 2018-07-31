
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

export class KafkaConnector{
    client: kafka.Client;

    constructor(){
        this.client = new kafka.KafkaClient({kafkaHost: config.KAFKA_CONNECTION})
    }

    send(message: Object){
        return new Promise((resolve, reject)=>{
            const producer = new kafka.Producer(this.client);
            const payloads = [
                { topic: config.KAFKA_TOPIC_SEND, messages: [JSON.stringify(message)]},
            ];
            producer.send(payloads,  (err, data)=>{
                if(err){
                    return debug(err.toString())
                }
                const messageId = data[config.KAFKA_TOPIC_SEND][0]
                debug(`sent to kafka, messageId: ${messageId}, initial message: `, message)
                resolve(messageId)
            });
        })
    }

    async listen(){
        /**
         * for testing purpose you can clear message table
         * KafkaMessage.collection.drop()
         */
        const messageList = await KafkaMessage.find({});
        const hashList = {}
        messageList.map(item=>{
            hashList[item.hash] = 1
        })

        const consumer = new kafka.Consumer(
            this.client,
            [
                { topic: config.KAFKA_TOPIC_LISTEN, partition: 0},
            ],
            {
                autoCommit: false,
                fromOffset: true,
            }
        );
        consumer.on('message', (message: iMessage)=>{
            const hash = crypto.createHash('sha256').update(message.topic+message.value+message.offset).digest('hex')
            if(hashList[hash]){
                return
            }
            debug(`------------new kafka message------------`, JSON.stringify(message))
            const km = new KafkaMessage(Object.assign({}, message, {hash: hash}))
            km.save()
            const inMsg = JSON.parse(message.value)
            const outMsg = Object.assign({}, inMsg)
            
            switch(inMsg.metadata.methodName){
                case METHOD_GET_ADDRESS:
                    let gen = new AddressGenerator()
                    gen.getAddress((err, address)=>{
                        if(err){
                            inMsg.error = {
                                message: err.message,
                            }
                            this.send(outMsg)
                        }
                        else{
                            inMsg.data.address = address.address
                            this.send(outMsg)
                                .then(kmId=>{
                                    gen.updateKmId(address._id, kmId)
                                })
                        }
                    })
                    break;

                case METHOD_SEND_TRANSACTION:
                    let tx = new TransactionBuilder(inMsg.data.to, inMsg.data.amount)
                    tx.run((err, tx)=>{
                        if(err){
                            inMsg.error = {
                                message: err.message,
                            }
                        }
                        else{
                            inMsg.data.txId = tx.txId
                            inMsg.data.type = tx.type
                        }
                        this.send(outMsg)
                    })
                    break;

                case METHOD_GET_ADDRESS_INFO:
                    const addrInfo = new AddressInfo(inMsg.data.address)
                    addrInfo.get((err, item)=>{
                        if(err){
                            inMsg.error = {
                                message: err.toString()
                            }
                        }
                        else{
                            inMsg.data = Object.assign({}, inMsg.data, item)
                        }
                        this.send(outMsg)
                    })
                    break;

                case METHOD_GET_TRANSACTION_INFO:
                    const txInfo = new TransactionInfo(inMsg.data.txId)
                    txInfo.get((err, item)=>{
                        if(err){
                            inMsg.error = {
                                message: err.toString()
                            }
                        }
                        else{
                            inMsg.data = Object.assign({}, inMsg.data, item)
                        }
                        this.send(outMsg)
                    })
                    break;

                default:
                    inMsg.error = {
                        message: `unknown kafka request method: ${inMsg.metadata.methodName}`,
                    }
                    this.send(outMsg)
                    break;
            }
        })
    }
}