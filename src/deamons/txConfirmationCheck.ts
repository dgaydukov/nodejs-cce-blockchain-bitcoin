/**
 * For every transaction that has confirmationNumber less than required(6 by default) we push bitcoin node to check if confirmationNumber
 * changed
 * Here we also update blockNumber for tx that was created by out bitcoin node
 */
require('module-alias/register')

const debug = require("debug")("txheck")
import {KafkaConnector} from "@kafka/kafkaConnector"
import {Transaction} from "@db/models/transaction"
import {BitcoinNode} from "@blockchain/bitcoinNode"
import {default as config} from "@root/config.json"
import {buildMessage} from "@deamons/helpers"

const RUN_TIME = 10
const WAIT_ON_SUCCESS = 5
const METHOD_NEW_CONFIRMATION = "newConfirmation"
const METHOD_TX_WENT_INTO_BLOCK = "txWentIntoBlock"
const MAX_CONFIRMATION_NUMBER = process.env.MAX_CONFIRMATION_NUMBER


const node = new BitcoinNode()
const kc = new KafkaConnector()


let allowRun = true


setInterval(()=>{
    if(allowRun){
        allowRun = false
        const finishCb = () => {
            allowRun = true
        }
        check(finishCb)
    }
}, RUN_TIME * 1000)





const check = (finishCb) => {
    const finish = () => {
        setTimeout(()=>{
            finishCb()
        }, WAIT_ON_SUCCESS * 1000)
    }
    Transaction.find({confirmationNumber: {$lt: MAX_CONFIRMATION_NUMBER}}, (err, txList)=>{
        if(txList){
            const len = txList.length
            debug(`number of tx to watch: ${len}`)
            if(len == 0){
                finish()
            }
            txList.map((txItem, i)=>{
                setTimeout(()=>{
                    node.getTransaction(txItem.txId, (err, tx)=>{
                        if(i == len - 1){
                            finish()
                        }
                        if(err || null == tx){
                            return
                        }
                        //update blocknumber if null
                        if(!txItem.blockNumber){
                            node.getBlockByHash(tx.blockhash, (err, block)=>{
                                if(err || null == block){
                                    return
                                }
                                txItem.blockNumber = block.height
                                txItem.save((err, data)=>{
                                    kc.send(buildMessage(METHOD_TX_WENT_INTO_BLOCK, {
                                            txId: data.txId,
                                            blockNumber: data.blockNumber,
                                        })
                                    );
                                })
                            })
                        }
                        const confirmationNumber = tx.confirmations
                        if(confirmationNumber > 0 && confirmationNumber != txItem.confirmationNumber){
                            debug(`txId: ${txItem.txId}, confirmationNumber: ${confirmationNumber}`)
                            txItem.confirmationNumber = confirmationNumber
                            txItem.save((err, data)=>{
                                kc.send(buildMessage(METHOD_NEW_CONFIRMATION, {
                                        txId: data.txId,
                                        confirmationNumber: data.confirmationNumber,
                                    })
                                );
                            })
                        }
                    })
                }, i * 100)
            })
        }
        else{
            finish()
        }
    })
}